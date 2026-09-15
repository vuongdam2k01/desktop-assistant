import { JobCancelledError } from './errors.js';

interface CancellationRecord {
  readonly requestedAt: string;
  readonly reason?: string | undefined;
  stoppedAtStep?: number | undefined;
}

/**
 * Manages cooperative cancellation at tool-call boundaries per capabilities/job/spec.md
 * (Requirement: Cancellation stops at a tool-call boundary).
 *
 * In-flight tool calls are permitted to finish over the network and commit to the ledger;
 * the cancellation barrier intercepts execution before any subsequent tool call is made.
 */
export class CancellationBarrier {
  readonly #cancellations = new Map<string, CancellationRecord>();

  /**
   * Signals that a job should be cancelled.
   * Does not abort in-flight network requests abruptly.
   */
  requestCancellation(jobId: string, reason?: string): boolean {
    if (this.#cancellations.has(jobId)) {
      return false;
    }
    this.#cancellations.set(jobId, {
      requestedAt: new Date().toISOString(),
      reason,
    });
    return true;
  }

  isCancelled(jobId: string): boolean {
    return this.#cancellations.has(jobId);
  }

  getCancellationRecord(jobId: string): CancellationRecord | undefined {
    return this.#cancellations.get(jobId);
  }

  /**
   * Checks the boundary before starting a tool call.
   * Throws JobCancelledError if cancellation has been requested.
   */
  checkBoundary(jobId: string, nextStep?: number): void {
    const record = this.#cancellations.get(jobId);
    if (record) {
      if (nextStep !== undefined && record.stoppedAtStep === undefined) {
        record.stoppedAtStep = Math.max(0, nextStep - 1);
      }
      throw new JobCancelledError(jobId, record.stoppedAtStep);
    }
  }

  /**
   * Records the completion of a tool call and checks whether a cancellation was requested
   * while the call was in-flight.
   *
   * If cancelled, sets the exact stopping point and throws JobCancelledError so the loop stops.
   */
  onToolCallCompleted(jobId: string, completedStep: number): void {
    const record = this.#cancellations.get(jobId);
    if (record) {
      record.stoppedAtStep = completedStep;
      throw new JobCancelledError(jobId, completedStep);
    }
  }

  /**
   * Cleans up cancellation state when a job has reached a terminal state.
   */
  clear(jobId: string): void {
    this.#cancellations.delete(jobId);
  }
}
