import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LedgerDb } from './ledger.js';
import { runQ1Test } from './test-q1-writes.js';
import { runQ2Test } from './test-q2-dirty-snapshot.js';
import { runQ3Benchmark } from './test-q3-queue-benchmark.js';
import { runQ4ConcurrencyTest } from './test-q4-concurrency-limits.js';
import { runQ5ConflictTest } from './test-q5-conflict-detection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, '../evidence');
const dbPath = path.resolve(evidenceDir, 'sp15-ledger.db');

if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// Remove old database if exists to ensure clean run
if (fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
  } catch {}
}

async function main() {
  console.log('================================================================');
  console.log('  STARTING SPIKE SP-15 CONCURRENCY & RATE LIMIT TEST SUITE');
  console.log('  Target: Notion Workspace B (Complex Schema: Relation, Rollup, Formula)');
  console.log('================================================================\n');

  const ledgerDb = new LedgerDb(dbPath);

  try {
    // 1. Q1: Concurrent writes on same page
    console.log('\n>>> STEP 1: Running Q1 Concurrent Writes...');
    const q1Result = await runQ1Test();
    fs.writeFileSync(path.join(evidenceDir, 'q1-concurrent-writes.json'), JSON.stringify(q1Result, null, 2));

    // 2. Q2: Dirty snapshot & ledger correctness
    console.log('\n>>> STEP 2: Running Q2 Dirty Snapshot & Ledger Correctness...');
    const q2Result = await runQ2Test(ledgerDb);
    fs.writeFileSync(path.join(evidenceDir, 'q2-dirty-snapshot.json'), JSON.stringify(q2Result, null, 2));

    // 3. Q3: Rate queue benchmark (FIFO vs Fair Queueing)
    console.log('\n>>> STEP 3: Running Q3 Rate Queue Benchmark...');
    const q3Result = await runQ3Benchmark();
    fs.writeFileSync(path.join(evidenceDir, 'q3-fair-queue-benchmark.json'), JSON.stringify(q3Result, null, 2));

    // 4. Q4: Concurrency scaling test
    console.log('\n>>> STEP 4: Running Q4 Concurrency Scaling Test...');
    const q4Result = await runQ4ConcurrencyTest();
    fs.writeFileSync(path.join(evidenceDir, 'q4-concurrency-scaling.json'), JSON.stringify(q4Result, null, 2));

    // 5. Q5: Conflict detection under concurrent writes
    console.log('\n>>> STEP 5: Running Q5 Conflict Detection...');
    const q5Result = await runQ5ConflictTest();
    fs.writeFileSync(path.join(evidenceDir, 'q5-conflict-detection.json'), JSON.stringify(q5Result, null, 2));

    // Summary output
    const summary = {
      completedAt: new Date().toISOString(),
      q1_lastWriteWins: q1Result.case1_overlappingProperty.lastWriteWinsConfirmed,
      q2_ledgerValidWithoutLock: q2Result.verdict.isLedgerValidWithoutLock,
      q2_lostUpdateObserved: q2Result.unlockedRace.undoJobB_result.corruptedJobA,
      q2_lockPreservedJobA: q2Result.lockedExecution.undoJobB_result.preservedJobA,
      q3_fairQueueSpeedupRatio: q3Result.fairQueue.job2SpeedupRatio,
      q4_recommendedConcurrencyLimit: q4Result.recommendedConcurrencyLimit.maxTotalConcurrent,
      q5_overlappingConflictCaught: q5Result.case1_overlappingField.conflictDetectedByPropertyDiff,
    };
    fs.writeFileSync(path.join(evidenceDir, 'sp15-summary.json'), JSON.stringify(summary, null, 2));

    console.log('\n================================================================');
    console.log('  ALL SP-15 EXPERIMENTS COMPLETED SUCCESSFULLY!');
    console.log('  Summary:', JSON.stringify(summary, null, 2));
    console.log('  Evidence files saved in:', evidenceDir);
    console.log('================================================================\n');
  } catch (err) {
    console.error('CRITICAL ERROR in SP-15 runner:', err);
    process.exit(1);
  } finally {
    ledgerDb.close();
  }
}

main();
