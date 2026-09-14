import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openLedgerStore, LedgerStoreError } from '../src/index.js';
import type { LedgerStore } from '../src/index.js';
import { getInternalDatabaseForTesting } from '../src/internal-test.js';
import { createTestDir, makeIntentInput, type TestDir } from './helpers/test-env.js';

/**
 * Exercises the store the way a caller outside this package would: through the public
 * entry point only, and through the sequence a tool call has to follow — record the
 * intent, and perform the external effect only once that record is durable. The other
 * suites reach for internal modules, so they cannot show that the surface a consumer
 * actually imports carries the same guarantee.
 */
describe('Ledger obligations at the consumer boundary', () => {
  let testDir: TestDir;
  let dbPath: string;
  let store: LedgerStore;
  const deviceId = 'dev_consumer_boundary';

  beforeEach(async () => {
    testDir = createTestDir('consumer-boundary-');
    dbPath = testDir.dbPath();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  /**
   * The shape every wrapped tool call has to take: the ledger record is written first,
   * and the external effect runs only if that write resolved.
   */
  async function callToolThroughLedger(
    jobId: string,
    correlationId: string,
    effect: () => void
  ): Promise<void> {
    await store.appendIntent(makeIntentInput(jobId, correlationId));
    effect();
  }

  it('performs the external effect only after the record is durable on disk', async () => {
    await store.createJob({ id: 'job_boundary_ok', originalRequest: 'Record then act' });

    const correlationId = 'corr_boundary_ok';
    let recordVisibleWhenEffectRan: boolean | undefined;

    await callToolThroughLedger('job_boundary_ok', correlationId, () => {
      const verifyDb = new Database(dbPath, { readonly: true });
      const row = verifyDb
        .prepare<[string], { record_id: string }>(
          'SELECT record_id FROM action_record WHERE correlation_id = ?'
        )
        .get(correlationId);
      verifyDb.close();
      recordVisibleWhenEffectRan = row !== undefined;
    });

    expect(recordVisibleWhenEffectRan).toBe(true);
  });

  it('withholds the external effect when the ledger write fails', async () => {
    await store.createJob({ id: 'job_boundary_closed', originalRequest: 'Refuse to act' });

    const internalDb = getInternalDatabaseForTesting(store);
    const pageCount = internalDb.prepare('PRAGMA page_count').pluck().get() as number;
    internalDb.pragma(`max_page_count = ${pageCount}`);

    let effectRan = false;
    let raised: unknown;

    try {
      await store.appendIntent(
        makeIntentInput('job_boundary_closed', 'corr_boundary_closed', {
          parameters: { payload: 'X'.repeat(64 * 1024) },
        })
      );
      effectRan = true;
    } catch (err) {
      raised = err;
    }

    expect(effectRan).toBe(false);
    expect(raised).toBeInstanceOf(LedgerStoreError);
    expect((raised as LedgerStoreError).code).toBe('LEDGER_WRITE_FAILED');
  });

  it('leaves no record behind for a write that failed', async () => {
    await store.createJob({ id: 'job_boundary_gap', originalRequest: 'No phantom records' });

    const internalDb = getInternalDatabaseForTesting(store);
    const pageCount = internalDb.prepare('PRAGMA page_count').pluck().get() as number;
    internalDb.pragma(`max_page_count = ${pageCount}`);

    await expect(
      store.appendIntent(
        makeIntentInput('job_boundary_gap', 'corr_boundary_gap', {
          parameters: { payload: 'X'.repeat(64 * 1024) },
        })
      )
    ).rejects.toBeInstanceOf(LedgerStoreError);

    internalDb.pragma('max_page_count = 1073741823');

    const verifyDb = new Database(dbPath, { readonly: true });
    const row = verifyDb
      .prepare<[string], { record_id: string }>(
        'SELECT record_id FROM action_record WHERE correlation_id = ?'
      )
      .get('corr_boundary_gap');
    verifyDb.close();

    expect(row).toBeUndefined();
  });
});
