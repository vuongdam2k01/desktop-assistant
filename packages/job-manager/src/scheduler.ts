import type { Job, JobPriority, JobSchedulerOptions, JobState } from './types.js';
import { JobCancelledError } from './errors.js';
export interface AdmissionAccountPolicy {
  readonly concurrencyCap: number;
  readonly reservedSlots: number;
}

interface QueuedEntry {
  readonly job: Job;
  readonly resolve: (admitted: boolean) => void;
  readonly reject: (reason?: unknown) => void;
}

interface AccountPool {
  readonly runningJobIds: Set<string>;
  readonly interactiveQueue: QueuedEntry[];
  readonly backgroundQueue: QueuedEntry[];
  policy: AdmissionAccountPolicy;
}

export const DEFAULT_CONCURRENCY_CAP = 4;
export const DEFAULT_RESERVED_SLOTS = 1;

/**
 * States where a job is paused waiting for external/human action and MUST release its admission slot
 */
const WAITING_STATES: Readonly<Record<JobState, boolean>> = {
  waiting_approval: true,
  waiting_input: true,
  waiting_user_confirmation: true,
  suspended: true,
  created: false,
  queued: false,
  running: false,
  recovering: false,
  done: false,
  failed: false,
  cancelled: false,
};

export class JobScheduler {
  readonly #defaultPolicy: AdmissionAccountPolicy;
  readonly #accountPools = new Map<string, AccountPool>();

  constructor(options?: JobSchedulerOptions) {
    const concurrencyCap = Math.max(1, options?.concurrencyCap ?? DEFAULT_CONCURRENCY_CAP);
    const reservedSlots = Math.min(
      concurrencyCap - 1,
      Math.max(0, options?.reservedSlots ?? DEFAULT_RESERVED_SLOTS)
    );
    this.#defaultPolicy = { concurrencyCap, reservedSlots };
  }

  setAccountPolicy(accountId: string, policy: Partial<AdmissionAccountPolicy>): void {
    const pool = this.#getOrCreatePool(accountId);
    const concurrencyCap = Math.max(1, policy.concurrencyCap ?? pool.policy.concurrencyCap);
    const reservedSlots = Math.min(
      concurrencyCap - 1,
      Math.max(0, policy.reservedSlots ?? pool.policy.reservedSlots)
    );
    pool.policy = { concurrencyCap, reservedSlots };
    this.#drainPool(pool);
  }

  getRunningCount(accountId?: string): number {
    const key = accountId || 'default:local';
    const pool = this.#accountPools.get(key);
    return pool ? pool.runningJobIds.size : 0;
  }

  getQueuedCount(accountId?: string): number {
    const key = accountId || 'default:local';
    const pool = this.#accountPools.get(key);
    return pool ? pool.interactiveQueue.length + pool.backgroundQueue.length : 0;
  }

  isSlotAvailable(priority: JobPriority, accountId?: string): boolean {
    const key = accountId || 'default:local';
    const pool = this.#getOrCreatePool(key);
    const running = pool.runningJobIds.size;
    const { concurrencyCap, reservedSlots } = pool.policy;

    if (priority === 'interactive') {
      return running < concurrencyCap;
    }
    const unreservedCap = Math.max(0, concurrencyCap - reservedSlots);
    return running < unreservedCap;
  }

  /**
   * Attempts to acquire an execution slot for the job.
   * If a slot is free, resolves immediately with true (Admitted).
   * If full, queues the job and resolves with true when a slot is later granted.
   */
  async acquireSlot(job: Job): Promise<boolean> {
    const key = job.connectorAccountId || 'default:local';
    const pool = this.#getOrCreatePool(key);

    // Reentrancy: if this job already holds a slot, return true immediately
    if (pool.runningJobIds.has(job.id)) {
      return true;
    }

    if (this.isSlotAvailable(job.priority, key)) {
      pool.runningJobIds.add(job.id);
      return true;
    }

    // Queue job based on priority
    const { promise, resolve, reject } = Promise.withResolvers<boolean>();
    const entry: QueuedEntry = { job, resolve, reject };
    if (job.priority === 'interactive') {
      pool.interactiveQueue.push(entry);
    } else {
      pool.backgroundQueue.push(entry);
    }
    return promise;
  }

  /**
   * Releases the slot held by a job.
   * Must be called when a job finishes, fails, cancels, or enters a waiting state
   * (waiting_approval, waiting_input, waiting_user_confirmation, suspended).
   */
  releaseSlot(jobId: string, accountId?: string): void {
    const key = accountId || 'default:local';
    const pool = this.#accountPools.get(key);
    if (!pool) {
      return;
    }

    const removed = pool.runningJobIds.delete(jobId);
    if (removed) {
      this.#drainPool(pool);
    }
  }

  /**
   * Cancels a job that is currently queued awaiting admission.
   * Removes it from the queue and rejects its pending acquireSlot promise.
   */
  cancelQueued(jobId: string, error?: unknown): boolean {
    const err = error || new JobCancelledError(jobId);
    for (const pool of this.#accountPools.values()) {
      const iIdx = pool.interactiveQueue.findIndex((e) => e.job.id === jobId);
      if (iIdx !== -1) {
        const [entry] = pool.interactiveQueue.splice(iIdx, 1);
        if (entry) {
          entry.reject(err);
          return true;
        }
      }

      const bIdx = pool.backgroundQueue.findIndex((e) => e.job.id === jobId);
      if (bIdx !== -1) {
        const [entry] = pool.backgroundQueue.splice(bIdx, 1);
        if (entry) {
          entry.reject(err);
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Handles state changes to release or acquire slots accordingly.
   */
  onJobStateChanged(job: Job, fromState: JobState | null, toState: JobState): void {
    const key = job.connectorAccountId || 'default:local';

    // If entering a waiting state, release slot so queued jobs can proceed
    if (WAITING_STATES[toState] === true) {
      this.releaseSlot(job.id, key);
      return;
    }

    // If leaving a terminal state (finished/failed/cancelled), ensure slot is released
    if (toState === 'done' || toState === 'failed' || toState === 'cancelled') {
      this.releaseSlot(job.id, key);
      return;
    }
  }

  #getOrCreatePool(key: string): AccountPool {
    let pool = this.#accountPools.get(key);
    if (!pool) {
      pool = {
        runningJobIds: new Set<string>(),
        interactiveQueue: [],
        backgroundQueue: [],
        policy: { ...this.#defaultPolicy },
      };
      this.#accountPools.set(key, pool);
    }
    return pool;
  }

  #drainPool(pool: AccountPool): void {
    const { concurrencyCap, reservedSlots } = pool.policy;
    const unreservedCap = Math.max(0, concurrencyCap - reservedSlots);

    // 1. Drain interactive queue while running < concurrencyCap
    while (pool.interactiveQueue.length > 0 && pool.runningJobIds.size < concurrencyCap) {
      const entry = pool.interactiveQueue.shift();
      if (entry) {
        pool.runningJobIds.add(entry.job.id);
        entry.resolve(true);
      }
    }

    // 2. Drain background queue while running < unreservedCap
    while (pool.backgroundQueue.length > 0 && pool.runningJobIds.size < unreservedCap) {
      const entry = pool.backgroundQueue.shift();
      if (entry) {
        pool.runningJobIds.add(entry.job.id);
        entry.resolve(true);
      }
    }
  }
}
