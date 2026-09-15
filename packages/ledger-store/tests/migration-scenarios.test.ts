import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { LedgerStoreError } from '../src/errors.js';
import {
  MigrationManager,
  type MigrationStep,
} from '../src/migration-manager.js';
import { createTestDir, makeIntentInput, type TestDir } from './helpers/test-env.js';

describe('Migration Scenarios (ledger spec)', () => {
  let testDir: TestDir;
  let dbPath: string;
  let store: LedgerStore;
  const deviceId = 'dev_migration_1';

  beforeEach(async () => {
    testDir = createTestDir('migration-');
    dbPath = testDir.dbPath();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('Scenario: A new field is added', async () => {
    await store.createJob({ id: 'job_mig_add', originalRequest: 'Additive migration' });
    const intent = await store.appendIntent(makeIntentInput('job_mig_add', 'corr_mig_add'));

    // Capture raw bytes of existing record before migration
    const rawDb = new Database(dbPath);
    const preRow = rawDb
      .prepare<[string], { content: string }>(
        'SELECT content FROM action_record WHERE record_id = ?'
      )
      .get(intent.recordId)!;
    const preHash = crypto.createHash('sha256').update(preRow.content).digest('hex');

    // The shipped registry decides where a freshly opened store sits, so the step this
    // scenario defines has to sit one above that rather than at a fixed number.
    const shippedVersion = rawDb.prepare('PRAGMA user_version').pluck().get() as number;
    const step2: MigrationStep = {
      version: shippedVersion + 1,
      name: 'add_auxiliary_metadata',
      apply: (db) => {
        db.exec('ALTER TABLE action_record ADD COLUMN sync_tag TEXT;');
        db.exec('CREATE TABLE IF NOT EXISTS job_annotation (id TEXT PRIMARY KEY, note TEXT);');
      },
    };

    const manager = new MigrationManager(rawDb, [
      { version: shippedVersion, name: 'already_applied', apply: () => {} },
      step2,
    ]);

    const newShape = manager.advanceShape();
    expect(newShape.current).toBe(shippedVersion + 1);
    expect(newShape.pendingSteps).toHaveLength(0);

    // Old records carry null for the new column
    const postRow = rawDb
      .prepare<[string], { content: string; sync_tag: string | null }>(
        'SELECT content, sync_tag FROM action_record WHERE record_id = ?'
      )
      .get(intent.recordId)!;

    expect(postRow.sync_tag).toBeNull();

    // Content is 100% byte-identical
    const postHash = crypto.createHash('sha256').update(postRow.content).digest('hex');
    expect(postHash).toBe(preHash);
    rawDb.close();
  });

  it('Scenario: A shape change tries to reinterpret history', async () => {
    await store.createJob({ id: 'job_mig_rewrite', originalRequest: 'Refuse rewrite migration' });
    await store.appendIntent(makeIntentInput('job_mig_rewrite', 'corr_rewrite_1'));

    const rawDb = new Database(dbPath);

    const shippedVersion = rawDb.prepare('PRAGMA user_version').pluck().get() as number;

    // Bad migration 1: tries to add a NOT NULL column to action_record
    const badStepNotNull: MigrationStep = {
      version: shippedVersion + 1,
      name: 'illegal_not_null_column',
      apply: (db) => {
        db.exec("ALTER TABLE action_record ADD COLUMN illegal_col TEXT NOT NULL DEFAULT 'val';");
      },
    };

    const managerNotNull = new MigrationManager(rawDb, [
      { version: shippedVersion, name: 'already_applied', apply: () => {} },
      badStepNotNull,
    ]);

    expect(() => {
      managerNotNull.advanceShape();
    }).toThrow(LedgerStoreError);

    // Verify user_version was NOT advanced
    const v1 = rawDb.prepare('PRAGMA user_version').pluck().get() as number;
    expect(v1).toBe(shippedVersion);

    // Bad migration 2: tries to tamper with existing records
    const badStepTamper: MigrationStep = {
      version: shippedVersion + 1,
      name: 'illegal_tamper_records',
      apply: (db) => {
        // Even if someone temporarily tries to alter content
        db.exec("UPDATE action_record SET content = '{}';");
      },
    };

    const managerTamper = new MigrationManager(rawDb, [
      { version: shippedVersion, name: 'already_applied', apply: () => {} },
      badStepTamper,
    ]);

    expect(() => {
      managerTamper.advanceShape();
    }).toThrow();

    const v2 = rawDb.prepare('PRAGMA user_version').pluck().get() as number;
    expect(v2).toBe(shippedVersion);

    rawDb.close();
  });

  it('Scenario: The shape change is interrupted', async () => {
    await store.createJob({ id: 'job_mig_interrupted', originalRequest: 'Interrupted migration test' });
    const intent = await store.appendIntent(makeIntentInput('job_mig_interrupted', 'corr_mig_int'));
    await store.close();

    // 1. Child process executes advanceShape() where step kills process mid-transaction
    const childScript = `
      const Database = require('better-sqlite3');
      const db = new Database(process.argv[1]);
      db.pragma('journal_mode = WAL');
      try {
        db.transaction(() => {
          db.exec("CREATE TABLE should_not_survive (id INTEGER PRIMARY KEY);");
          // Abrupt kill mid-transaction
          process.kill(process.pid, 'SIGKILL');
        })();
      } catch (err) {
        process.exit(1);
      }
    `;

    const proc = spawnSync(
      process.execPath,
      ['-e', childScript, dbPath],
      { encoding: 'utf8' }
    );

    expect(proc.status === null || proc.status !== 0).toBe(true);

    // Reopen store: must be wholly at the shape the shipped registry targets, and the
    // table the killed transaction started must not exist
    store = await openLedgerStore({ path: dbPath, deviceId });
    const shape = await store.shape();
    expect(shape.current).toBe(shape.target);

    const records = await store.readJob('job_mig_interrupted');
    expect(records).toHaveLength(1);
    expect(records[0]!.recordId).toBe(intent.recordId);

    const checkDb = new Database(dbPath);
    const leakedTable = checkDb
      .prepare<[string], { name: string }>(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?"
      )
      .get('should_not_survive');
    checkDb.close();
    expect(leakedTable).toBeUndefined();

    // 2. Test SHAPE_AHEAD when database version is newer than code understands
    await store.close();
    const aheadDb = new Database(dbPath);
    aheadDb.pragma('user_version = 999');
    aheadDb.close();

    await expect(
      openLedgerStore({ path: dbPath, deviceId })
    ).rejects.toThrow(LedgerStoreError);

    try {
      await openLedgerStore({ path: dbPath, deviceId });
    } catch (err) {
      expect((err as LedgerStoreError).code).toBe('SHAPE_AHEAD');
    }

    // Reset user_version so afterEach cleanup works cleanly
    const resetDb = new Database(dbPath);
    resetDb.pragma(`user_version = ${shape.target}`);
    resetDb.close();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });
});
