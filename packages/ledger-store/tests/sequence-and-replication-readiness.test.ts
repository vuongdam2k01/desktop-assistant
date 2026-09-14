import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import {
  createTestDir,
  makeIntentInput,
  makeSupersededVersionInput,
  type TestDir,
} from './helpers/test-env.js';

describe('Sequence and Replication Readiness Scenarios (ledger spec)', () => {
  let testDir: TestDir;
  let dbPath: string;
  let store: LedgerStore;
  const deviceId = 'dev_seq_local';

  beforeEach(async () => {
    testDir = createTestDir('seq-repl-');
    dbPath = testDir.dbPath();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it("Scenario: A device's sequence does not restart", async () => {
    await store.createJob({ id: 'job_seq_restart', originalRequest: 'Verify sequence monotonic across reopen' });

    // Step 1: Write first record
    const rec1 = await store.appendIntent(makeIntentInput('job_seq_restart', 'corr_s1'));
    expect(rec1.originSequence).toBe(0);

    const rec2 = await store.appendIntent(makeIntentInput('job_seq_restart', 'corr_s2'));
    expect(rec2.originSequence).toBe(1);

    // Close and reopen the store
    await store.close();

    const reopenedStore = await openLedgerStore({ path: dbPath, deviceId });

    try {
      const rec3 = await reopenedStore.appendIntent(makeIntentInput('job_seq_restart', 'corr_s3'));
      // Sequence continues strictly from previous value (2), never resets to 0
      expect(rec3.originSequence).toBe(2);
    } finally {
      await reopenedStore.close();
      // Re-assign store so afterEach can safely call close()
      store = await openLedgerStore({ path: dbPath, deviceId });
    }
  });

  it('Scenario: Replication carries a competing version of an existing record', async () => {
    await store.createJob({ id: 'job_competing', originalRequest: 'Handle remote conflict' });

    // Local record exists
    const localIntent = await store.appendIntent(makeIntentInput('job_competing', 'corr_comp_local'));

    // Capture byte-level SHA-256 of the held record
    const rawDb = new Database(dbPath);
    const localRow = rawDb
      .prepare<[string], { content: string }>(
        'SELECT content FROM action_record WHERE record_id = ?'
      )
      .get(localIntent.recordId)!;
    rawDb.close();

    const initialHash = crypto.createHash('sha256').update(localRow.content).digest('hex');

    // Remote competing record is reconciled by appending a superseded_version record
    const supersededRecord = await store.appendSupersededVersion(
      makeSupersededVersionInput('job_competing', {
        supersededRecord: localIntent.recordId,
        supersedingRecord: 'rec_remote_edit_99',
        supersededPayload: localIntent.content,
        supersededDevice: 'dev_remote_macbook',
      })
    );

    expect(supersededRecord.type).toBe('superseded_version');
    expect(supersededRecord.content.supersededRecord).toBe(localIntent.recordId);
    expect(supersededRecord.content.supersededDevice).toBe('dev_remote_macbook');

    // Assert: original held record is left 100% byte-identical
    const checkDb = new Database(dbPath);
    const postRow = checkDb
      .prepare<[string], { content: string }>(
        'SELECT content FROM action_record WHERE record_id = ?'
      )
      .get(localIntent.recordId)!;
    checkDb.close();

    const postHash = crypto.createHash('sha256').update(postRow.content).digest('hex');
    expect(postHash).toBe(initialHash);
  });

  it('Scenario: No conflict, no record', async () => {
    await store.createJob({ id: 'job_single_device', originalRequest: 'Single device normal edits' });

    // Ordinary local edits on single device
    await store.appendIntent(makeIntentInput('job_single_device', 'corr_ord_1'));
    await store.appendIntent(makeIntentInput('job_single_device', 'corr_ord_2'));

    // Verify no superseded_version records exist
    const allRecords = await store.readJob('job_single_device');
    const superseded = allRecords.filter((r) => r.type === 'superseded_version');
    expect(superseded).toHaveLength(0);
  });

  it('verifies appendMany atomically commits intent and result in ordered batch', async () => {
    await store.createJob({ id: 'job_batch_repl', originalRequest: 'Batch append' });

    const corr = 'corr_batch_atomic_1';
    const intentRecord = {
      recordId: 'rec_batch_int_1',
      jobId: 'job_batch_repl',
      position: 0,
      type: 'intent' as const,
      originDevice: 'dev_remote_server',
      originSequence: 501,
      recordedAt: '2026-01-10T10:00:00.000Z',
      correlationId: corr,
      content: {
        connector: 'notion',
        tool: 'update_page',
        parameters: { page_id: 'p_batch' },
        before: { captured: true, target: 'p_batch', state: { v: 1 } },
        reversibility: { kind: 'reversible' as const, snapshotMethod: 'get_page' },
        reconciliation: { method: 'none' as const },
      },
    };

    const resultRecord = {
      recordId: 'rec_batch_res_1',
      jobId: 'job_batch_repl',
      position: 1,
      type: 'result' as const,
      originDevice: 'dev_remote_server',
      originSequence: 502,
      recordedAt: '2026-01-10T10:00:01.000Z',
      correlationId: corr,
      content: {
        outcome: 'succeeded' as const,
        establishedBy: 'observed' as const,
        after: { captured: true, target: 'p_batch', state: { v: 2 } },
        compensatingAction: {
          connector: 'notion',
          tool: 'update_page',
          parameters: { page_id: 'p_batch', v: 1 },
        },
      },
    };

    const ids = await store.appendMany([intentRecord, resultRecord]);
    expect(ids).toEqual(['rec_batch_int_1', 'rec_batch_res_1']);

    const history = await store.readJob('job_batch_repl');
    expect(history).toHaveLength(2);
    expect(history[0]!.originDevice).toBe('dev_remote_server');
    expect(history[0]!.originSequence).toBe(501);
    expect(history[0]!.recordedAt).toBe('2026-01-10T10:00:00.000Z');
    expect(history[1]!.originDevice).toBe('dev_remote_server');
    expect(history[1]!.originSequence).toBe(502);
    expect(history[1]!.recordedAt).toBe('2026-01-10T10:00:01.000Z');

    // Verify local device sequence was NOT incremented by remote origin sequence
    const localIntent = await store.appendIntent(makeIntentInput('job_batch_repl', 'corr_local_after_batch'));
    expect(localIntent.originDevice).toBe(deviceId);
    // Sequence for local device continues from local counter (0 since no prior local appends in this test)
    expect(localIntent.originSequence).toBe(0);
  });
});
