import type { LedgerStore, StoredJob } from '@desktop-assistant/ledger-store';
import type { Job, JobState } from './types.js';
import {
  InvalidStateTransitionError,
  JobManagerError,
  TerminalStateError,
} from './errors.js';

/**
 * Terminal states are closed and final per capabilities/job/spec.md
 */
export const TERMINAL_STATES: Readonly<Record<JobState, boolean>> = {
  done: true,
  failed: true,
  cancelled: true,
  created: false,
  queued: false,
  running: false,
  waiting_approval: false,
  waiting_input: false,
  suspended: false,
  recovering: false,
  waiting_user_confirmation: false,
};

/**
 * Valid directed edges in the job lifecycle state machine
 */
const VALID_TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  created: ['queued', 'running', 'recovering', 'cancelled'],
  queued: ['running', 'recovering', 'cancelled'],
  running: [
    'waiting_approval',
    'waiting_input',
    'waiting_user_confirmation',
    'suspended',
    'recovering',
    'done',
    'failed',
    'cancelled',
  ],
  waiting_approval: ['running', 'recovering', 'cancelled', 'failed'],
  waiting_input: ['running', 'suspended', 'recovering', 'cancelled', 'failed'],
  suspended: ['running', 'recovering', 'cancelled', 'failed'],
  recovering: [
    'running',
    'done',
    'failed',
    'waiting_user_confirmation',
    'cancelled',
  ],
  waiting_user_confirmation: ['running', 'done', 'failed', 'cancelled'],
  done: [],
  failed: [],
  cancelled: [],
};

export interface TransitionOptions {
  readonly changedAt?: string | undefined;
  readonly reason?: string | undefined;
  readonly summaryResult?: string | null | undefined;
}

export class JobStateMachine {
  readonly #ledgerStore: LedgerStore;
  readonly #jobLocks = new Map<string, Promise<void>>();

  constructor(ledgerStore: LedgerStore) {
    this.#ledgerStore = ledgerStore;
  }
  isTerminal(state: JobState): boolean {
    return TERMINAL_STATES[state] === true;
  }

  canTransition(fromState: JobState, toState: JobState): boolean {
    if (fromState === toState) {
      return true;
    }
    if (TERMINAL_STATES[fromState] === true) {
      return false;
    }
    const allowed = VALID_TRANSITIONS[fromState];
    return allowed !== undefined && allowed.includes(toState);
  }

  /**
   * Transitions a job to a target state, enforcing terminal immutability, valid transition
   * matrix, timestamp tracking, and atomic persistence into SQLite ledger store.
   */
  async transition(
    job: Job,
    toState: JobState,
    options?: TransitionOptions
  ): Promise<Job> {
    const prevLock = this.#jobLocks.get(job.id) || Promise.resolve();
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#jobLocks.set(job.id, promise);

    try {
      await prevLock;
      return await this.#doTransition(job, toState, options);
    } finally {
      resolve();
      if (this.#jobLocks.get(job.id) === promise) {
        this.#jobLocks.delete(job.id);
      }
    }
  }

  async #doTransition(
    job: Job,
    toState: JobState,
    options?: TransitionOptions
  ): Promise<Job> {
    // Read fresh state from store for atomic CAS checking
    const stored = await this.#ledgerStore.getJob(job.id);
    const fromState = stored ? stored.state : job.state;

    // 1. Terminal state check: terminal states are final and cannot be reopened
    if (TERMINAL_STATES[fromState] === true) {
      if (fromState === toState) {
        return { ...job, state: fromState };
      }
      throw new TerminalStateError(job.id, fromState, toState);
    }

    // 2. Identity transition
    if (fromState === toState) {
      return { ...job, state: fromState };
    }

    // 3. Directed graph validation
    const allowed = VALID_TRANSITIONS[fromState];
    if (!allowed || !allowed.includes(toState)) {
      throw new InvalidStateTransitionError(job.id, fromState, toState);
    }

    const changedAt = options?.changedAt || new Date().toISOString();

    // 4. Persistence into SQLite job and job_state_transition tables
    let updatedStoredJob: StoredJob;
    try {
      updatedStoredJob = await this.#ledgerStore.setJobState(
        job.id,
        toState,
        changedAt,
        options?.summaryResult
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('JOB_UNKNOWN')) {
        throw new JobManagerError('JOB_NOT_FOUND', `Job "${job.id}" not found in ledger store.`, {
          cause: err,
        });
      }
      throw err;
    }

    return {
      ...job,
      state: updatedStoredJob.state,
      summaryResult:
        options?.summaryResult !== undefined
          ? options.summaryResult
          : updatedStoredJob.summaryResult,
      updatedAt: updatedStoredJob.updatedAt,
      stateChangedAt: updatedStoredJob.stateChangedAt,
    };
  }
}
