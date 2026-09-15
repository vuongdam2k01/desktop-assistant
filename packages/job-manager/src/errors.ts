export type JobManagerErrorCode =
  | 'JOB_NOT_FOUND'
  | 'TERMINAL_STATE_IMMUTABLE'
  | 'INVALID_STATE_TRANSITION'
  | 'JOB_ADMISSION_REJECTED'
  | 'JOB_CANCELLED'
  | 'JOB_TIMEOUT'
  | 'PRE_FLIGHT_FAILED'
  | 'RESOURCE_HELD_EXHAUSTED'
  | 'RECONCILIATION_UNDETERMINED'
  | 'FOREIGN_DEVICE_EXECUTION_FORBIDDEN';

export class JobManagerError extends Error {
  readonly code: JobManagerErrorCode;
  readonly details?: Record<string, unknown> | undefined;

  constructor(code: JobManagerErrorCode, message: string, details?: Record<string, unknown>) {
    super(`[${code}] ${message}`);
    this.name = 'JobManagerError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TerminalStateError extends JobManagerError {
  constructor(jobId: string, currentState: string, attemptedState: string) {
    super(
      'TERMINAL_STATE_IMMUTABLE',
      `Job "${jobId}" is in terminal state "${currentState}" and cannot be transitioned to "${attemptedState}". Events after terminal state must be recorded against the job without reopening it.`,
      { jobId, currentState, attemptedState }
    );
    this.name = 'TerminalStateError';
  }
}

export class InvalidStateTransitionError extends JobManagerError {
  constructor(jobId: string, fromState: string, toState: string) {
    super(
      'INVALID_STATE_TRANSITION',
      `Invalid state transition for job "${jobId}" from "${fromState}" to "${toState}".`,
      { jobId, fromState, toState }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class JobCancelledError extends JobManagerError {
  readonly stoppedAtStep?: number | undefined;

  constructor(jobId: string, stoppedAtStep?: number) {
    super(
      'JOB_CANCELLED',
      `Job "${jobId}" was cancelled at tool-call boundary${stoppedAtStep !== undefined ? ` at step ${stoppedAtStep}` : ''}.`,
      { jobId, stoppedAtStep }
    );
    this.name = 'JobCancelledError';
    this.stoppedAtStep = stoppedAtStep;
  }
}

export class JobTimeoutError extends JobManagerError {
  readonly elapsedActiveMs: number;
  readonly limitMs: number;

  constructor(jobId: string, elapsedActiveMs: number, limitMs: number) {
    super(
      'JOB_TIMEOUT',
      `Job "${jobId}" exceeded its configured execution time limit of ${Math.round(limitMs / 1000)}s (active running time: ${Math.round(elapsedActiveMs / 1000)}s, waiting time excluded).`,
      { jobId, elapsedActiveMs, limitMs }
    );
    this.name = 'JobTimeoutError';
    this.elapsedActiveMs = elapsedActiveMs;
    this.limitMs = limitMs;
  }
}

export class ResourceHeldError extends JobManagerError {
  readonly heldByJobId?: string | undefined;

  constructor(jobId: string, heldByJobId?: string) {
    super(
      'RESOURCE_HELD_EXHAUSTED',
      `Job "${jobId}" failed because a required resource was held by ${heldByJobId ? `job "${heldByJobId}"` : 'another job'} after retries were exhausted.`,
      { jobId, heldByJobId }
    );
    this.name = 'ResourceHeldError';
    this.heldByJobId = heldByJobId;
  }
}

export class PreFlightError extends JobManagerError {
  readonly connector: string;
  readonly requiresReconnection: boolean;

  constructor(jobId: string, connector: string, message: string, requiresReconnection: boolean) {
    super(
      'PRE_FLIGHT_FAILED',
      `Pre-flight check failed for job "${jobId}" on connector "${connector}": ${message}`,
      { jobId, connector, requiresReconnection }
    );
    this.name = 'PreFlightError';
    this.connector = connector;
    this.requiresReconnection = requiresReconnection;
  }
}

export class ForeignDeviceExecutionError extends JobManagerError {
  readonly createdOnDevice: string;
  readonly currentDevice: string;

  constructor(jobId: string, createdOnDevice: string, currentDevice: string) {
    super(
      'FOREIGN_DEVICE_EXECUTION_FORBIDDEN',
      `Job "${jobId}" was created on device "${createdOnDevice}" and cannot be executed on current device "${currentDevice}" (Constitution VII / AC-28).`,
      { jobId, createdOnDevice, currentDevice }
    );
    this.name = 'ForeignDeviceExecutionError';
    this.createdOnDevice = createdOnDevice;
    this.currentDevice = currentDevice;
  }
}
