import fs from 'node:fs';
import process from 'node:process';
import { openLedgerStore } from '../../src/opener.js';
import { makeIntentInput, makeResultInput, makeDecisionInput } from '../helpers/test-env.js';

function parseArgs(): {
  dbPath: string;
  crashPoint: number;
  sentinelPath: string;
  jobId: string;
  deviceId: string;
} {
  const args = process.argv.slice(2);
  let dbPath = '';
  let crashPoint = 0;
  let sentinelPath = '';
  let jobId = 'job_crash_test';
  let deviceId = 'dev_crash_worker';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--db' && args[i + 1]) {
      dbPath = args[++i]!;
    } else if (arg === '--crash-point' && args[i + 1]) {
      crashPoint = parseInt(args[++i]!, 10);
    } else if (arg === '--sentinel' && args[i + 1]) {
      sentinelPath = args[++i]!;
    } else if (arg === '--job' && args[i + 1]) {
      jobId = args[++i]!;
    } else if (arg === '--device' && args[i + 1]) {
      deviceId = args[++i]!;
    }
  }

  if (!dbPath || !sentinelPath) {
    console.error('Usage: crash-worker --db <path> --crash-point <1-5> --sentinel <path> [--job <id>] [--device <id>]');
    process.exit(2);
  }

  return { dbPath, crashPoint, sentinelPath, jobId, deviceId };
}

function hardCrash(point: number): void {
  console.log(`[CRASH-WORKER] Hard terminating at point ${point}...`);
  process.kill(process.pid, 'SIGKILL');
}

async function main(): Promise<void> {
  const { dbPath, crashPoint, sentinelPath, jobId, deviceId } = parseArgs();
  const store = await openLedgerStore({ path: dbPath, deviceId });

  // Ensure job exists
  const job = await store.getJob(jobId);
  if (!job) {
    await store.createJob({
      id: jobId,
      originalRequest: `Crash test job ${jobId}`,
      approvalMode: 'smart',
    });
  }

  // ── Crash Point 1: Before Decision ───────────────────────────────────────
  if (crashPoint === 1) {
    hardCrash(1);
  }

  // Record Decision
  await store.appendDecision(
    makeDecisionInput(jobId, { reason: 'Automated decision before tool execution' })
  );

  // ── Crash Point 2: After Decision, Before Intent ─────────────────────────
  if (crashPoint === 2) {
    hardCrash(2);
  }

  // Record Intent
  const correlationId = `corr_${jobId}`;
  await store.appendIntent(
    makeIntentInput(jobId, correlationId, {
      tool: 'update_page',
      parameters: { page_id: 'page_crash_1', status: 'In Progress' },
    })
  );

  // ── Crash Point 3: After Durable Intent, Before External Effect ──────────
  if (crashPoint === 3) {
    hardCrash(3);
  }

  // Deterministic External Effect: write sentinel file to filesystem
  fs.writeFileSync(sentinelPath, `EXTERNAL_EFFECT_PERFORMED:${jobId}:${Date.now()}`, 'utf8');

  // ── Crash Point 4: After External Effect Succeeded, Before Result ────────
  if (crashPoint === 4) {
    hardCrash(4);
  }

  // Record Result
  await store.appendResult(
    makeResultInput(jobId, correlationId, {
      outcome: 'succeeded',
      establishedBy: 'observed',
    })
  );

  // ── Crash Point 5: After Durable Result, Before Job Projection Update ───
  if (crashPoint === 5) {
    hardCrash(5);
  }

  // Update Job Projection to done
  await store.setJobState(jobId, 'done');
  await store.close();

  console.log('[CRASH-WORKER] Completed normally without crashing.');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[CRASH-WORKER] Fatal error:', err);
  process.exit(1);
});
