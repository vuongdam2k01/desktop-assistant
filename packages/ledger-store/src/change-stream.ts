import type { TypedLedgerRecord } from './types.js';

export type RecordListener = (record: TypedLedgerRecord) => void;

/**
 * In-memory notification stream for committed ledger records.
 * Emits committed records in position order after SQLite transactions commit.
 * Isolates listener exceptions so that a listener failure never affects transaction durability.
 */
export class ChangeStream {
  private readonly listeners = new Set<RecordListener>();

  subscribe(listener: RecordListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(record: TypedLedgerRecord): void {
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch (err: unknown) {
        // Isolate listener exceptions: durable write has succeeded, stream loss is recoverable via readJob
        console.error('Ledger change listener error (isolated):', err);
      }
    }
  }

  emitMany(records: readonly TypedLedgerRecord[]): void {
    for (const record of records) {
      this.emit(record);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
