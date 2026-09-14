import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { LedgerStoreError } from '../src/errors.js';
import { getInternalDatabaseForTesting } from '../src/internal-test.js';
import { createTestDir, makeIntentInput, type TestDir } from './helpers/test-env.js';

describe('Fail-Closed Scenarios (ledger spec)', () => {
  let testDir: TestDir;
  let dbPath: string;
  let store: LedgerStore;
  const deviceId = 'dev_fail_closed_1';

  beforeEach(async () => {
    testDir = createTestDir('fail-closed-');
    dbPath = testDir.dbPath();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('Scenario: Storage is full', async () => {
    await store.createJob({ id: 'job_full_disk', originalRequest: 'Simulated full storage' });

    // Restrict max_page_count to simulate a full disk / database full condition
    const storeDb = getInternalDatabaseForTesting(store);
    const currentPageCount = storeDb.prepare('PRAGMA page_count').pluck().get() as number;
    storeDb.pragma(`max_page_count = ${currentPageCount}`);

    let externalSentinelCalled = false;
    const externalToolCall = (): void => {
      externalSentinelCalled = true;
    };

    let rejectedError: unknown;
    try {
      // Must append large payload to force page allocation exceeding max_page_count
      const largeBlob = 'X'.repeat(64 * 1024);
      await store.appendIntent(
        makeIntentInput('job_full_disk', 'corr_full_1', {
          parameters: { payload: largeBlob },
        })
      );
      externalToolCall();
    } catch (err) {
      rejectedError = err;
    }

    // Assert: fail closed - ledger write failed, external tool call was NEVER made
    expect(externalSentinelCalled).toBe(false);
    expect(rejectedError).toBeInstanceOf(LedgerStoreError);
    expect((rejectedError as LedgerStoreError).code).toBe('LEDGER_WRITE_FAILED');
  });

  it('Scenario: A tool call proceeds on a record that is not yet durable', async () => {
    await store.createJob({ id: 'job_durable_check', originalRequest: 'Prove append resolves before call' });

    const orderOfEvents: string[] = [];
    const sentinelFile = path.join(testDir.path, 'sentinel.txt');

    // Pattern: append intent -> only then call external effect
    const correlationId = 'corr_durable_sync';
    const appendPromise = store.appendIntent(
      makeIntentInput('job_durable_check', correlationId)
    );

    await appendPromise.then((intent) => {
      orderOfEvents.push(`intent_resolved:${intent.recordId}`);
      fs.writeFileSync(sentinelFile, 'EFFECT_DONE', 'utf8');
      orderOfEvents.push('external_effect_executed');
    });

    expect(orderOfEvents).toEqual([
      expect.stringMatching(/^intent_resolved:/),
      'external_effect_executed',
    ]);
    expect(fs.existsSync(sentinelFile)).toBe(true);

    // Verify record exists in a fresh process / connection
    const verifyDb = new Database(dbPath);
    const row = verifyDb
      .prepare<[string], { record_id: string }>(
        'SELECT record_id FROM action_record WHERE correlation_id = ?'
      )
      .get(correlationId);
    verifyDb.close();

    expect(row).toBeDefined();
  });
});
