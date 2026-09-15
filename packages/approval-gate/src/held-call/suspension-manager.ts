import { randomUUID } from 'node:crypto';
import type {
  CallSubject,
  Decision,
  EvaluationContext,
  ApprovalRequestPayload,
  ApprovalDecisionInput,
  StateRecheckHook,
} from '../types.js';
import { ApprovalGateError } from '../errors.js';
import type { GrantRegister } from '../grants/grant-register.js';
import type { AllowlistStore } from '../catalogue/allowlist-store.js';
import type { HardGateEvaluator } from '../evaluator/evaluator.js';

export interface StoredRequestState {
  readonly payload: ApprovalRequestPayload;
  readonly subject: CallSubject;
  readonly initialSnapshot?: Record<string, unknown> | null | undefined;
  status: 'pending' | 'deciding' | 'decided' | 'expired';
  decision?: ApprovalDecisionInput | undefined;
}

export interface DecisionResult {
  readonly alreadyHandled: boolean;
  readonly status: 'approved' | 'denied' | 'already_handled';
  readonly message: string;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, k)) return false;
    if (!deepEqual(objA[k], objB[k])) return false;
  }

  return true;
}

/**
 * Manages held calls, suspension states, anti-double-decision locks,
 * timeouts, and late-approval before-state re-verification.
 */
export class SuspensionManager {
  readonly #requests = new Map<string, StoredRequestState>();
  readonly #defaultTimeoutMinutes: number;

  constructor(defaultTimeoutMinutes = 30) {
    this.#defaultTimeoutMinutes = defaultTimeoutMinutes;
  }

