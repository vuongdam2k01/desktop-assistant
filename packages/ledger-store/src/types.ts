import type { ReconciliationDeclaration } from '@desktop-assistant/contracts/tool-reconciliation';

export type { ReconciliationDeclaration };

// ── Snapshot & Reversibility Types ──────────────────────────────────────────

export interface Snapshot {
  readonly captured: true;
  readonly target: string;
  readonly state: unknown;
}

export interface SnapshotUnavailable {
  readonly captured: false;
  readonly target?: string | undefined;
  readonly reason: string;
}

export type SnapshotOrUnavailable = Snapshot | SnapshotUnavailable;

export type Reversibility =
  | { readonly kind: 'reversible'; readonly snapshotMethod: string }
  | { readonly kind: 'irreversible'; readonly reason: string };

export interface CompensatingAction {
  readonly connector: string;
  readonly tool: string;
  readonly parameters: unknown;
}

export interface FailureDetail {
  readonly code: string;
  readonly message: string;
  readonly retriable: boolean;
}

// ── Discriminated Record Content Types (ledger-record.schema.json) ──────────

export interface IntentContent {
  readonly connector: string;
  readonly tool: string;
  readonly parameters: unknown;
  readonly before: SnapshotOrUnavailable;
  readonly reversibility: Reversibility;
  readonly reconciliation: ReconciliationDeclaration;
}

export interface ResultContent {
  readonly outcome: 'succeeded' | 'failed';
  readonly establishedBy: 'observed' | 'reconciled' | 'user_confirmed';
  readonly response?: unknown;
  readonly after?: SnapshotOrUnavailable | undefined;
  readonly compensatingAction?: CompensatingAction | undefined;
  readonly failure?: FailureDetail | undefined;
}

export interface DecisionContent {
  readonly decision: 'approve' | 'deny' | 'cancel' | 'confirm_undo' | 'confirm_outcome';
  readonly decidedBy: 'user' | 'risk_judge';
  readonly scope?: string | undefined;
  readonly reason?: string | undefined;
  readonly answers?: string | undefined;
}

export interface ErrorContent {
  readonly code: string;
  readonly message: string;
  readonly interrupted?: boolean | undefined;
}

export interface InformationContent {
  readonly summary: string;
  readonly detail?: unknown;
}

export interface RemovalAnnouncementContent {
  readonly reason: 'retention_expiry' | 'user_deletion';
  readonly requestedBy: 'system' | 'user';
  readonly range: {
    readonly fromRecordedAt: string;
    readonly toRecordedAt: string;
    readonly recordCount: number;
  };
}

export interface SupersededVersionContent {
  readonly supersededRecord: string;
  readonly supersedingRecord: string;
  readonly supersededPayload: unknown;
  readonly supersededDevice: string;
}

// ── Discriminated Typed Ledger Record Types ─────────────────────────────────

export type LedgerRecordType =
  | 'intent'
  | 'result'
  | 'decision'
  | 'error'
  | 'information'
  | 'removal_announcement'
  | 'superseded_version';

interface BaseLedgerRecord {
  readonly recordId: string;
  readonly jobId: string;
  readonly position: number;
  readonly originDevice: string;
  readonly originSequence: number;
  readonly recordedAt: string;
  readonly references?: readonly string[] | undefined;
}

export interface IntentRecord extends BaseLedgerRecord {
  readonly type: 'intent';
  readonly correlationId: string;
  readonly content: IntentContent;
}

export interface ResultRecord extends BaseLedgerRecord {
  readonly type: 'result';
  readonly correlationId: string;
  readonly content: ResultContent;
}

export interface DecisionRecord extends BaseLedgerRecord {
  readonly type: 'decision';
  readonly correlationId?: undefined;
  readonly content: DecisionContent;
}

export interface ErrorRecord extends BaseLedgerRecord {
  readonly type: 'error';
  readonly correlationId?: undefined;
  readonly content: ErrorContent;
}

export interface InformationRecord extends BaseLedgerRecord {
  readonly type: 'information';
  readonly correlationId?: undefined;
  readonly content: InformationContent;
}

export interface RemovalAnnouncementRecord extends BaseLedgerRecord {
  readonly type: 'removal_announcement';
  readonly correlationId?: undefined;
  readonly content: RemovalAnnouncementContent;
}

export interface SupersededVersionRecord extends BaseLedgerRecord {
  readonly type: 'superseded_version';
  readonly correlationId?: undefined;
  readonly content: SupersededVersionContent;
}

export type TypedLedgerRecord =
  | IntentRecord
  | ResultRecord
  | DecisionRecord
  | ErrorRecord
  | InformationRecord
  | RemovalAnnouncementRecord
  | SupersededVersionRecord;

// ── Local-Write Inputs ──────────────────────────────────────────────────────

export interface AppendIntentInput {
  readonly jobId: string;
  readonly correlationId?: string | undefined;
  readonly connector: string;
  readonly tool: string;
  readonly parameters: unknown;
  readonly before: SnapshotOrUnavailable;
  readonly reversibility: Reversibility;
  readonly reconciliation?: unknown;
  readonly attachmentPaths?: readonly string[] | undefined;
}

