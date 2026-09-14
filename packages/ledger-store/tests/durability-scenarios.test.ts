import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  openLedgerStore,
  openAuxiliaryDatabase,
  durabilityPolicy,
} from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { createTestDir, makeIntentInput, type TestDir } from './helpers/test-env.js';

describe('Durability Scenarios (ledger spec)', () => {
  let testDir: TestDir;
  let dbPath: string;
  let store: LedgerStore;
  const deviceId = 'dev_durability_1';

  beforeEach(async () => {
    testDir = createTestDir('durability-');
    dbPath = testDir.dbPath();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('Scenario: Power is cut immediately after a record is reported written', async () => {
    await store.createJob({ id: 'job_power_cut', originalRequest: 'Durability commit verification' });

    const correlationId = 'corr_power_cut_1';
    // Append must be flushed and durable before promise resolves
    const intent = await store.appendIntent(makeIntentInput('job_power_cut', correlationId));

    // A completely fresh connection reading the database file immediately finds the record
    const independentDb = new Database(dbPath, { readonly: true });
    const row = independentDb
      .prepare<[string], { record_id: string; correlation_id: string }>(
        'SELECT record_id, correlation_id FROM action_record WHERE record_id = ?'
      )
      .get(intent.recordId);
    independentDb.close();

    expect(row).toBeDefined();
    expect(row!.correlation_id).toBe(correlationId);
  });

  it('Scenario: The operating system acknowledges a write before the hardware does', () => {
    // macOS requires FULL / fullfsync / checkpoint_fullfsync to ensure hardware drive flush
    const macPolicy = durabilityPolicy('darwin', 'authoritative');
    expect(macPolicy.journalMode).toBe('WAL');
    expect(macPolicy.synchronous).toBe('FULL');
    expect(macPolicy.fullfsync).toBe('ON');
    expect(macPolicy.checkpointFullfsync).toBe('ON');

    // Linux & Windows use NORMAL following SP-12 crash evidence
    const linuxPolicy = durabilityPolicy('linux', 'authoritative');
    expect(linuxPolicy.journalMode).toBe('WAL');
    expect(linuxPolicy.synchronous).toBe('NORMAL');
    expect(linuxPolicy.fullfsync).toBe('OFF');
    expect(linuxPolicy.checkpointFullfsync).toBe('OFF');

    const winPolicy = durabilityPolicy('win32', 'authoritative');
    expect(winPolicy.synchronous).toBe('NORMAL');
  });

  it('Scenario: A cache or scratch store is opened', () => {
    const auxPath = testDir.dbPath('scratch.db');
    const auxDb = openAuxiliaryDatabase({ path: auxPath });

    try {
      const auxPolicy = durabilityPolicy(process.platform, 'auxiliary');
      expect(auxPolicy.journalMode).toBe('WAL');
      expect(auxPolicy.synchronous).toBe('NORMAL');
      expect(auxPolicy.fullfsync).toBe('OFF');
      expect(auxPolicy.checkpointFullfsync).toBe('OFF');

      // Verify no ledger schema was created in auxiliary store
      const tables = auxDb
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'action_record'"
        )
        .all();
      expect(tables).toHaveLength(0);
    } finally {
      auxDb.close();
    }
  });

  it('Scenario: A write rate is assumed elsewhere in the design', () => {
    // On macOS, durability requires physical drive flush, reducing write throughput from ~28k to ~240/s (SP-12)
    const macPolicy = durabilityPolicy('darwin', 'authoritative');
    const auxPolicy = durabilityPolicy('darwin', 'auxiliary');

    // Authoritative policy enforces strict physical flush
    expect(macPolicy.synchronous).toBe('FULL');
    expect(macPolicy.fullfsync).toBe('ON');

    // Auxiliary policy allows OS-buffered throughput
    expect(auxPolicy.synchronous).toBe('NORMAL');
    expect(auxPolicy.fullfsync).toBe('OFF');
  });
});
