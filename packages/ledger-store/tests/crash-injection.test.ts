import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLedgerStore } from '../src/opener.js';
import { createTestDir, type TestDir } from './helpers/test-env.js';

describe('Crash Injection Scenarios (SP-12 port & ledger spec)', () => {
  let testDir: TestDir;
  let dbPath: string;
  const deviceId = 'dev_crash_test';
  const workerScript = path.resolve(__dirname, 'fixtures/crash-worker.ts');

  beforeEach(() => {
    testDir = createTestDir('crash-inj-');
    dbPath = testDir.dbPath();
  });

  afterEach(() => {
    testDir.cleanup();
  });

  function runCrashWorker(crashPoint: number, jobId: string, sentinelPath: string) {
    return spawnSync(
      'node',
      [
        '--import',
        'tsx',
        workerScript,
        '--db',
        dbPath,
        '--crash-point',
        String(crashPoint),
        '--sentinel',
        sentinelPath,
        '--job',
        jobId,
        '--device',
        deviceId,
      ],
      {
        encoding: 'utf8',
      }
    );
  }

  it('Scenario: Crash between record and call (Crash Point 1 - Before Decision)', async () => {
    const jobId = 'job_crash_pt1';
    const sentinel = path.join(testDir.path, 'sentinel_pt1.txt');

    const res = runCrashWorker(1, jobId, sentinel);
    // On POSIX SIGKILL status is null, signal is 'SIGKILL'; on Windows status is abnormal
    expect(res.status === null || res.status !== 0).toBe(true);

    const store = await openLedgerStore({ path: dbPath, deviceId });
    try {
      const records = await store.readJob(jobId);
      expect(records).toHaveLength(0);
      expect(fs.existsSync(sentinel)).toBe(false);
    } finally {
      await store.close();
    }
  });

  it('Scenario: Crash between record and call (Crash Point 2 - After Decision, Before Intent)', async () => {
    const jobId = 'job_crash_pt2';
    const sentinel = path.join(testDir.path, 'sentinel_pt2.txt');

    const res = runCrashWorker(2, jobId, sentinel);
    expect(res.status === null || res.status !== 0).toBe(true);

    const store = await openLedgerStore({ path: dbPath, deviceId });
    try {
      const records = await store.readJob(jobId);
      expect(records).toHaveLength(1);
      expect(records[0]!.type).toBe('decision');
      expect(fs.existsSync(sentinel)).toBe(false);

      const unresolved = await store.unresolvedIntents();
      expect(unresolved.filter((u) => u.jobId === jobId)).toHaveLength(0);
    } finally {
      await store.close();
    }
  });

  it('Scenario: Crash between record and call (Crash Point 3 - After Durable Intent, Before External Effect)', async () => {
    const jobId = 'job_crash_pt3';
    const sentinel = path.join(testDir.path, 'sentinel_pt3.txt');

    const res = runCrashWorker(3, jobId, sentinel);
    expect(res.status === null || res.status !== 0).toBe(true);

    const store = await openLedgerStore({ path: dbPath, deviceId });
    try {
      // 1. Intent record MUST exist and be durable
      const records = await store.readJob(jobId);
      const intents = records.filter((r) => r.type === 'intent');
      expect(intents).toHaveLength(1);

      // 2. External call was NEVER made
      expect(fs.existsSync(sentinel)).toBe(false);

      // 3. Unresolved intent is immediately visible to recovery classification
      const unresolved = await store.unresolvedIntents();
      const match = unresolved.find((u) => u.jobId === jobId);
      expect(match).toBeDefined();
      expect(match!.correlationId).toBe(`corr_${jobId}`);
    } finally {
      await store.close();
    }
  });

  it('Scenario: Crash between record and call (Crash Point 4 - After External Effect, Before Result)', async () => {
    const jobId = 'job_crash_pt4';
    const sentinel = path.join(testDir.path, 'sentinel_pt4.txt');

    const res = runCrashWorker(4, jobId, sentinel);
    expect(res.status === null || res.status !== 0).toBe(true);

    const store = await openLedgerStore({ path: dbPath, deviceId });
    try {
      // 1. Intent record exists
      const records = await store.readJob(jobId);
      const intents = records.filter((r) => r.type === 'intent');
      expect(intents).toHaveLength(1);

      // 2. External effect DID occur (sentinel exists)
      expect(fs.existsSync(sentinel)).toBe(true);

      // 3. Result record was not written
      const results = records.filter((r) => r.type === 'result');
      expect(results).toHaveLength(0);

      // 4. Intent is unresolved in ledger
      const unresolved = await store.unresolvedIntents();
      const match = unresolved.find((u) => u.jobId === jobId);
      expect(match).toBeDefined();
    } finally {
      await store.close();
    }
  });

  it('Scenario: Crash between record and call (Crash Point 5 - After Result, Before Job State)', async () => {
    const jobId = 'job_crash_pt5';
    const sentinel = path.join(testDir.path, 'sentinel_pt5.txt');

    const res = runCrashWorker(5, jobId, sentinel);
    expect(res.status === null || res.status !== 0).toBe(true);

    const store = await openLedgerStore({ path: dbPath, deviceId });
    try {
      // Both intent and result records are durable
      const records = await store.readJob(jobId);
      const intents = records.filter((r) => r.type === 'intent');
      const results = records.filter((r) => r.type === 'result');
      expect(intents).toHaveLength(1);
      expect(results).toHaveLength(1);
      expect(results[0]!.correlationId).toBe(intents[0]!.correlationId);

      // External call completed
      expect(fs.existsSync(sentinel)).toBe(true);

      // No unresolved intents
      const unresolved = await store.unresolvedIntents();
      expect(unresolved.filter((u) => u.jobId === jobId)).toHaveLength(0);

      // Job state projection is still 'created' because crash occurred before setJobState('done')
      const job = await store.getJob(jobId);
      expect(job?.state).toBe('created');
    } finally {
      await store.close();
    }
  });
});
