import { spawnSync, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { createTestDir, makeIntentInput, type TestDir } from './helpers/test-env.js';

describe('Immutability Scenarios (ledger spec)', () => {
  let testDir: TestDir;
  let dbPath: string;
  let store: LedgerStore;
  const deviceId = 'dev_immutability_1';

  beforeEach(async () => {
    testDir = createTestDir('immutability-');
    dbPath = testDir.dbPath();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('Scenario: External modification attempt', async () => {
    await store.createJob({ id: 'job_internal_tamper', originalRequest: 'Tamper resistance' });
    const intent = await store.appendIntent(makeIntentInput('job_internal_tamper', 'corr_tamper_1'));

    // Open direct better-sqlite3 connection to the same file
    const rawDb = new Database(dbPath);

    try {
      // 1. Attempt UPDATE
      expect(() => {
        rawDb
          .prepare("UPDATE action_record SET content = 'tampered' WHERE record_id = ?")
          .run(intent.recordId);
      }).toThrow(/APPEND_ONLY_VIOLATION.*RECORD_IMMUTABLE/);

      // 2. Attempt DELETE
      expect(() => {
        rawDb.prepare('DELETE FROM action_record WHERE record_id = ?').run(intent.recordId);
      }).toThrow(/APPEND_ONLY_VIOLATION.*RECORD_IMMUTABLE/);

      // Verify row is completely unchanged
      const row = rawDb
        .prepare<[string], { record_id: string; content: string }>(
          'SELECT record_id, content FROM action_record WHERE record_id = ?'
        )
        .get(intent.recordId);

      expect(row).toBeDefined();
      expect(JSON.parse(row!.content)).toEqual(intent.content);
    } finally {
      rawDb.close();
    }
  });

  it('Scenario: A tool outside the product opens the store directly', async () => {
    await store.createJob({ id: 'job_cli_tamper', originalRequest: 'Outside tool resistance' });
    const intent = await store.appendIntent(makeIntentInput('job_cli_tamper', 'corr_cli_tamper'));

    // Read original row bytes and hash
    const rawDb = new Database(dbPath);
    const originalRow = rawDb
      .prepare<[string], { content: string }>(
        'SELECT content FROM action_record WHERE record_id = ?'
      )
      .get(intent.recordId)!;
    rawDb.close();

    const originalHash = crypto.createHash('sha256').update(originalRow.content).digest('hex');

    // 1. Separate Node process opening the same file
    const nodeScript = `
      const Database = require('better-sqlite3');
      const db = new Database(process.argv[1]);
      try {
        db.prepare("UPDATE action_record SET content = 'external_node_hack'").run();
        process.exit(0);
      } catch (err) {
        process.stderr.write(err.message);
        process.exit(42);
      }
    `;

    const nodeProc = spawnSync(process.execPath, ['-e', nodeScript, dbPath], {
      encoding: 'utf8',
    });

    expect(nodeProc.status).toBe(42);
    expect(nodeProc.stderr).toMatch(/APPEND_ONLY_VIOLATION.*RECORD_IMMUTABLE/);

    // 2. Separate command-line route. The sqlite3 binary is not part of the product —
    // the store carries its own engine — so it is used wherever the machine happens to
    // have it and the leg is skipped where it does not. Assuming its presence on Linux
    // made this scenario fail in the toolchain-free container the project builds in.
    let hasSqliteCli = true;
    try {
      execFileSync('sqlite3', ['-version'], { stdio: 'ignore' });
    } catch {
      hasSqliteCli = false;
    }

    if (hasSqliteCli) {
      const updateResult = spawnSync('sqlite3', [dbPath, "UPDATE action_record SET content = 'cli_hack';"], {
        encoding: 'utf8',
      });
      expect(updateResult.status).not.toBe(0);
      expect(updateResult.stderr).toMatch(/APPEND_ONLY_VIOLATION/);

      const deleteResult = spawnSync('sqlite3', [dbPath, 'DELETE FROM action_record;'], {
        encoding: 'utf8',
      });
      expect(deleteResult.status).not.toBe(0);
      expect(deleteResult.stderr).toMatch(/APPEND_ONLY_VIOLATION/);
    }

    // Verify row bytes remained 100% identical
    const verifyDb = new Database(dbPath);
    const postRow = verifyDb
      .prepare<[string], { content: string }>(
        'SELECT content FROM action_record WHERE record_id = ?'
      )
      .get(intent.recordId)!;
    verifyDb.close();

    const postHash = crypto.createHash('sha256').update(postRow.content).digest('hex');
    expect(postHash).toBe(originalHash);
  });
});
