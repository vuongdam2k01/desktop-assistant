import type { GateHealth, EvaluationErrorCode } from '../types.js';

export class GateHealthTracker {
  #status: 'open' | 'stopped' | 'degraded' = 'open';
  #reason?: string | undefined;
  #haltedAt?: string | undefined;
  #errorCode?: EvaluationErrorCode | undefined;

  get health(): GateHealth {
    return {
      status: this.#status,
      reason: this.#reason,
      haltedAt: this.#haltedAt,
    };
  }

  get isStopped(): boolean {
    return this.#status === 'stopped';
  }

  get errorCode(): EvaluationErrorCode | undefined {
    return this.#errorCode;
  }

  setOpen(): void {
    this.#status = 'open';
    this.#reason = undefined;
    this.#haltedAt = undefined;
    this.#errorCode = undefined;
  }

  setStopped(code: EvaluationErrorCode, reason: string): void {
    this.#status = 'stopped';
    this.#reason = reason;
    this.#haltedAt = new Date().toISOString();
    this.#errorCode = code;
  }

  setDegraded(reason: string): void {
    this.#status = 'degraded';
    this.#reason = reason;
  }
}
