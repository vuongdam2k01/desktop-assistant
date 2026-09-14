const { spawnSync } = require('node:child_process');
const { createDatabase } = require('./db');
const { JobRepository } = require('./job-repository');
const { LedgerRepository } = require('./ledger');
const { MockNotionService } = require('./mock-notion');
const { RecoveryManager } = require('./recovery');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const point = process.argv[2];
if (!point) {
  console.error('Usage: node test-single-crash.js <point_1_to_5>');
  process.exit(1);
}

const descriptions = {
  '1': 'Before user approval decision (Job in waiting_approval)',
  '2': 'After approval recorded, BEFORE tool_intent written',
  '3': 'After tool_intent committed, BEFORE external API call',
  '4': 'After external API call succeeded, BEFORE tool_result committed',
  '5': 'After tool_result committed, BEFORE job status marked completed'
};

const description = descriptions[point];
console.log(`\n======================================================================`);
console.log(`🧪 TESTING CRASH POINT ${point}: ${description}`);
console.log(`======================================================================`);

const evidenceDir = path.join(__dirname, '../evidence');
const dbPath = path.join(evidenceDir, `crash_pt${point}.db`);
const notionStatePath = path.join(evidenceDir, `notion_pt${point}.json`);
const logFilePath = path.join(evidenceDir, `crash-point-${point}.log`);

// Clean up existing files
[dbPath, `${dbPath}-wal`, `${dbPath}-shm`, notionStatePath].forEach(f => {
  if (fs.existsSync(f)) fs.unlinkSync(f);
});

const notionMock = new MockNotionService(notionStatePath);
notionMock.reset();

const logLines = [];
function log(msg) {
  console.log(msg);
  logLines.push(msg);
}

log(`[RUNNER] Launching worker with CRASH_POINT=${point}...`);

const jobId = `job_crash_pt${point}`;
const workerEnv = {
  ...process.env,
  DB_PATH: dbPath,
  NOTION_STATE_PATH: notionStatePath,
  CRASH_POINT: String(point),
  JOB_ID: jobId,
  PAGE_ID: 'page_task_101'
};

const proc = spawnSync('node', [path.join(__dirname, 'worker.js')], {
  env: workerEnv,
  encoding: 'utf8'
});

log(`\n--- Worker Output (pre-crash) ---`);
if (proc.stdout) log(proc.stdout.trim());
if (proc.stderr) log(`Stderr: ${proc.stderr.trim()}`);

log(`\n--- Crash Exit Status ---`);
log(`Exit Code: ${proc.status}`);
log(`Signal: ${proc.signal}`);

// Assert worker died abruptly (SIGKILL on POSIX, TerminateProcess on Windows)
if (process.platform === 'win32') {
  assert.notStrictEqual(proc.status, 0, `Worker must terminate abruptly on Windows at crash point ${point}`);
} else {
  assert.strictEqual(proc.signal, 'SIGKILL', `Worker must terminate with SIGKILL at crash point ${point}`);
}

// Assert SQLite database integrity
const db = createDatabase(dbPath);
const integrityCheck = db.pragma('integrity_check');
log(`\n--- SQLite WAL Integrity Check ---`);
log(`PRAGMA integrity_check: ${JSON.stringify(integrityCheck)}`);
assert.strictEqual(integrityCheck[0].integrity_check, 'ok', 'Database integrity must be ok after SIGKILL');
db.close();

// Run Recovery Protocol
log(`\n--- Running Recovery Protocol ---`);
const recoveryLogs = [];
const recovery = new RecoveryManager({
  dbPath,
  notionStatePath,
  logFn: msg => {
    console.log(msg);
    recoveryLogs.push(msg);
  }
});

const recoveryResult = recovery.recover();
logLines.push(...recoveryLogs);
recovery.close();

// Verification Assertions based on Crash Point
const verifyDb = createDatabase(dbPath);
const verifyJobs = new JobRepository(verifyDb);
const verifyLedger = new LedgerRepository(verifyDb);

const job = verifyJobs.getJob(jobId);
log(`\n--- Post-Recovery Verification ---`);
log(`Job ID: ${job.id}`);
log(`Job Status: ${job.status}`);
const records = verifyLedger.getRecordsByJobId(jobId);
log(`Ledger Records Count: ${records.length}`);
records.forEach(r => log(`  - seq=${r.seq} | type=${r.type} | tool=${r.tool}`));

assert(job !== undefined && job !== null, `Job ${jobId} must exist after crash (NFR-RL-01)`);

if (point === '1') {
  assert.strictEqual(job.status, 'waiting_approval');
  const topCard = recoveryResult.cardQueue[0];
  assert.strictEqual(topCard.type, 'APPROVAL');
  assert.strictEqual(topCard.jobId, jobId);
  log(`✔ Point 1 PASSED: Job retained 'waiting_approval', APPROVAL card restored.`);
} else if (point === '2') {
  assert.strictEqual(job.status, 'waiting_approval');
  const topCard = recoveryResult.cardQueue[0];
  assert.strictEqual(topCard.type, 'APPROVAL');
  log(`✔ Point 2 PASSED: Approved state preserved, prompt restored.`);
} else if (point === '3') {
  const finalNotion = new MockNotionService(notionStatePath);
  const page = finalNotion.getPage('page_task_101');
  assert.strictEqual(page.properties.Status.status.name, 'To Do');
  assert.strictEqual(job.status, 'failed');
  const errorRecord = records.find(r => r.type === 'error');
  assert(errorRecord !== undefined);
  const topCard = recoveryResult.cardQueue[0];
  assert.strictEqual(topCard.type, 'ERROR');
  log(`✔ Point 3 PASSED: External state untouched, fail-closed preserved, job cleanly failed.`);
} else if (point === '4') {
  const finalNotion = new MockNotionService(notionStatePath);
  const page = finalNotion.getPage('page_task_101');
  assert.strictEqual(page.properties.Status.status.name, 'In Progress');
  assert.strictEqual(job.status, 'completed');
  const resultRecord = records.find(r => r.type === 'tool_result');
  assert(resultRecord !== undefined);
  assert.strictEqual(resultRecord.result.reconciled_after_crash, true);
  const topCard = recoveryResult.cardQueue[0];
  assert.strictEqual(topCard.type, 'RESULT');
  log(`✔ Point 4 PASSED: Reconciliation detected external success, tool_result appended, double execution prevented!`);
} else if (point === '5') {
  assert.strictEqual(job.status, 'completed');
  const topCard = recoveryResult.cardQueue[0];
  assert.strictEqual(topCard.type, 'RESULT');
  log(`✔ Point 5 PASSED: Job marked completed, RESULT card displayed.`);
}

verifyDb.close();

fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf8');
console.log(`📄 Log file written: ${logFilePath}`);
