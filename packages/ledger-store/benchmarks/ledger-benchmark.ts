import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import performance from 'node:perf_hooks';
import Database from 'better-sqlite3';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { getInternalDatabaseForTesting } from '../src/internal-test.js';
interface BenchmarkResult {
  platform: string;
  totalJobs: number;
  unresolvedIntentsCount: number;
  retentionSpanDays: number;
  firstStartClassificationMs: number;
  classificationLatency: {
    iterations: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  walCheckpoint: {
    busy: number;
    log: number;
    checkpointed: number;
  };
  macosComparison:
    | {
        status: 'not_run';
        reason: string;
      }
    | {
        status: 'completed';
        bufferedMode: {
          commits: number;
          writesPerSec: number;
          p50Ms: number;
          p95Ms: number;
          p99Ms: number;
        };
        durableMode: {
          commits: number;
          writesPerSec: number;
          p50Ms: number;
          p95Ms: number;
          p99Ms: number;
        };
      };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index]!;
}

async function populateBenchmarkStore(store: LedgerStore, totalJobs: number): Promise<void> {
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const stepMs = Math.floor(ninetyDaysMs / totalJobs);

  console.log(`Populating benchmark store with ${totalJobs} jobs over 90 simulated days...`);

  // Direct raw batching for benchmark population speed while maintaining 100% schema validity
  const db = getInternalDatabaseForTesting(store);
  db.transaction(() => {
    const jobStmt = db.prepare(
      `INSERT INTO job (
        id, original_request, state, approval_mode, summary_result, undo_of,
        created_at, updated_at, state_changed_at
      ) VALUES (?, ?, ?, 'smart', NULL, NULL, ?, ?, ?)`
    );

    const recordStmt = db.prepare(
      `INSERT INTO action_record (
        record_id, job_id, position, type, origin_device, origin_sequence,
        recorded_at, correlation_id, references_json, content
      ) VALUES (?, ?, ?, ?, 'dev_bench_1', ?, ?, ?, NULL, ?)`
    );

    let originSeq = 0;

    for (let i = 0; i < totalJobs; i++) {
      const jobId = `job_bench_${i.toString().padStart(5, '0')}`;
      const recordTimeMs = now - (totalJobs - i) * stepMs;
      const recordedAt = new Date(recordTimeMs).toISOString();
      const isUnresolved = i >= totalJobs - 5; // last 5 jobs are in flight (unresolved)
      const jobState = isUnresolved ? 'running' : 'done';

      jobStmt.run(jobId, `Benchmark job ${jobId}`, jobState, recordedAt, recordedAt, recordedAt);

      const correlationId = `corr_${jobId}`;
      const intentRecordId = `rec_int_${jobId}`;

      const intentContent = JSON.stringify({
        connector: 'notion',
        tool: 'update_page',
        parameters: { page_id: `page_${i}` },
        before: { captured: true, target: `page_${i}`, state: { v: 1 } },
        reversibility: { kind: 'reversible', snapshotMethod: 'read_page' },
        reconciliation: { method: 'readback', read_operation: 'get_page' },
      });

      recordStmt.run(
        intentRecordId,
        jobId,
        0,
        'intent',
        originSeq++,
        recordedAt,
        correlationId,
        intentContent
      );

      if (!isUnresolved) {
        const resultRecordId = `rec_res_${jobId}`;
        const resultContent = JSON.stringify({
          outcome: 'succeeded',
          establishedBy: 'observed',
          after: { captured: true, target: `page_${i}`, state: { v: 2 } },
          compensatingAction: {
            connector: 'notion',
            tool: 'update_page',
            parameters: { page_id: `page_${i}` },
          },
        });

        recordStmt.run(
          resultRecordId,
          jobId,
          1,
          'result',
          originSeq++,
          recordedAt,
          correlationId,
          resultContent
        );
      }
    }

    db.prepare(
      `INSERT OR REPLACE INTO device_sequence (device_id, last_sequence) VALUES ('dev_bench_1', ?)`
    ).run(originSeq - 1);
  })();

  console.log('Benchmark database populated.');
}

