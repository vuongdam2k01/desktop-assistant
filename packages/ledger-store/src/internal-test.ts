import type Database from 'better-sqlite3';
import type { LedgerStore } from './ledger-store.js';

const internalDbMap = new WeakMap<LedgerStore, Database.Database>();

/**
 * Registers internal database instance for test-only fault injection.
 * Not exported in package index.ts.
 */
export function registerInternalDatabase(store: LedgerStore, db: Database.Database): void {
  internalDbMap.set(store, db);
}

/**
 * Retrieves internal database instance for testing.
 * Not exported in package index.ts.
 */
export function getInternalDatabaseForTesting(store: LedgerStore): Database.Database {
  const db = internalDbMap.get(store);
  if (!db) {
    throw new Error('No internal database registered for store instance.');
  }
  return db;
}
