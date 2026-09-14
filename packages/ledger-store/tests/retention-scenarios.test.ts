import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { LedgerStoreError } from '../src/errors.js';
import { SYSTEM_MAINTENANCE_JOB_ID } from '../src/schema.js';
import { createTestDir, makeIntentInput, type TestDir } from './helpers/test-env.js';

describe('Retention & Removal Scenarios (ledger spec)', () => {
  let testDir: TestDir;
  let dbPath: string;
  let attachmentRoot: string;
  let store: LedgerStore;
  const deviceId = 'dev_retention_1';

  beforeEach(async () => {
    testDir = createTestDir('retention-');
    dbPath = testDir.dbPath();
    attachmentRoot = path.join(testDir.path, 'attachments');
    fs.mkdirSync(attachmentRoot, { recursive: true });
    store = await openLedgerStore({ path: dbPath, deviceId, attachmentRoot, retentionDays: 90 });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('Scenario: Records reach the end of the retention period', async () => {
    await store.createJob({ id: 'job_old', originalRequest: 'Old task' });
    await store.createJob({ id: 'job_new', originalRequest: 'Recent task' });
    // Append an old record beyond 90 days
    const oldTimestamp = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const historicalRecordId = 'rec_hist_1';
    await store.append({
      recordId: historicalRecordId,
      jobId: 'job_old',
      position: 0,
      type: 'intent',
      originDevice: deviceId,
      originSequence: 999,
      recordedAt: oldTimestamp,
      correlationId: 'corr_hist_1',
      content: {
        connector: 'notion',
        tool: 'get_page',
        parameters: {},
        before: { captured: false, reason: 'test' },
        reversibility: { kind: 'irreversible', reason: 'read only' },
        reconciliation: { method: 'none' },
      },
    });

    // Recent record within retention
    const recentIntent = await store.appendIntent(makeIntentInput('job_new', 'corr_new'));

    // Expire records older than 90 days
    const outcome = await store.expire();

    expect(outcome.completed).toBe(true);
    expect(outcome.recordsRemoved).toBe(1);
    expect(outcome.announcement).toBeDefined();

    // Verify announcement record exists on system:ledger-maintenance
    const maintRecords = await store.readJob(SYSTEM_MAINTENANCE_JOB_ID);
    expect(maintRecords.some((r) => r.recordId === outcome.announcement)).toBe(true);

    // Verify old record was removed
    const oldRecords = await store.readJob('job_old');
    expect(oldRecords).toHaveLength(0);

    // Verify recent record is preserved intact
    const newRecords = await store.readJob('job_new');
    expect(newRecords).toHaveLength(1);
    expect(newRecords[0]!.recordId).toBe(recentIntent.recordId);
  });

  it('Scenario: The user deletes their history', async () => {
    await store.createJob({ id: 'job_user_delete', originalRequest: 'User asks to wipe history' });
    await store.appendIntent(makeIntentInput('job_user_delete', 'corr_ud_1'));

    const outcome = await store.deleteByUser(
      { jobIds: ['job_user_delete'] },
      'User requested cleanup of job_user_delete',
      {
        confirmed: true,
        warnedUndoWillBeLost: true,
        confirmedAt: new Date().toISOString(),
      }
    );

    expect(outcome.completed).toBe(true);
    expect(outcome.recordsRemoved).toBe(1);

    // Announcement record survives the deletion
    const verifyDb = new Database(dbPath);
    const annRow = verifyDb
      .prepare<[string], { record_id: string; references_json: string }>(
        'SELECT record_id, references_json FROM action_record WHERE record_id = ?'
      )
      .get(outcome.announcement);
    verifyDb.close();

    expect(annRow).toBeDefined();

    const jobRecords = await store.readJob('job_user_delete');
    expect(jobRecords).toHaveLength(0);
  });

  it('Scenario: Deletion is warned about', async () => {
    await store.createJob({ id: 'job_unconfirmed', originalRequest: 'Should reject without confirmation' });
    await store.appendIntent(makeIntentInput('job_unconfirmed', 'corr_unconf'));

    // Missing warnedUndoWillBeLost must be rejected with REMOVAL_SCOPE_INVALID
    await expect(
      store.deleteByUser(
        { jobIds: ['job_unconfirmed'] },
        'Unconfirmed deletion attempt',
        { confirmed: true, warnedUndoWillBeLost: false, confirmedAt: new Date().toISOString() } as unknown as {
          confirmed: true;
          warnedUndoWillBeLost: true;
          confirmedAt: string;
        }
      )
    ).rejects.toThrow(LedgerStoreError);
  });

  it('Scenario: Retention expiry removes attachments too', async () => {
    await store.createJob({ id: 'job_with_attachment', originalRequest: 'Task with image extract' });

    // Create a real attachment file on disk
    const relativeAttPath = 'screenshots/page_extract.png';
    const fullAttPath = path.join(attachmentRoot, relativeAttPath);
    fs.mkdirSync(path.dirname(fullAttPath), { recursive: true });
    fs.writeFileSync(fullAttPath, 'PNG_EXTRACT_BYTES', 'utf8');
    // Insert historical record with attachment via direct INSERT / store.append
    const oldTimestamp = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const histRecordId = 'rec_hist_att_1';
    await store.append({
      recordId: histRecordId,
      jobId: 'job_with_attachment',
      position: 0,
      type: 'intent',
      originDevice: deviceId,
      originSequence: 888,
      recordedAt: oldTimestamp,
      correlationId: 'corr_hist_att_1',
      content: {
        connector: 'notion',
        tool: 'update_page',
        parameters: {},
        before: { captured: false, reason: 'test' },
        reversibility: { kind: 'irreversible', reason: 'test' },
        reconciliation: { method: 'none' },
      },
    });
    const rawDb = new Database(dbPath);
    rawDb.prepare('INSERT INTO record_attachment (record_id, attachment_path) VALUES (?, ?)').run(
      histRecordId,
      relativeAttPath
    );
    rawDb.close();
    const outcome = await store.expire();
    expect(outcome.recordsRemoved).toBe(1);
    expect(outcome.attachmentsRemoved).toBe(1);

    // Physical file is removed from disk
    expect(fs.existsSync(fullAttPath)).toBe(false);
  });

  it('Scenario: Removal is not a route to editing', async () => {
    await store.createJob({ id: 'job_no_edit', originalRequest: 'Immutability test' });
    const intent = await store.appendIntent(makeIntentInput('job_no_edit', 'corr_no_edit'));

    // Direct delete is refused by trigger
    const rawDb = new Database(dbPath);
    expect(() => {
      rawDb.prepare('DELETE FROM action_record WHERE record_id = ?').run(intent.recordId);
    }).toThrow(/APPEND_ONLY_VIOLATION/);
    rawDb.close();

    // Calling deleteByUser for system maintenance job is refused
    await expect(
      store.deleteByUser(
        { jobIds: [SYSTEM_MAINTENANCE_JOB_ID] },
        'Attempt to delete maintenance coordinator',
        { confirmed: true, warnedUndoWillBeLost: true, confirmedAt: new Date().toISOString() }
      )
    ).rejects.toThrow(/Cannot delete system maintenance job/);
  });

  it('Scenario: The application stops during a removal', async () => {
    await store.createJob({ id: 'job_interrupted_rem', originalRequest: 'Interrupted removal' });
    const intent = await store.appendIntent(makeIntentInput('job_interrupted_rem', 'corr_interrupted_rem'));

    // Create an attachment file
    const attPath = 'extracts/doc.png';
    const fullAttPath = path.join(attachmentRoot, attPath);
    fs.mkdirSync(path.dirname(fullAttPath), { recursive: true });
    fs.writeFileSync(fullAttPath, 'ATTACHMENT_CONTENT', 'utf8');

    // Simulate Phase 1 committed, but process killed before Phase 2 completes
    const rawDb = new Database(dbPath);
    const opId = 'op_simulated_crash_p1';
    const annId = 'ann_simulated_crash_p1';
    const now = new Date().toISOString();

    // Insert announcement record
    rawDb
      .prepare(
        `INSERT INTO action_record (
          record_id, job_id, position, type, origin_device, origin_sequence,
          recorded_at, correlation_id, references_json, content
        ) VALUES (?, ?, 99, 'removal_announcement', 'dev_sim', 999, ?, NULL, ?, ?)`
      )
      .run(
        annId,
        SYSTEM_MAINTENANCE_JOB_ID,
        now,
        JSON.stringify([intent.recordId]),
        JSON.stringify({
          reason: 'retention_expiry',
          requestedBy: 'system',
          range: { fromRecordedAt: now, toRecordedAt: now, recordCount: 1 },
        })
      );

    // Insert removal_operation with database_completed = 0
    rawDb
      .prepare(
        `INSERT INTO removal_operation (
          operation_id, announcement_record_id, reason, requested_by, target_count,
          database_completed, completed, created_at
        ) VALUES (?, ?, 'retention_expiry', 'system', 1, 0, 0, ?)`
      )
      .run(opId, annId, now);

    rawDb.prepare('INSERT INTO removal_target (operation_id, record_id) VALUES (?, ?)').run(opId, intent.recordId);
    rawDb.prepare('INSERT INTO removal_attachment (operation_id, attachment_path, removed) VALUES (?, ?, 0)').run(opId, attPath);
    rawDb.close();

    // Close existing store handle so a fresh start can open and resume
    await store.close();

    // Fresh process / open resumes incomplete removal
    const freshStore = await openLedgerStore({
      path: dbPath,
      deviceId,
      attachmentRoot,
    });

    try {
      // 1. Target record must be gone
      const records = await freshStore.readJob('job_interrupted_rem');
      expect(records).toHaveLength(0);

      // 2. Announcement must be present
      const annRecords = await freshStore.readJob(SYSTEM_MAINTENANCE_JOB_ID);
      expect(annRecords.some((r) => r.recordId === annId)).toBe(true);

      // 3. Attachment file must be removed
      expect(fs.existsSync(fullAttPath)).toBe(false);

      // 4. Operation is marked completed
      const checkDb = new Database(dbPath);
      const opRow = checkDb
        .prepare<[string], { completed: number }>(
          'SELECT completed FROM removal_operation WHERE operation_id = ?'
        )
        .get(opId);
      checkDb.close();

      expect(opRow?.completed).toBe(1);
    } finally {
      await freshStore.close();
    }

    // 5. Test real child-process SIGKILL mid-deletion transaction
    await store.close();
    const midKillJob = 'job_mid_kill';
    const freshDbSetup = new Database(dbPath);
    freshDbSetup.prepare("INSERT INTO job (id, original_request, state, approval_mode, created_at, updated_at, state_changed_at) VALUES (?, 'req', 'created', 'smart', '2026-01-01', '2026-01-01', '2026-01-01')").run(midKillJob);
    freshDbSetup.prepare("INSERT INTO action_record (record_id, job_id, position, type, origin_device, origin_sequence, recorded_at, correlation_id, references_json, content) VALUES ('rec_mk_1', ?, 0, 'intent', 'dev_sim', 101, '2026-01-01', 'corr_mk_1', NULL, '{}')").run(midKillJob);
    freshDbSetup.prepare("INSERT INTO action_record (record_id, job_id, position, type, origin_device, origin_sequence, recorded_at, correlation_id, references_json, content) VALUES ('rec_mk_2', ?, 1, 'intent', 'dev_sim', 102, '2026-01-01', 'corr_mk_2', NULL, '{}')").run(midKillJob);

    const killOpId = 'op_mid_kill';
    const killAnnId = 'ann_mid_kill';
    freshDbSetup.prepare("INSERT INTO action_record (record_id, job_id, position, type, origin_device, origin_sequence, recorded_at, correlation_id, references_json, content) VALUES (?, ?, 100, 'removal_announcement', 'dev_sim', 103, '2026-01-01', NULL, '[\"rec_mk_1\",\"rec_mk_2\"]', '{}')").run(killAnnId, SYSTEM_MAINTENANCE_JOB_ID);
    freshDbSetup.prepare("INSERT INTO removal_operation (operation_id, announcement_record_id, reason, requested_by, target_count, database_completed, completed, created_at) VALUES (?, ?, 'user_deletion', 'user', 2, 0, 0, '2026-01-01')").run(killOpId, killAnnId);
    freshDbSetup.prepare("INSERT INTO removal_target (operation_id, record_id) VALUES (?, 'rec_mk_1')").run(killOpId);
    freshDbSetup.prepare("INSERT INTO removal_target (operation_id, record_id) VALUES (?, 'rec_mk_2')").run(killOpId);
    freshDbSetup.close();

    // Child executes Phase 2 and kills itself with SIGKILL mid-transaction
    const midKillScript = `
      const Database = require('better-sqlite3');
      const db = new Database(process.argv[1]);
      db.pragma('journal_mode = WAL');
      try {
        db.transaction(() => {
          db.exec("DROP TRIGGER IF EXISTS action_record_no_delete;");
          db.prepare("DELETE FROM action_record WHERE record_id = 'rec_mk_1'").run();
          // Abrupt termination before committing rec_mk_2 deletion or trigger recreation
          process.kill(process.pid, 'SIGKILL');
        })();
      } catch (err) {
        process.exit(1);
      }
    `;

    const killProc = spawnSync(process.execPath, ['-e', midKillScript, dbPath], { encoding: 'utf8' });
    expect(killProc.status === null || killProc.status !== 0).toBe(true);

    // Inspect from fresh connection before resume: SQLite transaction rollback means ALL targets are present
    const inspectDb = new Database(dbPath);
    const rows = inspectDb.prepare("SELECT record_id FROM action_record WHERE job_id = ?").all(midKillJob) as Array<{ record_id: string }>;
    inspectDb.close();
    // All 2 records still present!
    expect(rows).toHaveLength(2);
    // Now open via openLedgerStore to prove resume finishes deleting both
    const resumedStore = await openLedgerStore({ path: dbPath, deviceId, attachmentRoot });
    try {
      const postRows = await resumedStore.readJob(midKillJob);
      expect(postRows).toHaveLength(0);

      // Idempotent second resume check: reopen store again
      const secondStore = await openLedgerStore({ path: dbPath, deviceId, attachmentRoot });
      await secondStore.close();
    } finally {
      await resumedStore.close();
      store = await openLedgerStore({ path: dbPath, deviceId, attachmentRoot });
    }
  });
});
