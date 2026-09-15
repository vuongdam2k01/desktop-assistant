// ── Package Entrypoint: @desktop-assistant/approval-gate ──────────────────────

// Main Approval Gate Engine
export { ApprovalGate, type ApprovalGateOptions } from './approval-gate.js';

// Types and Contracts
export type {
  CallSubject,
  EvaluationContext,
  Decision,
  EvaluationFailure,
  EvaluationErrorCode,
  Evaluate,
  ScopedApproval,
  RefusalNotice,
  ApprovalDecisionLevel,
  ApprovalDecisionInput,
  ApprovalRequestPayload,
  StateRecheckHook,
  GateHealth,
  MatchedRuleInfo,
  RuleOrigin,
  SystemRule,
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
} from './types.js';

// Errors
export { ApprovalGateError } from './errors.js';

// Pure Evaluator & Normalizer
export {
  HardGateEvaluator,
  type HardGateEvaluatorOptions,
  type Tier2RiskJudgeHook,
} from './evaluator/evaluator.js';
export {
  normalizePropertyName,
  extractPropertyValue,
  extractCallProperties,
  type NormalizedCallProperties,
} from './evaluator/normalizer.js';
export {
  evaluateCondition,
  evaluateToolLeaf,
  evaluateScopeLeaf,
  evaluateFieldLeaf,
  evaluateOwnershipLeaf,
  evaluateCountLeaf,
  evaluateTimeLeaf,
  evaluateIrreversibleLeaf,
  evaluatePermissionLeaf,
} from './evaluator/predicates.js';
export { resolveStrictestVerdict } from './evaluator/resolution.js';

// System Rules
export { HARDLINE_RULES } from './ir/hardline-rules.js';
export { STATIC_TIER_RULES } from './ir/static-tier-rules.js';
export { validateRule, SUPPORTED_REPRESENTATION_VERSION } from './ir/validator.js';

// Stores
export { RuleStore } from './catalogue/rule-store.js';
export {
  AllowlistStore,
  type AllowlistEntry,
  type AddAllowlistEntryInput,
} from './catalogue/allowlist-store.js';
export { GateHealthTracker } from './catalogue/health.js';
export { RULE_CATALOGUE_DDL, initializeRuleCatalogueSchema } from './catalogue/schema.js';

// Grants & Suspension
export { GrantRegister } from './grants/grant-register.js';
export {
  SuspensionManager,
  type StoredRequestState,
  type DecisionResult,
} from './held-call/suspension-manager.js';
export { RefusalRegister } from './refusal/refusal-register.js';

// Context Builder & Counts
export {
  buildCallSubject,
  buildEvaluationContext,
  type BuildCallSubjectInput,
  type BuildEvaluationContextInput,
} from './context/call-context-builder.js';
export {
  fetchCountsForRules,
  extractCountLeaves,
  getCalendarDayStartIso,
} from './counts/count-reader.js';
