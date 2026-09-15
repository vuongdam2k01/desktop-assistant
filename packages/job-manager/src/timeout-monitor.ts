import type { TimeoutMonitorOptions } from './types.js';

export const DEFAULT_EXECUTION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per PRD / NFR-PF-05
export const DEFAULT_WAITING_INPUT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes per SP-21 / req-021

interface JobTimeTracker {
  cumulativeActiveMs: number;
  runningStartedAt?: number | undefined;
  executionTimer?: NodeJS.Timeout | undefined;
  inquiryTimer?: NodeJS.Timeout | undefined;
}

/**
 * Tracks active execution time and inquiry timeouts per capabilities/job/spec.md:
 * - A job ends when active execution exceeds 10 minutes.
 * - Waiting states (waiting_approval, waiting_input, waiting_user_confirmation, suspended)
 *   do NOT consume execution time.
 * - Unanswered inquiry in waiting_input transitions to suspended after 30 minutes.
 */
export class TimeoutMonitor {
  readonly #executionTimeoutMs: number;
  readonly #waitingInputTimeoutMs: number;
  readonly #trackers = new Map<string, JobTimeTracker>();

  constructor(options?: TimeoutMonitorOptions) {
    this.#executionTimeoutMs = options?.executionTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
    this.#waitingInputTimeoutMs =
      options?.waitingInputTimeoutMs ?? DEFAULT_WAITING_INPUT_TIMEOUT_MS;
  }

  get executionTimeoutMs(): number {
    return this.#executionTimeoutMs;
  }

  get waitingInputTimeoutMs(): number {
    return this.#waitingInputTimeoutMs;
  }

  /**
   * Called when a job enters the 'running' state.
   * Resumes active execution tracking and starts the execution watchdog for remaining time.
   */
  startRunning(jobId: string, onExecutionTimeout: () => void): void {
    const tracker = this.#getOrCreateTracker(jobId);

    // If already running, do not reset runningStartedAt
    if (tracker.runningStartedAt !== undefined) {
      return;
    }

    tracker.runningStartedAt = Date.now();

    clearTimeout(tracker.inquiryTimer);
    tracker.inquiryTimer = undefined;

    clearTimeout(tracker.executionTimer);
    const remainingMs = Math.max(0, this.#executionTimeoutMs - tracker.cumulativeActiveMs);
    tracker.executionTimer = setTimeout(() => {
      onExecutionTimeout();
    }, remainingMs);
  }

  /**
   * Called when a job pauses (waiting_approval, waiting_input, waiting_user_confirmation, suspended)
   * or terminates (done, failed, cancelled).
   * Accumulates elapsed active running time and pauses the execution watchdog.
   */
  pauseRunning(jobId: string): void {
    const tracker = this.#trackers.get(jobId);
    if (!tracker || tracker.runningStartedAt === undefined) {
      return;
    }

    const elapsed = Date.now() - tracker.runningStartedAt;
    tracker.cumulativeActiveMs += elapsed;
    tracker.runningStartedAt = undefined;

    clearTimeout(tracker.executionTimer);
    tracker.executionTimer = undefined;
  }

  /**
   * Called when a job enters 'waiting_input'.
   * Starts the 30-minute inquiry timer that transitions the job to 'suspended' upon expiration.
   */
  startInquiryWatchdog(jobId: string, onInquiryTimeout: () => void): void {
    this.pauseRunning(jobId);
    const tracker = this.#getOrCreateTracker(jobId);

    clearTimeout(tracker.inquiryTimer);
    tracker.inquiryTimer = setTimeout(() => {
      onInquiryTimeout();
    }, this.#waitingInputTimeoutMs);
  }

  /**
   * Clears the inquiry watchdog when user answers the prompt.
   */
  clearInquiryWatchdog(jobId: string): void {
    const tracker = this.#trackers.get(jobId);
    if (tracker) {
      clearTimeout(tracker.inquiryTimer);
      tracker.inquiryTimer = undefined;
    }
  }

  getActiveRunningTimeMs(jobId: string): number {
    const tracker = this.#trackers.get(jobId);
    if (!tracker) {
      return 0;
    }
    const currentSegment =
      tracker.runningStartedAt !== undefined ? Date.now() - tracker.runningStartedAt : 0;
    return tracker.cumulativeActiveMs + currentSegment;
  }

  hasExceededExecutionTimeout(jobId: string): boolean {
    return this.getActiveRunningTimeMs(jobId) >= this.#executionTimeoutMs;
  }

  /**
   * Cleans up all timers and tracking data when a job completes or terminates.
   */
  cleanup(jobId: string): void {
    const tracker = this.#trackers.get(jobId);
    if (tracker) {
      clearTimeout(tracker.executionTimer);
      clearTimeout(tracker.inquiryTimer);
      this.#trackers.delete(jobId);
    }
  }

  #getOrCreateTracker(jobId: string): JobTimeTracker {
    let tracker = this.#trackers.get(jobId);
    if (!tracker) {
      tracker = { cumulativeActiveMs: 0 };
      this.#trackers.set(jobId, tracker);
    }
    return tracker;
  }
}
