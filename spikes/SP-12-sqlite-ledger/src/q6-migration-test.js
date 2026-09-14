const { createDatabase } = require('./db');
const { JobRepository } = require('./job-repository');
const { LedgerRepository } = require('./ledger');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const evidenceDir = path.join(__dirname, '../evidence');
const testDbPath = path.join(evidenceDir, 'q6_migration_test.db');
const logPath = path.join(evidenceDir, 'q6-migration.log');

[testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`].forEach(f => {
  if (fs.existsSync(f)) fs.unlinkSync(f);
});

const logLines = [];
function log(msg) {
  console.log(msg);
  logLines.push(msg);
}

log('======================================================================');
log('SPIKE SP-12 / Q6: SCHEMA MIGRATION ON IMMUTABLE LEDGER TEST');
log(`Database: ${testDbPath}`);
log(`Timestamp: ${new Date().toISOString()}`);
log('======================================================================\n');

// 1. Initial State: Schema v1 with PRAGMA user_version = 1
const db = createDatabase(testDbPath);
db.pragma('user_version = 1');
const jobsRepo = new JobRepository(db);
const ledgerRepo = new LedgerRepository(db);

jobsRepo.createJob({ id: 'job_v1_001', originalRequest: 'Initial v1 request' });
ledgerRepo.appendRecord({
  jobId: 'job_v1_001',
  type: 'tool_intent',
  tool: 'notion_update_page',
  args: { pageId: 'p_v1' }
});

const v1Version = db.pragma('user_version', { simple: true });
log(`[STEP 1] Initial Database initialized at user_version = ${v1Version}`);
log(`         Inserted 1 v1 Job and 1 v1 ActionRecord.`);

// 2. Test Additive Migration: ALTER TABLE ADD COLUMN
log('\n--- Test 6.1: Additive Migration (ALTER TABLE ADD COLUMN in v2) ---');
try {
  db.exec(`
    ALTER TABLE action_records ADD COLUMN actor_identity TEXT DEFAULT 'agent';
    ALTER TABLE action_records ADD COLUMN model_name TEXT;
  `);
  db.pragma('user_version = 2');
  log(`[SUCCESS] ALTER TABLE ADD COLUMN executed successfully!`);
  log(`Database user_version updated to: ${db.pragma('user_version', { simple: true })}`);
} catch (err) {
  log(`[FAILED] ALTER TABLE failed: ${err.message}`);
}

// Verify v1 record has default values for new columns
const rowAfterAlter = db.prepare('SELECT * FROM action_records WHERE id = 1').get();
log(`Existing v1 row after schema migration:`);
log(`  actor_identity: '${rowAfterAlter.actor_identity}', model_name: ${rowAfterAlter.model_name}`);
assert.strictEqual(rowAfterAlter.actor_identity, 'agent');
assert.strictEqual(rowAfterAlter.model_name, null);

// 3. Test Mutation Guard: Attempting UPDATE on existing records during migration
log('\n--- Test 6.2: Immutability Guard during Migration ---');
let updateBlocked = false;
try {
  db.prepare("UPDATE action_records SET model_name = 'gpt-4o' WHERE id = 1").run();
} catch (err) {
  updateBlocked = true;
  log(`[SUCCESS] Attempt to mutate existing historical record was BLOCKED by trigger:`);
  log(`          "${err.message}"`);
}
assert.strictEqual(updateBlocked, true, 'Triggers must protect existing records from mutation even after schema evolution');

// 4. Test Structural Migration Pattern (Atomic Table Recreation)
log('\n--- Test 6.3: Breaking/Structural Migration (Atomic Recreation via Transaction) ---');
// Suppose in v3 we need to reorder columns or change a constraint
const migrateToV3 = db.transaction(() => {
  log('   1. Dropping immutability triggers temporarily inside transaction...');
  db.exec(`
    DROP TRIGGER IF EXISTS trg_action_records_no_update;
    DROP TRIGGER IF EXISTS trg_action_records_no_delete;
  `);

  log('   2. Renaming existing table to backup...');
  db.exec('ALTER TABLE action_records RENAME TO action_records_v2_backup;');

  log('   3. Creating new table structure for v3...');
  db.exec(`
    CREATE TABLE action_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL REFERENCES jobs(id),
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      tool TEXT,
      args TEXT,
      result TEXT,
      snapshot_before TEXT,
      snapshot_after TEXT,
      is_reversible INTEGER NOT NULL DEFAULT 0,
      compensating_action TEXT,
      correlation_id TEXT,
      actor_identity TEXT DEFAULT 'agent',
      model_name TEXT,
      schema_version INTEGER NOT NULL DEFAULT 3,
      timestamp TEXT NOT NULL
    );
  `);

  log('   4. Copying historical records into new table (preserving original data)...');
  db.exec(`
    INSERT INTO action_records (
      id, job_id, seq, type, tool, args, result,
      snapshot_before, snapshot_after, is_reversible,
      compensating_action, correlation_id, actor_identity, model_name,
      schema_version, timestamp
    )
    SELECT
      id, job_id, seq, type, tool, args, result,
      snapshot_before, snapshot_after, is_reversible,
      compensating_action, correlation_id, actor_identity, model_name,
      1, timestamp
    FROM action_records_v2_backup;
  `);

  log('   5. Dropping backup table...');
  db.exec('DROP TABLE action_records_v2_backup;');

  log('   6. Re-establishing immutability triggers on new table...');
  db.exec(`
    CREATE TRIGGER trg_action_records_no_update
    BEFORE UPDATE ON action_records
    BEGIN
        SELECT RAISE(ABORT, 'ActionRecord is append-only: UPDATE is forbidden (FR-LG-02)');
    END;

    CREATE TRIGGER trg_action_records_no_delete
    BEFORE DELETE ON action_records
    BEGIN
        SELECT RAISE(ABORT, 'ActionRecord is append-only: DELETE is forbidden (FR-LG-02)');
    END;
  `);

  db.pragma('user_version = 3');
  log('   7. Updated PRAGMA user_version = 3.');
});

migrateToV3();

// Verify post-v3 state
const v3Version = db.pragma('user_version', { simple: true });
log(`[SUCCESS] Database successfully migrated to v3! (user_version = ${v3Version})`);
const rowV3 = db.prepare('SELECT * FROM action_records WHERE id = 1').get();
log(`Migrated Record 1: id=${rowV3.id}, schema_version=${rowV3.schema_version}, timestamp=${rowV3.timestamp}`);
assert.strictEqual(rowV3.schema_version, 1, 'Historical record preserves its original schema version tag');

// Verify triggers are active again on new table
let updateBlockedAgain = false;
try {
  db.prepare("UPDATE action_records SET model_name = 'claude' WHERE id = 1").run();
} catch (err) {
  updateBlockedAgain = true;
  log(`[VERIFIED] Immutability triggers active on newly migrated table: "${err.message}"`);
}
assert.strictEqual(updateBlockedAgain, true);

// 5. Test Backward Compatibility via SQL Views
log('\n--- Test 6.4: Backward Compatibility via Views ---');
db.exec(`
  CREATE VIEW IF NOT EXISTS v_legacy_action_records AS
  SELECT id, job_id, seq, type, tool, args, result, timestamp
  FROM action_records;
`);
const legacyViewRows = db.prepare('SELECT * FROM v_legacy_action_records WHERE id = 1').all();
log(`Legacy View row count: ${legacyViewRows.length} (Columns: ${Object.keys(legacyViewRows[0]).join(', ')})`);
assert.strictEqual(legacyViewRows.length, 1);

log('\n======================================================================');
log('Q6 CONCLUSION & MIGRATION STRATEGY:');
log('1. Use PRAGMA user_version for migration tracking at app startup.');
log('2. Prefer ADDITIVE evolution (ALTER TABLE ADD COLUMN): works seamlessly without tripping triggers.');
log('3. Historical records remain immutable: old records get NULL/defaults, maintaining audit veracity.');
log('4. For breaking structural changes, use atomic transaction migration: drop triggers -> rename -> create new -> copy -> recreate triggers -> commit.');
log('5. Use Views (e.g. v_legacy_action_records) if legacy code requires old column representations.');
log('======================================================================\n');

db.close();
fs.writeFileSync(logPath, logLines.join('\n'), 'utf8');
console.log(`Log written to: ${logPath}`);
