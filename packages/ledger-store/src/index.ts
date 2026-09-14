// ── Package Entrypoint: @desktop-assistant/ledger-store ──────────────────────

// Database Openers & Durability
export {
  openLedgerStore,
  openAuxiliaryDatabase,
  durabilityPolicy,
  type OpenLedgerStoreOptions,
  type OpenAuxiliaryDatabaseOptions,
  type DurabilitySettings,
} from './opener.js';

// Primary Store Interfaces
export type { LedgerStore } from './ledger-store.js';

// Change Stream Listener
export type { RecordListener } from './change-stream.js';

// Errors
export {
  LedgerStoreError,
  LEDGER_STORE_ERROR_CODES,
  type LedgerStoreErrorCode,
  type LedgerStoreErrorOptions,
} from './errors.js';

// Record Summary Presentation
export { renderRecordSummary } from './summary.js';

// Maintenance Interfaces
export type {
  ExpireOptions,
  DeleteByUserRange,
  UserDeletionConfirmation,
} from './removal-manager.js';

// Data Types, Inputs & Projections
export type {
  // Snapshot & Reversibility
  Snapshot,
  SnapshotUnavailable,
  SnapshotOrUnavailable,
  Reversibility,
  CompensatingAction,
  FailureDetail,
  ReconciliationDeclaration,
  // Record Contents
  IntentContent,
  ResultContent,
  DecisionContent,
  ErrorContent,
  InformationContent,
  RemovalAnnouncementContent,
  SupersededVersionContent,
  // Typed Records
  LedgerRecordType,
  TypedLedgerRecord,
  IntentRecord,
  ResultRecord,
  DecisionRecord,
  ErrorRecord,
  InformationRecord,
  RemovalAnnouncementRecord,
  SupersededVersionRecord,
  // Inputs
  AppendIntentInput,
  AppendResultInput,
  AppendDecisionInput,
  AppendErrorInput,
  AppendInformationInput,
  AppendSupersededVersionInput,
  // Projections: Job
  JobState,
  ApprovalMode,
  NewJob,
  StoredJob,
  JobStateTransition,
  // Projections: Approval
  ApprovalRequest,
  StoredApprovalRequest,
  ApprovalRequestStatus,
  // Queries & Recovery
  RecordQuery,
  UnresolvedIntent,
  ShapeState,
  RemovalRange,
  RemovalOutcome,
  RemovalRequest,
  ReadOnlyLedgerStore,
} from './types.js';
