const { spawnSync } = require('node:child_process');
const { CardQueue } = require('./card-queue');
const path = require('node:path');
const assert = require('node:assert');

console.log(`======================================================================`);
console.log(`🚀 AUTOMATED CRASH INJECTION & RECOVERY SUITE ON MACOS (5 POINTS)`);
console.log(`======================================================================`);

const modes = [
  { name: 'Mode A (Default fsync: fullfsync=0, sync=NORMAL)', env: { SQLITE_FULLFSYNC: '0', SQLITE_SYNCHRONOUS: 'NORMAL' } },
  { name: 'Mode B (F_FULLFSYNC Safe: fullfsync=1, sync=FULL)', env: { SQLITE_FULLFSYNC: '1', SQLITE_SYNCHRONOUS: 'FULL' } }
];

for (const mode of modes) {
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`⚡ RUNNING SUITE IN ${mode.name}`);
  console.log(`----------------------------------------------------------------------`);

  for (let point = 1; point <= 5; point++) {
    const proc = spawnSync('node', [path.join(__dirname, 'test-single-crash.js'), String(point)], {
      env: { ...process.env, ...mode.env },
      stdio: 'inherit',
      encoding: 'utf8'
    });

    if (proc.status !== 0) {
      console.error(`❌ Crash Point ${point} failed in ${mode.name} with exit code ${proc.status}`);
      process.exit(1);
    }
  }
}

console.log(`\n======================================================================`);
console.log(`🧪 TESTING CARD BLOCKING QUEUE PRIORITY RECONSTRUCTION (FR-INT-15, E5)`);
console.log(`======================================================================`);

const queue = new CardQueue();
const t0 = Date.now();

// Enqueue cards in non-priority order
queue.enqueue({
  id: 'card_result',
  jobId: 'job_4',
  type: 'RESULT',
  title: 'Job 4 Xong',
  createdAt: new Date(t0 + 4000).toISOString()
});

queue.enqueue({
  id: 'card_error',
  jobId: 'job_3',
  type: 'ERROR',
  title: 'Job 3 Lỗi',
  createdAt: new Date(t0 + 3000).toISOString()
});

queue.enqueue({
  id: 'card_approval_2',
  jobId: 'job_2',
  type: 'APPROVAL',
  title: 'Job 2 Chờ Duyệt (Đến sau)',
  createdAt: new Date(t0 + 2000).toISOString()
});

queue.enqueue({
  id: 'card_ask_1',
  jobId: 'job_1',
  type: 'ASK',
  title: 'Job 1 Hỏi Thông Tin (Đến trước)',
  createdAt: new Date(t0 + 1000).toISOString()
});

const sortedCards = queue.getAll();
console.log(`Card Queue After Priority Sorting:`);
sortedCards.forEach((c, idx) => {
  console.log(`  [${idx + 1}] Type: ${c.type.padEnd(8)} | Job: ${c.jobId.padEnd(6)} | Created: ${c.createdAt}`);
});

// Verification against PRD A.4:
// "ASK = APPROVAL (FIFO giữa chúng) > ERROR > RESULT > ACK/PROGRESS"
assert.strictEqual(sortedCards[0].type, 'ASK', 'ASK arrived first in tier 1');
assert.strictEqual(sortedCards[0].jobId, 'job_1');

assert.strictEqual(sortedCards[1].type, 'APPROVAL', 'APPROVAL arrived second in tier 1');
assert.strictEqual(sortedCards[1].jobId, 'job_2');

assert.strictEqual(sortedCards[2].type, 'ERROR', 'ERROR is tier 2');
assert.strictEqual(sortedCards[2].jobId, 'job_3');

assert.strictEqual(sortedCards[3].type, 'RESULT', 'RESULT is tier 3');
assert.strictEqual(sortedCards[3].jobId, 'job_4');

console.log(`✔ Card Queue Priority Sorting PASSED all assertions!`);

console.log(`\n======================================================================`);
console.log(`🎉 ALL CRASH INJECTION TESTS & CARD PRIORITY TESTS PASSED IN BOTH MODES!`);
console.log(`======================================================================\n`);
