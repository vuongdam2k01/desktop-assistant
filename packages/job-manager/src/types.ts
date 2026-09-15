import type {
  ApprovalMode,
  LedgerStore,
} from '@desktop-assistant/ledger-store';

/**
 * 11 strictly closed lifecycle states per capabilities/job/spec.md
 */
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

export type JobPriority = 'interactive' | 'background';

export interface Job {
  readonly id: string;
  readonly originalRequest: string;
  readonly state: JobState;
  readonly approvalMode: ApprovalMode;
  readonly priority: JobPriority;
  readonly connectorAccountId?: string | undefined;
  readonly requiredConnectors?: readonly string[] | undefined;
  readonly createdOnDevice: string;
  readonly summaryResult?: string | null | undefined;
  readonly failureReason?: string | null | undefined;
  readonly undoOf?: string | null | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly stateChangedAt: string;
}

export interface CreateJobInput {
  readonly id?: string | undefined;
  readonly originalRequest: string;
  readonly approvalMode?: ApprovalMode | undefined;
  readonly priority?: JobPriority | undefined;
  readonly connectorAccountId?: string | undefined;
  readonly requiredConnectors?: readonly string[] | undefined;
  readonly createdOnDevice?: string | undefined;
  readonly undoOf?: string | null | undefined;
}

export interface JobStateTransition {
  readonly jobId: string;
  readonly sequence: number;
  readonly fromState: JobState | null;
  readonly toState: JobState;
  readonly changedAt: string;
  readonly reason?: string | undefined;
}

export interface CompletedOperation {
  readonly recordId: string;
  readonly position: number;
  readonly tool: string;
  readonly connector: string;
  readonly outcome: 'succeeded' | 'failed';
  readonly isReversible: boolean;
  readonly recordedAt: string;
}

export interface FailureExplanation {
  readonly jobId: string;
  readonly reason: string;
  readonly completedOperations: readonly CompletedOperation[];
  readonly canUndo: boolean;
  readonly failureCode?: string | undefined;
  readonly heldByJobId?: string | undefined;
}

export interface ConnectorStatus {
  readonly connector: string;
  readonly connected: boolean;
  readonly tokenExpiresAt?: string | undefined;
  readonly canRenewWithoutUser: boolean;
}

export interface ConnectorStatusProvider {
  checkStatus(connector: string): Promise<ConnectorStatus>;
}

export interface ConnectorTokenRenewer {
  renewToken(connector: string): Promise<boolean>;
}

export interface ReconcileReadInput {
  readonly connector: string;
  readonly operation: string;
  readonly args?: Record<string, unknown> | undefined;
}

export interface ReconcileReadResult {
  readonly ok: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly unreachable?: boolean;
}

export interface ConnectorReconcileReader {
  executeRead(input: ReconcileReadInput): Promise<ReconcileReadResult>;
}

export type ReconcileOutcome =
  | { readonly conclusion: 'performed'; readonly observedState: unknown }
  | { readonly conclusion: 'not_performed'; readonly observedState: unknown }
  | { readonly conclusion: 'undetermined'; readonly reason: 'not_readable' | 'state_matches_neither' | 'target_gone' | 'read_refused'; readonly observedState?: unknown }
  | { readonly conclusion: 'unreachable'; readonly retryAfterMs?: number };

export interface JobSchedulerOptions {
  /** Total concurrent running jobs per connector account (default 4 per SP-15) */
  readonly concurrencyCap?: number;
  /** Slots reserved strictly for interactive user commands (default 1 per SP-15) */
  readonly reservedSlots?: number;
}

export interface RetryPolicyOptions {
  /** Maximum retry attempts for transient failures (default 3) */
  readonly maxRetries?: number;
  /** Base delay in ms (default 1000) */
  readonly baseDelayMs?: number;
  /** Max delay in ms (default 45000 per SP-15 429 penalty band) */
  readonly maxDelayMs?: number;
}
export interface TimeoutMonitorOptions {
  /** Maximum cumulative running time in ms, excluding waiting states (default 10 mins = 600,000ms) */
  readonly executionTimeoutMs?: number;
  /** Timeout in waiting_input before transitioning to suspended (default 30 mins = 1,800,000ms) */
  readonly waitingInputTimeoutMs?: number;
}

export interface PreFlightOptions {
  /** Token refresh threshold in ms before starting job (default 5 mins = 300,000ms) */
  readonly tokenRefreshMarginMs?: number;
}

export interface JobManagerOptions {
  readonly ledgerStore: LedgerStore;
  readonly currentDeviceId?: string | undefined;
  readonly scheduler?: JobSchedulerOptions | undefined;
  readonly retry?: RetryPolicyOptions | undefined;
  readonly timeout?: TimeoutMonitorOptions | undefined;
  readonly preFlight?: PreFlightOptions | undefined;
  readonly statusProvider?: ConnectorStatusProvider | undefined;
  readonly tokenRenewer?: ConnectorTokenRenewer | undefined;
  readonly reconcileReader?: ConnectorReconcileReader | undefined;
}

export interface JobEventMap {
  'job:created': (job: Job) => void;
  'job:state_changed': (payload: { job: Job; from: JobState | null; to: JobState; changedAt: string }) => void;
  'job:progress': (payload: { jobId: string; step: number; message: string }) => void;
  'job:completed': (job: Job) => void;
  'job:failed': (payload: { job: Job; explanation: FailureExplanation }) => void;
  'job:cancelled': (payload: { job: Job; stoppedAtStep?: number | undefined; completedOperations: readonly CompletedOperation[]; canUndo: boolean }) => void;
}
