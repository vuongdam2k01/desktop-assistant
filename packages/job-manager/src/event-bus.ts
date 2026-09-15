import { EventEmitter } from 'node:events';
import type { JobEventMap } from './types.js';

/**
 * In-memory typed event bus for job lifecycle events
 */
export class JobEventBus {
  readonly #emitter = new EventEmitter();

  constructor() {
    this.#emitter.setMaxListeners(100);
  }

  on<K extends keyof JobEventMap>(event: K, listener: JobEventMap[K]): () => void {
    this.#emitter.on(event, listener as (...args: unknown[]) => void);
    return () => {
      this.#emitter.off(event, listener as (...args: unknown[]) => void);
    };
  }

  emit<K extends keyof JobEventMap>(event: K, ...args: Parameters<JobEventMap[K]>): boolean {
    return this.#emitter.emit(event, ...args);
  }

  removeAllListeners(event?: keyof JobEventMap): void {
    this.#emitter.removeAllListeners(event);
  }
}