  /**
   * Suspends a held call and creates a durable approval request.
   * Only genuine 'hold' decisions can be suspended for approval.
   */
  createRequest(
    subject: CallSubject,
    decision: Decision,
    context: EvaluationContext,
    options?: {
      timeoutMinutes?: number | undefined;
      initialSnapshot?: Record<string, unknown> | null | undefined;
      expectedChanges?: {
        before?: Record<string, unknown> | 'unavailable' | undefined;
        after?: Record<string, unknown> | 'unavailable' | undefined;
        summary?: string | undefined;
      } | undefined;
    }
  ): ApprovalRequestPayload {
    if (decision.verdict !== 'hold' || decision.unappealable) {
      throw new ApprovalGateError(
        'APPROVAL_NOT_APPEALABLE',
        `Cannot create approval request for verdict '${decision.verdict}' or unappealable refusal.`
      );
    }

    const requestId = `req-${randomUUID()}`;
    const timeoutMin = options?.timeoutMinutes ?? this.#defaultTimeoutMinutes;
    const nowMs = new Date(context.now).getTime();
    const expiresAt = new Date(nowMs + timeoutMin * 60 * 1000).toISOString();

    const objectsAffected: { type: string; id: string }[] = [];
    if (subject.object) {
      objectsAffected.push({ type: subject.object.type, id: subject.object.id });
    }
    if (subject.affectedObjects) {
      for (const aff of subject.affectedObjects) {
        if (!objectsAffected.some((o) => o.type === aff.type && o.id === aff.id)) {
          objectsAffected.push(aff);
        }
      }
    }

    const payload: ApprovalRequestPayload = {
      requestId,
      jobId: context.jobId,
      callId: subject.callId,
      connector: subject.connector,
      tool: subject.tool,
      object: subject.object
        ? {
            type: subject.object.type,
            id: subject.object.id,
            ancestorIds: subject.object.ancestorIds,
          }
        : undefined,
      expectedChanges: options?.expectedChanges,
      matchedRules: decision.matched,
      objectsAffected,
      heldAt: context.now,
      expiresAt,
    };

    this.#requests.set(requestId, {
      payload,
      subject,
      initialSnapshot: options?.initialSnapshot,
      status: 'pending',
    });

    return payload;
  }

  getRequest(requestId: string): StoredRequestState | null {
    return this.#requests.get(requestId) ?? null;
  }

  listPendingRequests(): readonly ApprovalRequestPayload[] {
    const list: ApprovalRequestPayload[] = [];
    const now = Date.now();
    for (const state of this.#requests.values()) {
      if (state.status === 'pending') {
        const expiresMs = new Date(state.payload.expiresAt).getTime();
        if (now >= expiresMs) {
          state.status = 'expired';
        } else {
          list.push(state.payload);
        }
      }
    }
    return list;
  }

  /**
   * Applies an approval decision.
   * Enforces:
   * 1. Closed decision level validation.
   * 2. Atomic anti-double decision lock (deciding transition avoids race conditions).
   * 3. Expiration checks (now >= expiresAt).
   * 4. Late approval state re-check via StateRecheckHook.
   * 5. Scoped grant and allowlist registration with stopping rule check.
   */
  async applyDecision(
    input: ApprovalDecisionInput,
    options?: {
      stateRecheckHook?: StateRecheckHook | undefined;
      grantRegister?: GrantRegister | undefined;
      allowlistStore?: AllowlistStore | undefined;
      evaluator?: HardGateEvaluator | undefined;
      nowIso?: string | undefined;
    } | undefined
  ): Promise<DecisionResult> {
    // 1. Validate decision level
    if (!['once', 'job', 'allowlist', 'deny'].includes(input.level)) {
      throw new ApprovalGateError(
        'RULE_SCHEMA_INVALID',
        `Invalid decision level '${String(input.level)}'. Must be 'once', 'job', 'allowlist', or 'deny'.`
      );
    }

    const state = this.#requests.get(input.requestId);
    if (!state) {
      throw new ApprovalGateError(
        'APPROVAL_REQUEST_UNKNOWN',
        `Approval request '${input.requestId}' was not found.`
      );
    }

    // 2. Anti-double decision check: atomic transition to 'deciding'
    if (state.status === 'decided' || state.status === 'deciding') {
      return {
        alreadyHandled: true,
        status: 'already_handled',
        message: 'Request is already being processed or has already been decided.',
      };
    }

    state.status = 'deciding';

    try {
      // 3. Expiry check
      const nowMs = options?.nowIso
        ? new Date(options.nowIso).getTime()
        : input.decidedAt
        ? new Date(input.decidedAt).getTime()
        : Date.now();
      const expiresMs = new Date(state.payload.expiresAt).getTime();
      if (!Number.isFinite(nowMs) || !Number.isFinite(expiresMs)) {
        throw new ApprovalGateError('EVALUATION_FAILED', 'Invalid timestamp for expiry check.');
      }
      if (nowMs >= expiresMs) {
        state.status = 'expired';
        throw new ApprovalGateError(
          'APPROVAL_REQUEST_EXPIRED',
          `Approval request '${input.requestId}' has expired after waiting period.`
        );
      }

      // 4. Late approval state re-check
      if (input.level !== 'deny' && state.initialSnapshot !== undefined) {
        if (!options?.stateRecheckHook) {
          throw new ApprovalGateError(
            'BEFORE_STATE_DRIFTED',
            'StateRecheckHook is required to re-verify state before executing late approval.'
          );
        }
        const currentState = await options.stateRecheckHook.reacquireState(state.subject);
        if (currentState === 'unavailable') {
          throw new ApprovalGateError(
            'BEFORE_STATE_DRIFTED',
            'Cannot re-acquire object state prior to executing approved operation: platform state unavailable.'
          );
        }
        if (!deepEqual(state.initialSnapshot, currentState)) {
          throw new ApprovalGateError(
            'BEFORE_STATE_DRIFTED',
            'Target object state has changed since approval was requested. Operation refused for safety.'
          );
        }
      }

      // 5. Decision application
      if (input.level === 'deny') {
        state.status = 'decided';
        state.decision = input;
        return {
          alreadyHandled: false,
          status: 'denied',
          message: 'Operation denied by user decision.',
        };
      }

      // Scoped approval for the job
      if (input.level === 'job' && options?.grantRegister) {
        const scope = state.payload.object;
        if (!scope || !scope.id || !scope.type) {
          throw new ApprovalGateError(
            'RULE_SCHEMA_INVALID',
            'Cannot grant job-scoped approval without an identifiable object scope.'
          );
        }
        for (const rule of state.payload.matchedRules) {
          // Grants strictly apply only to hold rules, never an outright refusal
          if (rule.verdict === 'hold') {
            options.grantRegister.addGrant({
              jobId: state.payload.jobId,
              ruleId: rule.ruleId,
              tool: state.payload.tool,
              objectScope: {
                type: scope.type,
                id: scope.id,
              },
              grantedAt: input.decidedAt,
            });
          }
        }
      }

      // Permanent allowlist
      if (input.level === 'allowlist' && options?.allowlistStore) {
        if (!state.payload.object) {
          throw new ApprovalGateError(
            'RULE_SCHEMA_INVALID',
            'Cannot add permanent allowlist exception without an identifiable object scope.'
          );
        }
        const evalContext: EvaluationContext = {
          jobId: state.payload.jobId,
          mode: 'smart',
          currentUser: input.decidedBy,
          now: input.decidedAt,
          timezone: 'UTC',
        };
        options.allowlistStore.addEntry(
          {
            connector: state.payload.connector,
            tool: state.payload.tool,
            objectType: state.payload.object.type,
            objectId: state.payload.object.id,
          },
          options.evaluator,
          evalContext
        );
      }

      state.status = 'decided';
      state.decision = input;

      return {
        alreadyHandled: false,
        status: 'approved',
        message: `Operation approved with level '${input.level}'.`,
      };
    } catch (err) {
      // Revert status on failure so request remains pending or properly expired
      if (state.status === 'deciding') {
        state.status = 'pending';
      }
      throw err;
    }
  }
}
