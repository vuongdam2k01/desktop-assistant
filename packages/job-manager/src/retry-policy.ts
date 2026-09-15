import type { LedgerStore } from '@desktop-assistant/ledger-store';
import type { RetryPolicyOptions } from './types.js';
import { ResourceHeldError } from './errors.js';

export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_BASE_DELAY_MS = 1000;
export const DEFAULT_MAX_DELAY_MS = 45000; // 45s max per SP-15 429 penalty band

export interface OperationErrorInput {
  readonly code?: string | undefined;
  readonly message: string;
  readonly retryable?: boolean | undefined;
  readonly retryAfterMs?: number | undefined;
  readonly heldByJobId?: string | undefined;
  readonly heldBy?: string | readonly string[] | undefined;
}

export type ErrorCategory = 'transient' | 'permanent';

/**
 * Standard transient error codes from connector adapter and resource coordinator
 */
const TRANSIENT_CODES: Readonly<Record<string, boolean>> = {
  RATE_LIMITED: true,
  UNREACHABLE: true,
  RESOURCE_HELD: true,
};

/**
 * Explicit permanent error codes
 */
const PERMANENT_CODES: Readonly<Record<string, boolean>> = {
  PERMISSION_DENIED: true,
  CONNECTOR_REVOKED: true,
  CONNECTOR_EXPIRED: true,
  CONNECTOR_DISCONNECTED: true,
  NOT_FOUND: true,
  INVALID_PARAMS: true,
  CONFLICT: true,
  UNSUPPORTED: true,
  SNAPSHOT_UNREADABLE: true,
};

export class RetryPolicy {
  readonly #maxRetries: number;
  readonly #baseDelayMs: number;
  readonly #maxDelayMs: number;
  readonly #ledgerStore: LedgerStore;

  constructor(ledgerStore: LedgerStore, options?: RetryPolicyOptions) {
    this.#ledgerStore = ledgerStore;
    this.#maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.#maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  }

  get maxRetries(): number {
    return this.#maxRetries;
  }

  /**
   * Classifies an error into 'transient' or 'permanent' based strictly on declared error code.
   * A failure carrying no declared code is treated as permanent (capabilities/job/spec.md).
   */
  classify(error: OperationErrorInput): ErrorCategory {
    if (!error.code || error.code.trim().length === 0) {
      return 'permanent';
    }

    const code = error.code.trim().toUpperCase();

    if (TRANSIENT_CODES[code] === true) {
      return 'transient';
    }

    if (PERMANENT_CODES[code] === true) {
      return 'permanent';
    }

    // If connector error explicitly stated retryable flag
    if (error.retryable === true) {
      return 'transient';
    }

    return 'permanent';
  }

  /**
   * Computes backoff delay in ms for a given attempt (1-indexed).
   * Honors retryAfterMs when provided by the platform.
   */
  calculateDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined && retryAfterMs > 0) {
      return Math.min(this.#maxDelayMs, retryAfterMs);
    }
    const exponential = this.#baseDelayMs * Math.pow(2, attempt - 1);
    return Math.min(this.#maxDelayMs, exponential);
  }

  /**
   * Executes a tool operation with bounded retries and ledger recording for each retry.
   * Enforces tool-call boundary cancellation before each attempt, including during retries.
   */
  async executeWithRetry<T>(
    jobId: string,
    operationName: string,
    fn: (attempt: number) => Promise<T>,
    checkBoundary?: (attempt: number) => void
  ): Promise<T> {
    let attempt = 1;

    while (attempt <= this.#maxRetries + 1) {
      // Check cancellation / timeout boundary before each attempt
      checkBoundary?.(attempt);

      try {
        return await fn(attempt);
      } catch (err: unknown) {
        const opError = this.#normalizeError(err);
        const category = this.classify(opError);
        const normalizedCode = (opError.code || '').trim().toUpperCase();

        // 1. Permanent error -> fail immediately without consuming retries
        if (category === 'permanent') {
          throw err;
        }

        // 2. Retries exhausted
        if (attempt > this.#maxRetries) {
          if (normalizedCode === 'RESOURCE_HELD') {
            throw new ResourceHeldError(jobId, opError.heldByJobId);
          }
          throw err;
        }

        // 3. Record retry into Action Ledger (Constitution III / Spec requirement)
        await this.#ledgerStore.appendError({
          jobId,
          code: opError.code || 'TRANSIENT_FAILURE',
          message: `Attempt ${attempt} of ${operationName} failed: ${opError.message}. Retrying...`,
          interrupted: false,
        });

        // 4. Delay before next attempt (checks boundary immediately after waking)
        const delayMs = this.calculateDelay(attempt, opError.retryAfterMs);
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, delayMs);
        await promise;

        // Verify boundary after sleep before next iteration
        checkBoundary?.(attempt + 1);

        attempt++;
      }
    }

    throw new Error(`Unexpected retry loop termination for job ${jobId}`);
  }

  #normalizeError(err: unknown): OperationErrorInput {
    if (err && typeof err === 'object') {
      const code = 'code' in err && typeof err.code === 'string' ? err.code : undefined;
      const message =
        'message' in err && typeof err.message === 'string' ? err.message : String(err);
      const retryable =
        'retryable' in err && typeof err.retryable === 'boolean' ? err.retryable : undefined;
      const retryAfterMs =
        'retryAfterMs' in err && typeof err.retryAfterMs === 'number'
          ? err.retryAfterMs
          : undefined;

      let heldByJobId: string | undefined;
      if ('heldByJobId' in err && typeof err.heldByJobId === 'string') {
        heldByJobId = err.heldByJobId;
      } else if ('heldBy' in err) {
        if (typeof err.heldBy === 'string') {
          heldByJobId = err.heldBy;
        } else if (Array.isArray(err.heldBy)) {
          heldByJobId = err.heldBy
            .filter((item): item is string => typeof item === 'string')
            .join(', ');
        }
      }

      return { code, message, retryable, retryAfterMs, heldByJobId };
    }

    return { message: String(err) };
  }
}
