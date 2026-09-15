import type {
  Rule,
  Condition,
  Verdict,
  AllCondition,
  AnyCondition,
  NotCondition,
  ToolLeaf,
  ScopeLeaf,
  FieldLeaf,
  OwnershipLeaf,
  CountLeaf,
  TimeLeaf,
  IrreversibleLeaf,
  PermissionLeaf,
  StringOrStrings,
  JsonValue,
  Principal,
  RuleRow,
  AllowlistEntryRow,
} from '@desktop-assistant/contracts/rule-representation';

export type {
  Rule,
  Condition,
  Verdict,
  AllCondition,
  AnyCondition,
  NotCondition,
  ToolLeaf,
  ScopeLeaf,
  FieldLeaf,
  OwnershipLeaf,
  CountLeaf,
  TimeLeaf,
  IrreversibleLeaf,
  PermissionLeaf,
  StringOrStrings,
  JsonValue,
  Principal,
  RuleRow,
  AllowlistEntryRow,
};

/**
 * Built-in or stored rule origin.
 * Stored rules can only be 'user'. Hardline and static patterns are build-internal.
 */
export type RuleOrigin = 'hardline' | 'static' | 'user';

/**
 * Internal extended representation for hardline and static tier rules.
 */
export interface SystemRule {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly origin: 'hardline' | 'static';
  readonly verdict: Verdict;
  readonly condition: Condition;
  readonly unappealable?: boolean;
}

/**
 * Common shape for matching rule reporting.
 */
export interface MatchedRuleInfo {
  readonly ruleId: string;
  readonly origin: RuleOrigin;
  readonly name: string;
  readonly verdict: Verdict;
}

/**
 * Subject of the tool call being judged.
 * Assembled from connector manifest + platform read, NEVER from LLM arguments.
 */
export interface CallSubject {
  readonly callId: string;
  readonly connector: string;
  readonly tool: string;
  /** Raw arguments passed by agent (subject of judgment, not trusted input). */
  readonly arguments: Record<string, unknown>;
  /** Object metadata read from connector's canonical platform record. */
  readonly object?: {
    readonly type: string;
    readonly id: string;
    readonly ancestorIds: readonly string[];
    readonly createdBy?: string | undefined;
    readonly assignedTo?: readonly string[] | undefined;
  } | undefined;
  /** Manifest declarations. */
  readonly isIrreversible: boolean;
  readonly changesPermission: boolean;
  /** True if snapshot for rollback could not be obtained before write. */
  readonly isSnapshotUnavailable?: boolean | undefined;
  /** List of affected target objects if operation is bulk. */
  readonly affectedObjects?: readonly { type: string; id: string }[] | undefined;
  /** Connector authorization status: within granted scope, outside, or unknown. */
  readonly scopeAuthorization?: 'within' | 'outside' | 'unknown' | undefined;
}

/**
 * Runtime evaluation context provided by caller and stores.
 */
export interface EvaluationContext {
  readonly jobId: string;
  readonly mode: 'on' | 'smart' | 'off';
  readonly currentUser: string;
  /** ISO-8601 timestamp of evaluation. */
  readonly now: string;
  /** Timezone of the user, e.g. "Asia/Ho_Chi_Minh". */
  readonly timezone: string;
  /** Pre-fetched counts mapped by metric key or metric descriptor. */
  readonly counts?: Readonly<Record<string, number>> | undefined;
  /** Active scoped approvals for this job. */
  readonly activeGrants?: readonly ScopedApproval[] | undefined;
}

/**
 * Outcome of the gate evaluation.
 */
export interface Decision {
  readonly verdict: Verdict;
  readonly matched: readonly MatchedRuleInfo[];
  readonly reason: string;
  readonly unappealable?: true | undefined;
}

/**
 * Structured evaluation error codes.
 */
export type EvaluationErrorCode =
  | 'RULE_CATALOGUE_UNREADABLE'
  | 'RULE_CATALOGUE_INVALID'
  | 'RULE_VERSION_AHEAD'
  | 'MANIFEST_DECLARATION_MISSING'
  | 'FIELD_VALUE_UNEXTRACTABLE'
  | 'COUNT_UNAVAILABLE'
  | 'EVALUATION_FAILED'
  | 'BEFORE_STATE_DRIFTED'
  | 'APPROVAL_REQUEST_UNKNOWN'
  | 'APPROVAL_REQUEST_EXPIRED'
  | 'APPROVAL_NOT_APPEALABLE'
  | 'APPROVAL_LEVEL_FORBIDDEN'
  | 'RULE_UNKNOWN'
  | 'RULE_NOT_DELETABLE'
  | 'RULE_SCHEMA_INVALID'
  | 'RULE_PATTERN_INVALID'
  | 'RULE_ORIGIN_FORBIDDEN'
  | 'RULE_REFERENCE_UNKNOWN'
  | 'ALLOWLIST_ENTRY_UNKNOWN';
export interface EvaluationFailure {
  readonly error: EvaluationErrorCode;
  readonly detail: string;
}

/**
 * Pure evaluate function type definition.
 */
export type Evaluate = (
  subject: CallSubject,
  context: EvaluationContext
) => Decision | EvaluationFailure;

/**
 * Scoped approval token bound to (jobId, ruleId, tool, objectScope).
 */
export interface ScopedApproval {
  readonly jobId: string;
  readonly ruleId: string;
  readonly tool: string;
  readonly objectScope: {
    readonly type: string;
    readonly id: string;
  };
  readonly grantedAt: string;
}

/**
 * Refusal notice attached to subsequent questions of the same job.
 */
export interface RefusalNotice {
  readonly jobId: string;
  readonly tool: string;
  readonly object?: {
    readonly type: string;
    readonly id: string;
  } | undefined;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly reason: string;
  readonly at: string;
}

/**
 * Four decision levels offered to human user.
 */
export type ApprovalDecisionLevel = 'once' | 'job' | 'allowlist' | 'deny';

/**
 * Approval decision payload sent from UI/controller.
 */
export interface ApprovalDecisionInput {
  readonly requestId: string;
  readonly level: ApprovalDecisionLevel;
  readonly decidedAt: string;
  readonly decidedBy: string;
}

/**
 * Full approval request presented to user.
 */
export interface ApprovalRequestPayload {
  readonly requestId: string;
  readonly jobId: string;
  readonly callId: string;
  readonly connector: string;
  readonly tool: string;
  readonly object?: {
    readonly type: string;
    readonly id: string;
    readonly ancestorIds?: readonly string[] | undefined;
  } | undefined;
  readonly expectedChanges?: {
    readonly before?: Record<string, unknown> | 'unavailable' | undefined;
    readonly after?: Record<string, unknown> | 'unavailable' | undefined;
    readonly summary?: string | undefined;
  } | undefined;
  readonly matchedRules: readonly MatchedRuleInfo[];
  readonly objectsAffected: readonly { readonly type: string; readonly id: string }[];
  readonly heldAt: string;
  readonly expiresAt: string;
}

/**
 * State re-check hook for late approvals (before-state re-acquisition).
 */
export interface StateRecheckHook {
  reacquireState(subject: CallSubject): Promise<Record<string, unknown> | null | 'unavailable'>;
}

/**
 * Health status of the approval gate.
 */
export interface GateHealth {
  readonly status: 'open' | 'stopped' | 'degraded';
  readonly reason?: string | undefined;
  readonly haltedAt?: string | undefined;
}
