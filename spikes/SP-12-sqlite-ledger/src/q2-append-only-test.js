const { createDatabase } = require('./db');
const { LedgerRepository } = require('./ledger');
const { JobRepository } = require('./job-repository');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const testDbPath = path.join(__dirname, '../evidence/q2-test.db');
const logPath = path.join(__dirname, '../evidence/q2-append-only.log');

// Clean up previous test db
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);

const logStream = fs.createWriteStream(logPath, { flags: 'w' });
function log(msg) {
  console.log(msg);
  logStream.write(msg + '\n');
}

log('================================================================');
log('SPIKE SP-12 / Q2: APPEND-ONLY ENFORCEMENT TEST (FR-LG-02)');
log(`Database: ${testDbPath}`);
log(`Timestamp: ${new Date().toISOString()}`);
log('================================================================\n');

// 1. Initialize DB and Seed Data
const db = createDatabase(testDbPath);
const jobs = new JobRepository(db);
const ledger = new LedgerRepository(db);

jobs.createJob({ id: 'job_test_q2', originalRequest: 'Test Q2 Append-Only' });
const record = ledger.appendRecord({
  jobId: 'job_test_q2',
  type: 'tool_intent',
  tool: 'notion_update_page',
  args: { pageId: 'p123' }
});

log(`[SETUP] Inserted initial record with ID: ${record.id}, seq: ${record.seq}`);

// 2. Test Internal UPDATE
log('\n--- Test 2.1: Internal UPDATE attempt via SQLite Statement ---');
let updateBlocked = false;
try {
  db.prepare('UPDATE action_records SET args = ? WHERE id = ?').run(JSON.stringify({ pageId: 'p_hacked' }), record.id);
} catch (err) {
  updateBlocked = true;
  log(`[SUCCESS] UPDATE was BLOCKED as expected!`);
  log(`Error message: "${err.message}"`);
}
assert.strictEqual(updateBlocked, true, 'Trigger trg_action_records_no_update must block UPDATE');

// 3. Test Internal DELETE
log('\n--- Test 2.2: Internal DELETE attempt via SQLite Statement ---');
let deleteBlocked = false;
try {
  db.prepare('DELETE FROM action_records WHERE id = ?').run(record.id);
} catch (err) {
  deleteBlocked = true;
  log(`[SUCCESS] DELETE was BLOCKED as expected!`);
  log(`Error message: "${err.message}"`);
}
assert.strictEqual(deleteBlocked, true, 'Trigger trg_action_records_no_delete must block DELETE');

// Close connection before external tool test
db.close();

// 4. Test External Tool (Python sqlite3 opening the file from outside)
log('\n--- Test 2.3: External Tool (Python sqlite3) attempting UPDATE & DELETE ---');
const pythonScript = `
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("[Python] Attempting UPDATE on action_records...")
try:
    cur.execute("UPDATE action_records SET args = ? WHERE id = ?", ('{"hacked": true}', 1))
    conn.commit()
    print("[Python] UNEXPECTED: UPDATE succeeded!")
except Exception as e:
    print(f"[Python] BLOCKED: {e}")

print("[Python] Attempting DELETE on action_records...")
try:
    cur.execute("DELETE FROM action_records WHERE id = ?", (1,))
    conn.commit()
    print("[Python] UNEXPECTED: DELETE succeeded!")
except Exception as e:
    print(f"[Python] BLOCKED: {e}")

print("[Python] Attempting DROP TRIGGER trg_action_records_no_update...")
try:
    cur.execute("DROP TRIGGER trg_action_records_no_update")
    conn.commit()
    print("[Python] WARNING: DROP TRIGGER succeeded (external tool with write access can drop triggers)!")
except Exception as e:
    print(f"[Python] DROP TRIGGER blocked: {e}")

conn.close()
`;

const pyCmd = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const pyProc = spawnSync(pyCmd, ['-c', pythonScript, testDbPath], { encoding: 'utf8' });
log(pyProc.stdout.trim());
if (pyProc.stderr) log(`Stderr: ${pyProc.stderr}`);

// Verify record is still intact
const dbReopened = createDatabase(testDbPath);
const records = dbReopened.prepare('SELECT * FROM action_records').all();
log(`\n--- Verification: Row count and integrity ---`);
log(`Current records count: ${records.length}`);
log(`Record 1: ${JSON.stringify(records[0])}`);
assert.strictEqual(records.length, 1, 'Record must not be deleted');
assert.strictEqual(JSON.parse(records[0].args).pageId, 'p123', 'Record must not be updated');

log('\n================================================================');
log('Q2 CONCLUSION SUMMARY:');
log('1. SQLite Triggers enforce append-only at the database engine level.');
log('2. Triggers work regardless of whether the query comes from the app or an external tool (verified with Python sqlite3).');
log('3. An external tool with file write permissions CAN drop triggers (unless authorizers or OS read-only permissions are configured).');
log('4. RECOMMENDATION: Defense-in-depth (Repository abstraction in application layer + SQLite Triggers in DDL).');
log('================================================================\n');

dbReopened.close();
logStream.end();
console.log(`\nLog written to ${logPath}`);
