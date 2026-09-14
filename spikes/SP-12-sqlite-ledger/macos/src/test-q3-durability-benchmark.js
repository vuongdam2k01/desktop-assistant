const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

console.log('======================================================================');
console.log('🔴 Q3: WRITE DURABILITY & THROUGHPUT BENCHMARK (macOS APFS + FileVault)');
console.log('======================================================================');

const evidenceDir = path.join(__dirname, '../evidence');
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

// -----------------------------------------------------------------------------
// PART 1: Multi-Trial Crash Injection Stress Test (20 iterations per point)
// -----------------------------------------------------------------------------
console.log('\n--- PART 1: Multi-Trial Crash Stress Test (20 iterations x 5 points) ---');

function runStressTest(fullfsyncVal, syncVal, label) {
  console.log(`\nTesting ${label} (SQLITE_FULLFSYNC=${fullfsyncVal}, SQLITE_SYNCHRONOUS=${syncVal})...`);
  const trialsPerPoint = 20;
  let totalTrials = 0;
  let passedTrials = 0;
  let lostRecords = 0;

  for (let pt = 1; pt <= 5; pt++) {
    for (let i = 1; i <= trialsPerPoint; i++) {
      totalTrials++;
      const proc = spawnSync('node', [path.join(__dirname, 'test-single-crash.js'), String(pt)], {
        env: {
          ...process.env,
          SQLITE_FULLFSYNC: String(fullfsyncVal),
          SQLITE_SYNCHRONOUS: syncVal
        },
        encoding: 'utf8'
      });

      if (proc.status === 0) {
        passedTrials++;
      } else {
        console.error(`  ❌ Failed at Point ${pt}, trial ${i}: status ${proc.status}`);
        lostRecords++;
      }
    }
  }

  console.log(`Summary for ${label}:`);
  console.log(`  Total Trials: ${totalTrials}`);
  console.log(`  Passed Trials: ${passedTrials}`);
  console.log(`  Lost/Corrupted Records: ${lostRecords}`);
  console.log(`  Pass Rate: ${((passedTrials / totalTrials) * 100).toFixed(1)}%`);
  return { label, totalTrials, passedTrials, lostRecords };
}

const stressOff = runStressTest(0, 'NORMAL', 'Mode A: Default fsync (fullfsync=0, sync=NORMAL)');
const stressOn = runStressTest(1, 'FULL', 'Mode B: F_FULLFSYNC Safe (fullfsync=1, sync=FULL)');

// -----------------------------------------------------------------------------
// PART 2: Write Throughput & Latency Benchmark
// -----------------------------------------------------------------------------
console.log('\n--- PART 2: Write Throughput & Latency Benchmark (500 ledger commits each) ---');

const benchmarkConfigs = [
  { name: '1. WAL + NORMAL + fullfsync=0 (Default)', sync: 'NORMAL', fullfsync: 0 },
  { name: '2. WAL + NORMAL + fullfsync=1', sync: 'NORMAL', fullfsync: 1 },
  { name: '3. WAL + FULL + fullfsync=0', sync: 'FULL', fullfsync: 0 },
  { name: '4. WAL + FULL + fullfsync=1 (Full Safe)', sync: 'FULL', fullfsync: 1 },
  { name: '5. WAL + EXTRA + fullfsync=1 (Max Paranoid)', sync: 'EXTRA', fullfsync: 1 }
];

const N = 500; // 500 individual ledger write transactions
const benchmarkResults = [];

benchmarkConfigs.forEach(cfg => {
  const dbFile = path.join(evidenceDir, `bench_${cfg.sync}_ff${cfg.fullfsync}.db`);
  [dbFile, `${dbFile}-wal`, `${dbFile}-shm`].forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });

  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma(`synchronous = ${cfg.sync}`);
  if (cfg.fullfsync) {
    db.pragma('fullfsync = ON');
    db.pragma('checkpoint_fullfsync = ON');
  } else {
    db.pragma('fullfsync = OFF');
    db.pragma('checkpoint_fullfsync = OFF');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS action_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      tool TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const insertStmt = db.prepare(`
    INSERT INTO action_records (job_id, seq, type, tool, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const latencies = [];
  const startTotal = process.hrtime.bigint();

  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    // Wrap in explicit transaction to force synchronous flush at commit
    db.transaction(() => {
      insertStmt.run(
        `job_bench_${i}`,
        i,
        'tool_intent',
        'notion_update_page',
        JSON.stringify({ pageId: 'p123', status: 'In Progress', note: 'Stress testing ledger throughput' }),
        new Date().toISOString()
      );
    })();
    const t1 = process.hrtime.bigint();
    latencies.push(Number(t1 - t0) / 1e6); // convert to milliseconds
  }

  const endTotal = process.hrtime.bigint();
  const totalDurationMs = Number(endTotal - startTotal) / 1e6;
  const writesPerSec = (N / (totalDurationMs / 1000)).toFixed(1);

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(3);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(3);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(3);
  const min = latencies[0].toFixed(3);
  const max = latencies[latencies.length - 1].toFixed(3);

  db.close();
  [dbFile, `${dbFile}-wal`, `${dbFile}-shm`].forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });

  const res = {
    name: cfg.name,
    sync: cfg.sync,
    fullfsync: cfg.fullfsync,
    totalDurationMs: totalDurationMs.toFixed(1),
    writesPerSec: Number(writesPerSec),
    minMs: Number(min),
    p50Ms: Number(p50),
    p95Ms: Number(p95),
    p99Ms: Number(p99),
    maxMs: Number(max)
  };
  benchmarkResults.push(res);

  console.log(`Result: ${cfg.name}`);
  console.log(`  -> ${writesPerSec} writes/sec | Total: ${totalDurationMs.toFixed(1)}ms`);
  console.log(`  -> Latency: min=${min}ms, p50=${p50}ms, p95=${p95}ms, p99=${p99}ms, max=${max}ms`);
});

const reportData = {
  stressTests: { stressOff, stressOn },
  benchmarkResults
};

fs.writeFileSync(
  path.join(evidenceDir, 'q3-durability-benchmark.json'),
  JSON.stringify(reportData, null, 2),
  'utf8'
);
console.log(`\nSaved benchmark data to evidence/q3-durability-benchmark.json`);