export interface AppendResultInput {
  readonly jobId: string;
  readonly correlationId: string;
  readonly outcome: 'succeeded' | 'failed';
  readonly establishedBy: 'observed' | 'reconciled' | 'user_confirmed';
  readonly response?: unknown;
  readonly after?: SnapshotOrUnavailable | undefined;
  readonly compensatingAction?: CompensatingAction | undefined;
  readonly failure?: FailureDetail | undefined;
  readonly attachmentPaths?: readonly string[] | undefined;
}

export interface AppendDecisionInput {
  readonly jobId: string;
  readonly decision: 'approve' | 'deny' | 'cancel' | 'confirm_undo' | 'confirm_outcome';
  readonly decidedBy: 'user' | 'risk_judge';
  readonly scope?: string | undefined;
  readonly reason?: string | undefined;
  readonly answers?: string | undefined;
}

export interface AppendErrorInput {
  readonly jobId: string;
  readonly code: string;
  readonly message: string;
  readonly interrupted?: boolean | undefined;
  readonly references?: readonly string[] | undefined;
}

export interface AppendInformationInput {
  readonly jobId: string;
  readonly summary: string;
  readonly detail?: unknown;
  readonly references?: readonly string[] | undefined;
}

export interface AppendSupersededVersionInput {
  readonly jobId: string;
  readonly supersededRecord: string;
  readonly supersedingRecord: string;
  readonly supersededPayload: unknown;
  readonly supersededDevice: string;
  readonly references?: readonly string[] | undefined;
}

// ── Storage Projections ─────────────────────────────────────────────────────

export type JobState =
  | 'created'
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'waiting_input'
  | 'suspended'
  | 'recovering'
  | 'waiting_user_confirmation'
  | 'done'
  | 'failed'
  | 'cancelled';

export type ApprovalMode = 'off' | 'smart' | 'on';

export interface NewJob {
  readonly id: string;
  readonly originalRequest: string;
  readonly approvalMode?: ApprovalMode | undefined;
  readonly undoOf?: string | null | undefined;
}

export interface StoredJob {
  readonly id: string;
  readonly originalRequest: string;
  readonly state: JobState;
  readonly approvalMode: ApprovalMode;
  readonly summaryResult?: string | null | undefined;
  readonly undoOf?: string | null | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly stateChangedAt: string;
}

export interface JobStateTransition {
  readonly jobId: string;
  readonly sequence: number;
  readonly fromState: JobState | null;
  readonly toState: JobState;
  readonly changedAt: string;
}

export type ApprovalRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired';

export interface ApprovalRequest {
  readonly requestId: string;
  readonly jobId: string;
  readonly tool: string;
  readonly object?: {
    readonly connector: string;
    readonly resourceType: string;
    readonly id: string;
    readonly humanName?: string | undefined;
    readonly [k: string]: unknown;
  } | undefined;
  readonly beforeAfter?: Record<string, unknown> | undefined;
  readonly matched: readonly {
    readonly ruleId: string;
    readonly verdict: string;
    readonly [k: string]: unknown;
  }[];
  readonly reason: string;
  readonly expiresAt: string;
  readonly appealable: true;
}

export interface StoredApprovalRequest extends ApprovalRequest {
  readonly status: ApprovalRequestStatus;
  readonly createdAt: string;
  readonly decidedAt?: string | null | undefined;
  readonly decidedBy?: 'user' | 'risk_judge' | null | undefined;
}

export interface RecordQuery {
  readonly jobId?: string | undefined;
  readonly types?: readonly TypedLedgerRecord['type'][] | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly text?: string | undefined;
  readonly limit: number;
}

export interface UnresolvedIntent {
  readonly intent: IntentRecord;
  readonly correlationId: string;
  readonly jobId: string;
  readonly age: number;
}

export interface ShapeState {
  readonly current: number;
  readonly target: number;
  readonly pendingSteps: readonly number[];
}

export interface RemovalRange {
  readonly olderThan?: string | undefined;
  readonly jobIds?: readonly string[] | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

export interface RemovalOutcome {
  readonly announcement: string;
  readonly recordsRemoved: number;
  readonly attachmentsRemoved: number;
  readonly completed: boolean;
}

export interface RemovalRequest {
  readonly reason: 'retention_expiry' | 'user_deletion';
  readonly requestedBy: 'system' | 'user';
  readonly olderThan?: string | undefined;
  readonly jobIds?: readonly string[] | undefined;
  /**
   * Required when the reason is `user_deletion`. The deletion destroys history and the
   * material an undo would replay, so the acknowledgement has to come from whoever asked;
   * a confirmation the ledger writes for itself would record a decision nobody made.
   */
  readonly confirmation?: {
    readonly confirmed: true;
    readonly warnedUndoWillBeLost: true;
    readonly confirmedAt: string;
  } | undefined;
}

export interface ReadOnlyLedgerStore {
  read(query: RecordQuery): Promise<TypedLedgerRecord[]>;
  readJob(jobId: string): Promise<TypedLedgerRecord[]>;
  unresolvedIntents(): Promise<UnresolvedIntent[]>;
  shape(): Promise<ShapeState>;
  subscribe(listener: (record: TypedLedgerRecord) => void): () => void;
}
