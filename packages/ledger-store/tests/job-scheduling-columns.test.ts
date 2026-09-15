import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openLedgerStore } from '../src/opener.js';
import { createTestDir, type TestDir } from './helpers/test-env.js';

/**
 * The job table gained the columns the scheduler reads — the device that created a job,
 * its priority, its connector account and the connectors it may need — after the initial
 * schema had already shipped. A database created before that keeps its own table and never
 * runs the initial schema again, so without a migration step the first job it is asked to
 * create fails on a column that is not there, and the store is unusable for its main
 * purpose rather than merely out of date.
 */
describe('a ledger store created before the job scheduling columns existed', () => {
  let testDir: TestDir;

  beforeEach(() => {
    testDir = createTestDir('job-scheduling-columns-');
  });

  afterEach(() => {
    testDir.cleanup();
  });

  async function buildStoreWithoutSchedulingColumns(dbPath: string): Promise<void> {
    const seed = await openLedgerStore({ path: dbPath, deviceId: 'dev_scheduling' });
    await seed.close();

    const db = new Database(dbPath);
    try {
      for (const column of [
        'created_on_device',
        'priority',
        'connector_account_id',
        'required_connectors_json',
      ]) {
        db.exec(`ALTER TABLE job DROP COLUMN ${column}`);
      }
      db.pragma('user_version = 1');
    } finally {
      db.close();
    }
  }

  it('gains the columns when it is opened and can create a job again', async () => {
    const dbPath = testDir.dbPath();
    await buildStoreWithoutSchedulingColumns(dbPath);

    const store = await openLedgerStore({ path: dbPath, deviceId: 'dev_scheduling' });
    try {
      const job = await store.createJob({
        id: 'job_after_upgrade',
        originalRequest: 'Work asked for after the store was upgraded',
        priority: 'interactive',
        connectorAccountId: 'account-1',
        requiredConnectors: ['notion'],
      });

      expect(job.priority).toBe('interactive');
      expect(job.connectorAccountId).toBe('account-1');
      expect(job.requiredConnectors).toEqual(['notion']);
      expect(job.createdOnDevice).toBe('local');
    } finally {
      await store.close();
    }
  });

  it('keeps the records it already held', async () => {
    const dbPath = testDir.dbPath();

    const seed = await openLedgerStore({ path: dbPath, deviceId: 'dev_scheduling' });
    await seed.createJob({ id: 'job_before_upgrade', originalRequest: 'Work asked for earlier' });
    await seed.close();

    const db = new Database(dbPath);
    try {
      for (const column of [
        'created_on_device',
        'priority',
        'connector_account_id',
        'required_connectors_json',
      ]) {
        db.exec(`ALTER TABLE job DROP COLUMN ${column}`);
      }
      db.pragma('user_version = 1');
    } finally {
      db.close();
    }

    const store = await openLedgerStore({ path: dbPath, deviceId: 'dev_scheduling' });
    try {
      const preserved = await store.getJob('job_before_upgrade');
      expect(preserved?.originalRequest).toBe('Work asked for earlier');
      expect(preserved?.priority).toBe('background');
    } finally {
      await store.close();
    }
  });
});
