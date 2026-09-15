import type Database from 'better-sqlite3';
import type { LedgerStore } from '@desktop-assistant/ledger-store';
import type {
  CallSubject,
  EvaluationContext,
  Decision,
  EvaluationFailure,
  ApprovalRequestPayload,
  ApprovalDecisionInput,
  GateHealth,
  StateRecheckHook,
} from './types.js';
import { RuleStore } from './catalogue/rule-store.js';
import { AllowlistStore } from './catalogue/allowlist-store.js';
import { HardGateEvaluator, type Tier2RiskJudgeHook } from './evaluator/evaluator.js';
import { GrantRegister } from './grants/grant-register.js';
import { SuspensionManager, type DecisionResult } from './held-call/suspension-manager.js';
import { RefusalRegister } from './refusal/refusal-register.js';
import { GateHealthTracker } from './catalogue/health.js';
import { buildEvaluationContext, type BuildEvaluationContextInput } from './context/call-context-builder.js';
import { HARDLINE_RULES } from './ir/hardline-rules.js';
import { STATIC_TIER_RULES } from './ir/static-tier-rules.js';

export interface ApprovalGateOptions {
  readonly db: Database.Database;
  readonly tier2Judge?: Tier2RiskJudgeHook | undefined;
  readonly ledgerStore?: LedgerStore | undefined;
  readonly defaultTimeoutMinutes?: number | undefined;
  readonly stateRecheckHook?: StateRecheckHook | undefined;
}

/**
 * Top-level Approval Gate coordinating rule evaluation, catalogue store,
 * grants, suspensions, and refusal disclosures.
 */
export class ApprovalGate {
  readonly #db: Database.Database;
  readonly #healthTracker = new GateHealthTracker();
  readonly #ruleStore: RuleStore;
  readonly #allowlistStore: AllowlistStore;
  readonly #grantRegister = new GrantRegister();
  readonly #suspensionManager: SuspensionManager;
  readonly #refusalRegister = new RefusalRegister();
  readonly #ledgerStore?: LedgerStore | undefined;
  readonly #tier2Judge?: Tier2RiskJudgeHook | undefined;
  readonly #stateRecheckHook?: StateRecheckHook | undefined;

  constructor(options: ApprovalGateOptions) {
    this.#db = options.db;
    this.#ledgerStore = options.ledgerStore;
    this.#tier2Judge = options.tier2Judge;
    this.#stateRecheckHook = options.stateRecheckHook;
    this.#suspensionManager = new SuspensionManager(options.defaultTimeoutMinutes ?? 30);

    this.#ruleStore = new RuleStore(this.#db, this.#healthTracker);
    this.#allowlistStore = new AllowlistStore(this.#db);
  }

  get health(): GateHealth {
    return this.#healthTracker.health;
  }

  get ruleStore(): RuleStore {
    return this.#ruleStore;
  }

  get allowlistStore(): AllowlistStore {
    return this.#allowlistStore;
  }

  get grantRegister(): GrantRegister {
    return this.#grantRegister;
  }

  get suspensionManager(): SuspensionManager {
    return this.#suspensionManager;
  }

  get refusalRegister(): RefusalRegister {
    return this.#refusalRegister;
  }

  /**
   * Prepares the full EvaluationContext, pulling active grants and
   * pre-fetching counts from the ledger store if required by active rules.
   */
  async prepareContext(input: BuildEvaluationContextInput): Promise<EvaluationContext> {
    const activeRules = [...HARDLINE_RULES, ...STATIC_TIER_RULES, ...this.#ruleStore.rules];
    const activeGrants = this.#grantRegister.getGrantsForJob(input.jobId);

    return buildEvaluationContext(
      {
        ...input,
        activeGrants,
      },
      activeRules,
      this.#ledgerStore
    );
  }

  /**
   * Evaluates a call subject.
   * Enforces fail-closed: if the catalogue is stopped due to error/corruption,
   * write operations are refused globally across the application.
   */
  evaluate(subject: CallSubject, context: EvaluationContext): Decision | EvaluationFailure {
    // 1. Fail-closed global guard
    if (this.#healthTracker.isStopped) {
      const code = this.#healthTracker.errorCode ?? 'RULE_CATALOGUE_UNREADABLE';
      return {
        verdict: 'refuse',
        matched: [
          {
            ruleId: 'GLOBAL-FAIL-CLOSED-HALT',
            origin: 'static',
            name: 'Global Fail-Closed Write Halt',
            verdict: 'refuse',
          },
        ],
        reason: `All write operations halted: ${this.#healthTracker.health.reason || 'Catalogue unreadable or invalid.'} (${code})`,
        unappealable: true,
      };
    }

    // 2. Evaluate through HardGateEvaluator first
    const evaluator = new HardGateEvaluator({
      rules: this.#ruleStore.rules,
      tier2Judge: this.#tier2Judge,
    });

    const decision = evaluator.evaluate(subject, context);
    if ('error' in decision) return decision;

    // Hardline or user rule with 'refuse' ALWAYS REFUSES (allowlist cannot override)
    if (decision.verdict === 'refuse') {
      const topRule = decision.matched[0];
      this.#refusalRegister.addNotice({
        jobId: context.jobId,
        tool: subject.tool,
        object: subject.object ? { type: subject.object.type, id: subject.object.id } : undefined,
        ruleId: topRule?.ruleId || 'UNKNOWN_RULE',
        ruleName: topRule?.name || 'Unknown Rule',
        reason: decision.reason,
        at: context.now,
      });
      return decision;
    }