async function runMacosDurabilityComparison(dir: string): Promise<BenchmarkResult['macosComparison']> {
  if (process.platform !== 'darwin') {
    return {
      status: 'not_run',
      reason: `Current host platform is ${process.platform} (not darwin). macOS hardware-flush measurement cited from spikes/SP-12-sqlite-ledger/macos/REPORT.md (~28,314.9 buffered vs ~241.1 durable writes/s).`,
    };
  }

  const commitsCount = 500;

  // 1. Buffered mode (WAL / NORMAL / fullfsync OFF)
  const bufPath = path.join(dir, 'bench_buf.db');
  const bufDb = new Database(bufPath);
  bufDb.pragma('journal_mode = WAL');
  bufDb.pragma('synchronous = NORMAL');
  bufDb.pragma('fullfsync = OFF');
  bufDb.pragma('checkpoint_fullfsync = OFF');
  bufDb.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);');

  const bufLatencies: number[] = [];
  const bufStart = performance.performance.now();
  for (let i = 0; i < commitsCount; i++) {
    const t0 = performance.performance.now();
    bufDb.prepare('INSERT INTO t (v) VALUES (?)').run(`val_${i}`);
    bufLatencies.push(performance.performance.now() - t0);
  }
  const bufTotalSec = (performance.performance.now() - bufStart) / 1000;
  bufDb.close();

  // 2. Durable mode (WAL / FULL / fullfsync ON / checkpoint_fullfsync ON)
  const durPath = path.join(dir, 'bench_dur.db');
  const durDb = new Database(durPath);
  durDb.pragma('journal_mode = WAL');
  durDb.pragma('synchronous = FULL');
  durDb.pragma('fullfsync = ON');
  durDb.pragma('checkpoint_fullfsync = ON');
  durDb.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT);');

  const durLatencies: number[] = [];
  const durStart = performance.performance.now();
  for (let i = 0; i < commitsCount; i++) {
    const t0 = performance.performance.now();
    durDb.prepare('INSERT INTO t (v) VALUES (?)').run(`val_${i}`);
    durLatencies.push(performance.performance.now() - t0);
  }
  const durTotalSec = (performance.performance.now() - durStart) / 1000;
  durDb.close();

  return {
    status: 'completed',
    bufferedMode: {
      commits: commitsCount,
      writesPerSec: Number((commitsCount / bufTotalSec).toFixed(1)),
      p50Ms: Number(percentile(bufLatencies, 50).toFixed(3)),
      p95Ms: Number(percentile(bufLatencies, 95).toFixed(3)),
      p99Ms: Number(percentile(bufLatencies, 99).toFixed(3)),
    },
    durableMode: {
      commits: commitsCount,
      writesPerSec: Number((commitsCount / durTotalSec).toFixed(1)),
      p50Ms: Number(percentile(durLatencies, 50).toFixed(3)),
      p95Ms: Number(percentile(durLatencies, 95).toFixed(3)),
      p99Ms: Number(percentile(durLatencies, 99).toFixed(3)),
    },
  };
}

async function main(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-bench-'));
  const dbPath = path.join(tmpDir, 'benchmark.db');
  const totalJobs = 4500;

  try {
    let store = await openLedgerStore({ path: dbPath, deviceId: 'dev_bench_1' });
    await populateBenchmarkStore(store, totalJobs);
    await store.close();

    // Reopen to measure genuine first-start classification
    store = await openLedgerStore({ path: dbPath, deviceId: 'dev_bench_1' });

    const tFirstStart0 = performance.performance.now();
    const unresolvedInitial = await store.unresolvedIntents();
    const firstStartClassificationMs = Number(
      (performance.performance.now() - tFirstStart0).toFixed(3)
    );

    // Warm iterations
    const iterations = 100;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.performance.now();
      await store.unresolvedIntents();
      latencies.push(performance.performance.now() - t0);
    }

    const p50Ms = Number(percentile(latencies, 50).toFixed(3));
    const p95Ms = Number(percentile(latencies, 95).toFixed(3));
    const p99Ms = Number(percentile(latencies, 99).toFixed(3));

    // Checkpoint measurement
    const rawDb = getInternalDatabaseForTesting(store);
    const checkpointRow = rawDb
      .prepare('PRAGMA wal_checkpoint(PASSIVE)')
      .get() as { busy: number; log: number; checkpointed: number };

    const macosComp = await runMacosDurabilityComparison(tmpDir);

    await store.close();

    const result: BenchmarkResult = {
      platform: process.platform,
      totalJobs,
      unresolvedIntentsCount: unresolvedInitial.length,
      retentionSpanDays: 90,
      firstStartClassificationMs,
      classificationLatency: {
        iterations,
        p50Ms,
        p95Ms,
        p99Ms,
      },
      walCheckpoint: {
        busy: checkpointRow ? checkpointRow.busy : 0,
        log: checkpointRow ? checkpointRow.log : 0,
        checkpointed: checkpointRow ? checkpointRow.checkpointed : 0,
      },
      macosComparison: macosComp,
    };

    console.log('\n=== LEDGER BENCHMARK RESULTS (JSON) ===');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {
      // Best effort cleanup
    }
  }
}

main().catch((err: unknown) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
