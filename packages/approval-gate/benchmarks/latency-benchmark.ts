import { HardGateEvaluator } from '../src/evaluator/evaluator.js';
import type { CallSubject, EvaluationContext, Rule } from '../src/types.js';

function percentile(sorted: number[], p: number): number {
  const index = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[index] ?? 0;
}

export function runLatencyBenchmark(iterations = 10000): {
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
} {
  const sampleRules: Rule[] = [
    {
      representationVersion: '1.0.0',
      id: 'R-01',
      name: 'Ask before delete or archive',
      restatement: 'Confirm before archiving',
      origin: 'user',
      verdict: 'hold',
      condition: { kind: 'tool', tool: ['archive_page', 'delete_block'] },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      representationVersion: '1.0.0',
      id: 'R-02',
      name: 'Ask before changing Due Date',
      restatement: 'Confirm before changing Due Date',
      origin: 'user',
      verdict: 'hold',
      condition: { kind: 'field', changes: { includes: 'due_date' } },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      representationVersion: '1.0.0',
      id: 'R-03',
      name: 'Refuse all changes to HR Portal database',
      restatement: 'Never modify HR Portal database',
      origin: 'user',
      verdict: 'refuse',
      condition: { kind: 'scope', objectId: 'db-hr-portal-uuid-001' },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      representationVersion: '1.0.0',
      id: 'R-05',
      name: 'Ask before marking task Done',
      restatement: 'Confirm status Done',
      origin: 'user',
      verdict: 'hold',
      condition: { kind: 'field', becomes: { field: 'status', equals: 'Done' } },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      representationVersion: '1.0.0',
      id: 'R-10',
      name: 'Protect Q3 Roadmap subpages',
      restatement: 'Protect Q3 Roadmap and all descendant pages',
      origin: 'user',
      verdict: 'hold',
      condition: { kind: 'scope', ancestor: { contains: 'page-q3-roadmap-uuid-003' } },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      representationVersion: '1.0.0',
      id: 'R-15',
      name: 'Hold after more than 5 writes in job',
      restatement: 'Stop after 5 writes in job',
      origin: 'user',
      verdict: 'hold',
      condition: { kind: 'count', metric: 'writes', boundary: 'job', operator: 'gt', value: 5 },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    },
  ];

  const evaluator = new HardGateEvaluator({ rules: sampleRules });

  const subjects: CallSubject[] = [
    {
      callId: 'bench-1',
      connector: 'notion',
      tool: 'update_page_properties',
      arguments: { properties: { Status: { name: 'Done' }, 'Due date': '2026-10-01' } },
      object: {
        type: 'page',
        id: 'page-101',
        ancestorIds: ['page-q3-roadmap-uuid-003', 'db-root'],
        createdBy: 'current_user',
      },
      isIrreversible: false,
      changesPermission: false,
    },
    {
      callId: 'bench-2',
      connector: 'notion',
      tool: 'create_page',
      arguments: { properties: { Title: 'A fresh task' } },
      isIrreversible: false,
      changesPermission: false,
    },
    {
      callId: 'bench-3',
      connector: 'notion',
      tool: 'archive_page',
      arguments: { page_id: 'page-archive-target' },
      object: { type: 'page', id: 'page-archive-target', ancestorIds: [] },
      isIrreversible: false,
      changesPermission: false,
    },
  ];

  const context: EvaluationContext = {
    jobId: 'job-benchmark',
    mode: 'smart',
    currentUser: 'alice',
    now: '2026-09-15T12:00:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
    counts: { writes_job: 3 },
  };

  // Warmup 500 iterations
  for (let i = 0; i < 500; i++) {
    const s = subjects[i % subjects.length]!;
    evaluator.evaluate(s, context);
  }

  // Measurement
  const latenciesMs: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const s = subjects[i % subjects.length]!;
    const t0 = performance.now();
    evaluator.evaluate(s, context);
    const t1 = performance.now();
    latenciesMs[i] = t1 - t0;
  }

  latenciesMs.sort((a, b) => a - b);

  const sum = latenciesMs.reduce((acc, v) => acc + v, 0);
  const meanMs = sum / iterations;
  const p50Ms = percentile(latenciesMs, 50);
  const p90Ms = percentile(latenciesMs, 90);
  const p95Ms = percentile(latenciesMs, 95);
  const p99Ms = percentile(latenciesMs, 99);
  const maxMs = latenciesMs[latenciesMs.length - 1] ?? 0;

  console.log(`[Latency Benchmark] Iterations: ${iterations}`);
  console.log(`  Mean:  ${(meanMs * 1000).toFixed(2)} µs (${meanMs.toFixed(4)} ms)`);
  console.log(`  p50:   ${(p50Ms * 1000).toFixed(2)} µs (${p50Ms.toFixed(4)} ms)`);
  console.log(`  p90:   ${(p90Ms * 1000).toFixed(2)} µs (${p90Ms.toFixed(4)} ms)`);
  console.log(`  p95:   ${(p95Ms * 1000).toFixed(2)} µs (${p95Ms.toFixed(4)} ms)`);
  console.log(`  p99:   ${(p99Ms * 1000).toFixed(2)} µs (${p99Ms.toFixed(4)} ms)`);
  console.log(`  Max:   ${(maxMs * 1000).toFixed(2)} µs (${maxMs.toFixed(4)} ms)`);

  if (p99Ms >= 1.0) {
    throw new Error(`Latency benchmark failed: p99 ${p99Ms.toFixed(4)} ms exceeds 1.0 ms budget!`);
  }

  return { meanMs, p50Ms, p90Ms, p95Ms, p99Ms, maxMs };
}

// Run when executed directly via tsx
runLatencyBenchmark();