    // A stopping rule with 'hold' cannot be carved around by permanent allowlist:
    // Strictest wins: "An allowlist entry cannot carve an exception: GIVEN a permanent allowlist entry covers an operation that a stopping rule also matches, WHEN the operation is attempted, THEN it is stopped, and the user is told which rule stopped it" (approval/spec.md:466-471)
    const hasUserOrStaticStoppingRule = decision.matched.some(
      (r) =>
        (r.origin === 'user' || r.origin === 'static') &&
        r.verdict === 'hold' &&
        r.ruleId !== 'TIER2-UNATTACHED-FALLBACK'
    );
    if (hasUserOrStaticStoppingRule) {
      const topRule = decision.matched[0];
      this.#refusalRegister.addNotice({
        jobId: context.jobId,
        tool: subject.tool,
        object: subject.object ? { type: subject.object.type, id: subject.object.id } : undefined,
        ruleId: topRule?.ruleId || 'UNKNOWN_RULE',
        ruleName: topRule?.name || 'Unknown Rule',
        reason: decision.reason,
        at: context.now,
      });
      return decision;
    }

    // 3. In smart/off mode, if no user stopping rule matched, check permanent allowlist to bypass Tier 2
    if (context.mode !== 'on' && subject.object) {
      const isAllowed = this.#allowlistStore.isAllowlisted(
        subject.connector,
        subject.tool,
        subject.object.type,
        subject.object.id
      );
      if (isAllowed) {
        return {
          verdict: 'allow',
          matched: [
            {
              ruleId: 'PERMANENT-ALLOWLIST',
              origin: 'user',
              name: 'Permanent Allowlist Entry',
              verdict: 'allow',
            },
          ],
          reason: 'Operation is explicitly permitted by permanent allowlist exception.',
        };
      }
    }

    // If verdict is hold, record notice
    if (decision.verdict === 'hold') {
      const topRule = decision.matched[0];
      this.#refusalRegister.addNotice({
        jobId: context.jobId,
        tool: subject.tool,
        object: subject.object ? { type: subject.object.type, id: subject.object.id } : undefined,
        ruleId: topRule?.ruleId || 'UNKNOWN_RULE',
        ruleName: topRule?.name || 'Unknown Rule',
        reason: decision.reason,
        at: context.now,
      });
    }

    return decision;
  }

  /**
   * Suspends a held call and generates an approval request.
   */
  createApprovalRequest(
    subject: CallSubject,
    decision: Decision,
    context: EvaluationContext,
    options?: {
      timeoutMinutes?: number;
      initialSnapshot?: Record<string, unknown> | null;
      expectedChanges?: {
        before?: Record<string, unknown> | 'unavailable';
        after?: Record<string, unknown> | 'unavailable';
        summary?: string;
      };
    }
  ): ApprovalRequestPayload {
    const payload = this.#suspensionManager.createRequest(subject, decision, context, options);

    if (this.#ledgerStore) {
      this.#ledgerStore
        .createApprovalRequest({
          requestId: payload.requestId,
          jobId: payload.jobId,
          tool: payload.tool,
          object: payload.object
            ? {
                connector: payload.connector,
                resourceType: payload.object.type,
                id: payload.object.id,
              }
            : undefined,
          beforeAfter: payload.expectedChanges ? { ...payload.expectedChanges } : undefined,
          matched: payload.matchedRules.map((r) => ({ ruleId: r.ruleId, verdict: r.verdict })),
          reason: decision.reason,
          expiresAt: payload.expiresAt,
          appealable: true,
        })
        .catch((err: unknown) => {
          console.error('[ApprovalGate] Failed to persist approval request in ledger:', err);
        });
    }

    return payload;
  }

  /**
   * Applies an approval decision submitted by human user.
   * Enforces Constitution Principle III: human decisions are ledger records.
   */
  async applyDecision(
    input: ApprovalDecisionInput,
    options?: {
      stateRecheckHook?: StateRecheckHook;
      nowIso?: string;
    }
  ): Promise<DecisionResult> {
    const hook = options?.stateRecheckHook ?? this.#stateRecheckHook;
    const evaluator = new HardGateEvaluator({
      rules: this.#ruleStore.rules,
      tier2Judge: this.#tier2Judge,
    });

    const result = await this.#suspensionManager.applyDecision(input, {
      stateRecheckHook: hook,
      grantRegister: this.#grantRegister,
      allowlistStore: this.#allowlistStore,
      evaluator,
      nowIso: options?.nowIso,
    });

    // Uphold Constitution Principle III: write decision record to ledger
    if (this.#ledgerStore && !result.alreadyHandled) {
      const state = this.#suspensionManager.getRequest(input.requestId);
      if (state) {
        await this.#ledgerStore.appendDecision({
          jobId: state.payload.jobId,
          decision: input.level === 'deny' ? 'deny' : 'approve',
          decidedBy: 'user',
          scope: input.level,
          reason: result.message,
        });
      }
    }

    return result;
  }

  /**
   * Attaches refusal disclosure to an agent question if any operation was stopped in this job.
   */
  formatQuestionWithDisclosures(jobId: string, question: string): string {
    return this.#refusalRegister.formatDisclosureForQuestion(jobId, question);
  }

  /**
   * Cleans up transient in-memory job state (scoped grants, refusal notices)
   * upon job completion.
   */
  onJobCompleted(jobId: string): void {
    this.#grantRegister.revokeGrantsForJob(jobId);
    this.#refusalRegister.clearJob(jobId);
  }
}
