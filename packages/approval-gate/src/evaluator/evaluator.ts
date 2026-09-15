import type { Rule } from '@desktop-assistant/contracts/rule-representation';
import type {
  CallSubject,
  EvaluationContext,
  Decision,
  EvaluationFailure,
  MatchedRuleInfo,
} from '../types.js';
import { HARDLINE_RULES } from '../ir/hardline-rules.js';
import { STATIC_TIER_RULES } from '../ir/static-tier-rules.js';
import { extractCallProperties } from './normalizer.js';
import { evaluateCondition } from './predicates.js';
import { ApprovalGateError } from '../errors.js';
import { resolveStrictestVerdict } from './resolution.js';
export type Tier2RiskJudgeHook = (
  subject: CallSubject,
  context: EvaluationContext
) => Promise<Decision> | Decision;

export interface HardGateEvaluatorOptions {
  readonly rules?: readonly Rule[] | undefined;
  readonly tier2Judge?: Tier2RiskJudgeHook | undefined;
}

/**
 * Checks if a specific rule evaluation is covered by a valid scoped approval.
 * Scoped approval strictly matches the 4-tuple: (jobId, ruleId, tool, objectScope).
 */
function isCoveredByGrant(
  ruleId: string,
  subject: CallSubject,
  context: EvaluationContext
): boolean {
  if (!context.activeGrants || context.activeGrants.length === 0) {
    return false;
  }
  // Scoped grant strictly requires a valid, non-empty object scope
  if (!subject.object || !subject.object.id || !subject.object.type) {
    return false;
  }
  // Bulk call with multiple affected objects cannot be covered by a single object grant
  if (subject.affectedObjects && subject.affectedObjects.length > 1) {
    const allCovered = subject.affectedObjects.every((aff) =>
      context.activeGrants?.some(
        (g) =>
          g.jobId === context.jobId &&
          g.ruleId === ruleId &&
          g.tool === subject.tool &&
          g.objectScope.type === aff.type &&
          g.objectScope.id === aff.id
      )
    );
    return allCovered;
  }
  return context.activeGrants.some((grant) => {
    if (grant.jobId !== context.jobId) return false;
    if (grant.ruleId !== ruleId) return false;
    if (grant.tool !== subject.tool) return false;
    if (
      grant.objectScope.type !== subject.object?.type ||
      grant.objectScope.id !== subject.object?.id
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Pure, deterministic, synchronous Hard Gate Evaluator.
 * Evaluates a tool call subject against Hardline Blocklist, Operational Mode,
 * Static Tier 1 patterns, and stored User Rules.
 * Operates strictly outside the LLM loop in the application layer.
 */
export class HardGateEvaluator {
  readonly #userRules: readonly Rule[];
  readonly #tier2Judge?: Tier2RiskJudgeHook | undefined;

  constructor(options?: HardGateEvaluatorOptions) {
    this.#userRules = options?.rules ?? [];
    this.#tier2Judge = options?.tier2Judge;
  }

  /**
   * Evaluates a tool call against the loaded rule sets.
   * Completely synchronous, pure, model-free.
   */
  evaluateOrThrow(subject: CallSubject, context: EvaluationContext): Decision {
    const res = this.evaluate(subject, context);
    if ('error' in res) {
      throw new Error(`[${res.error}] ${res.detail}`);
    }
    return res;
  }

  /**
   * Evaluates a tool call against the loaded rule sets.
   * Completely synchronous, pure, model-free.
   */
  evaluate(subject: CallSubject, context: EvaluationContext): Decision | EvaluationFailure {
    try {
      // 0. MANIFEST DECLARATIONS VALIDATION
      if (typeof subject.isIrreversible !== 'boolean' || typeof subject.changesPermission !== 'boolean') {
        return {
          error: 'MANIFEST_DECLARATION_MISSING',
          detail: `Connector manifest declaration missing for tool '${subject.tool}'. Irreversibility and permission flags must be declared.`,
        };
      }

      const cachedProps = extractCallProperties(subject.arguments);
      // Evaluated first in every mode. Never appealable, never held for approval.
      // ──────────────────────────────────────────────────────────────────────────
      // Check explicit out-of-scope or unknown connector authorization status
      if (subject.scopeAuthorization === 'outside' || subject.scopeAuthorization === 'unknown') {
        return {
          verdict: 'refuse',
          matched: [
            {
              ruleId: 'HL-03-OUT-OF-SCOPE-OPERATIONS',
              origin: 'hardline',
              name: 'Block Out-of-Scope Operations',
              verdict: 'refuse',
            },
          ],
          reason:
            'Hardline refusal: Operation target is outside authorized connector workspace scope or has unknown authorization status (HL-03-OUT-OF-SCOPE-OPERATIONS).',
          unappealable: true,
        };
      }

      for (const hlRule of HARDLINE_RULES) {
        if (evaluateCondition(hlRule.condition, subject, context, cachedProps)) {
          return {
            verdict: 'refuse',
            matched: [
              {
                ruleId: hlRule.id,
                origin: 'hardline',
                name: hlRule.name,
                verdict: 'refuse',
              },
            ],
            reason: `Hardline refusal: ${hlRule.description || hlRule.name} (${hlRule.id})`,
            unappealable: true,
          };
        }
      }

      // ──────────────────────────────────────────────────────────────────────────
      // 2. MODE: OFF (FR-AP-01c)
      // Removes waiting but not recording. User rules with verdict 'refuse' still bind!
      // User rules with verdict 'hold' fall silent (matched, did not stop).
      // ──────────────────────────────────────────────────────────────────────────
      if (context.mode === 'off') {
        const matchedRefusals: MatchedRuleInfo[] = [];
        const silentMatches: MatchedRuleInfo[] = [];

        for (const rule of this.#userRules) {
          if (evaluateCondition(rule.condition, subject, context, cachedProps)) {
            const info: MatchedRuleInfo = {
              ruleId: rule.id,
              origin: 'user',
              name: rule.name,
              verdict: rule.verdict,
            };
            if (rule.verdict === 'refuse') {
              matchedRefusals.push(info);
            } else {
              silentMatches.push(info);
            }
          }
        }

        if (matchedRefusals.length > 0) {
          return resolveStrictestVerdict(matchedRefusals);
        }

        return {
          verdict: 'allow',
          matched: silentMatches,
          reason:
            silentMatches.length > 0
              ? 'Mode is OFF: matching hold-for-approval rules fell silent and did not stop the call.'
              : 'Mode is OFF: operation allowed.',
        };
      }

      // ──────────────────────────────────────────────────────────────────────────
      // 3. MODE: ON (FR-AP-01a)
      // Blanket gate: stops every write operation.
      // User rules are still evaluated so strictest wins (refuse beats hold).
      // ──────────────────────────────────────────────────────────────────────────
      if (context.mode === 'on') {
        const matchedRules: MatchedRuleInfo[] = [];

        // Check user rules first for outright refusals
        for (const rule of this.#userRules) {
          if (evaluateCondition(rule.condition, subject, context, cachedProps)) {
            matchedRules.push({
              ruleId: rule.id,
              origin: 'user',
              name: rule.name,
              verdict: rule.verdict,
            });
          }
        }

        const isRefused = matchedRules.some((r) => r.verdict === 'refuse');
        if (isRefused) {
          return resolveStrictestVerdict(matchedRules);
        }

        // Check if blanket gate is covered by active job grant
        const blanketRuleId = 'MODE-ON-BLANKET';
        const isBlanketGranted = isCoveredByGrant(blanketRuleId, subject, context);
        if (isBlanketGranted) {
          return {
            verdict: 'allow',
            matched: matchedRules,
            reason: 'Mode is ON: write operation covered by active scoped grant for this job.',
          };
        }

        matchedRules.push({
          ruleId: blanketRuleId,
          origin: 'static',
          name: 'Mode ON Blanket Gate',
          verdict: 'hold',
        });

        return resolveStrictestVerdict(
          matchedRules,
          'hold',
          'Approval mode is ON: all write operations require human approval.'
        );
      }

      // ──────────────────────────────────────────────────────────────────────────
      // 4. MODE: SMART (FR-AP-01b)
      // Tier 1 Static Patterns + User Catalog Rules.
      // If no Tier 1 pattern matches, delegates to Tier 2 Risk Judge (or fails closed).
      // ──────────────────────────────────────────────────────────────────────────
      const matchedRules: MatchedRuleInfo[] = [];

      // 4a. Static Tier 1 Rules
      for (const staticRule of STATIC_TIER_RULES) {
        if (evaluateCondition(staticRule.condition, subject, context, cachedProps)) {
          // Check if this static rule is covered by an active scoped grant
          if (!isCoveredByGrant(staticRule.id, subject, context)) {
            matchedRules.push({
              ruleId: staticRule.id,
              origin: 'static',
              name: staticRule.name,
              verdict: staticRule.verdict,
            });
          }
        }
      }

      // 4b. User Catalogue Rules
      for (const userRule of this.#userRules) {
        if (evaluateCondition(userRule.condition, subject, context, cachedProps)) {
          // Scoped grant can only cover 'hold' rules, NEVER an outright 'refuse' rule!
          const isHoldCovered =
            userRule.verdict === 'hold' && isCoveredByGrant(userRule.id, subject, context);
          if (!isHoldCovered) {
            matchedRules.push({
              ruleId: userRule.id,
              origin: 'user',
              name: userRule.name,
              verdict: userRule.verdict,
            });
          }
        }
      }

      // If any Tier 1 static or user rule matched -> return strictest verdict
      if (matchedRules.length > 0) {
        return resolveStrictestVerdict(matchedRules);
      }

      // 4c. Tier 2 Risk Judge invocation or fail-closed fallback
      if (this.#tier2Judge) {
        const judgeResult = this.#tier2Judge(subject, context);
        if (judgeResult instanceof Promise) {
          // Evaluator is synchronous contract; an async judge in synchronous evaluate
          // fails closed to hold
          return {
            verdict: 'hold',
            matched: [
              {
                ruleId: 'TIER2-ASYNC-FALLBACK',
                origin: 'static',
                name: 'Tier 2 Risk Judge Async Pending',
                verdict: 'hold',
              },
            ],
            reason:
              'Tier 2 Risk Judge returned asynchronous promise in synchronous path; failing closed to hold.',
          };
        }
        return judgeResult;
      }

      // F15 Risk Judge is not attached yet: fail-closed to hold per spec
      return {
        verdict: 'hold',
        matched: [
          {
            ruleId: 'TIER2-UNATTACHED-FALLBACK',
            origin: 'static',
            name: 'Tier 2 Risk Judge Unattached',
            verdict: 'hold',
          },
        ],
        reason:
          'Smart mode Tier 2 model risk judge is not attached; failing closed to hold for human approval.',
      };
    } catch (err: unknown) {
      if (err instanceof ApprovalGateError) {
        if (err.code === 'COUNT_UNAVAILABLE' || err.code === 'FIELD_VALUE_UNEXTRACTABLE') {
          return {
            verdict: 'hold',
            matched: [
              {
                ruleId: `FAIL-CLOSED-${err.code}`,
                origin: 'static',
                name: `Evaluation Hold: ${err.code}`,
                verdict: 'hold',
              },
            ],
            reason: `Evaluation held closed: ${err.detail} (${err.code})`,
          };
        }
        return {
          error: err.code,
          detail: err.detail,
        };
      }
      return {
        error: 'EVALUATION_FAILED',
        detail: `Evaluator threw unexpected exception: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
