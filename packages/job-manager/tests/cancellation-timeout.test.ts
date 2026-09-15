import { describe, it, expect, afterEach, vi } from 'vitest';
import type { DecisionRecord } from '@desktop-assistant/ledger-store';
import { createTestHarness, type TestHarness } from './helpers/test-env.js';
import { JobCancelledError } from '../src/errors.js';

describe('Cancellation at Boundary & Timeout Monitor (REQ-JOB-03, REQ-JOB-06)', () => {
  let harness: TestHarness;

  afterEach(async () => {
    vi.useRealTimers();
    if (harness) {
      await harness.cleanup();
    }
  });

  it('Scenario: Cancel while a write is in flight completes call and stops before next', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Batch process files' });
    await jobManager.startJob(job.id);

    let inFlightCallCompleted = false;
    let nextCallAttempted = false;

    // Execute step 1: simulates in-flight write call
    const step1Promise = jobManager.executeStep(job.id, 1, 'write_page', async () => {
      // Simulate cancel arriving while call is executing
      jobManager.cancelJob(job.id, 'User clicked stop').catch(() => {});

      // Record intent and result to simulate external call
      await ledgerStore.appendIntent({
        jobId: job.id,
        correlationId: 'corr-step-1',
        connector: 'notion',
        tool: 'create_page',
        parameters: { title: 'Test Page' },
        before: { captured: false, reason: 'new_page' },
        reversibility: { kind: 'reversible', snapshotMethod: 'read_page' },
      });

      inFlightCallCompleted = true;

      await ledgerStore.appendResult({
        jobId: job.id,
        correlationId: 'corr-step-1',
        outcome: 'succeeded',
        establishedBy: 'observed',
        compensatingAction: {
          connector: 'notion',
          tool: 'delete_page',
          parameters: { id: 'page-123' },
        },
      });

      return { pageId: 'page-123' };
    });

    // Step 1 finishes execution and commits to ledger, then throws JobCancelledError at post-call boundary
    await expect(step1Promise).rejects.toThrowError(JobCancelledError);
    expect(inFlightCallCompleted).toBe(true);

    // Verify job transitioned to cancelled
    const cancelledJob = await jobManager.getJob(job.id);
    expect(cancelledJob?.state).toBe('cancelled');

    // Attempt step 2: must immediately throw JobCancelledError and not execute
    await expect(
      jobManager.executeStep(job.id, 2, 'second_call', async () => {
        nextCallAttempted = true;
      })
    ).rejects.toThrowError(JobCancelledError);

    expect(nextCallAttempted).toBe(false);

    // Verify stopping point is recorded in ledger decision record
    const records = await ledgerStore.readJob(job.id);
    const cancelDecision = records.find((r) => r.type === 'decision');
    expect(cancelDecision).toBeDefined();
    const dec = cancelDecision as DecisionRecord;
    expect(dec?.content.scope).toContain('Cancelled at tool-call boundary');
  });

  it('Scenario: Stopping point is recoverable with completed operations list', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Multi-step action' });
    await jobManager.startJob(job.id);

    // Step 1 completes
    await jobManager.executeStep(job.id, 1, 'step_one', async () => {
      await ledgerStore.appendIntent({
        jobId: job.id,
        correlationId: 'corr-1',
        connector: 'notion',
        tool: 'create_page',
        parameters: { title: 'Test Page' },
        before: { captured: false, reason: 'new_page' },
        reversibility: { kind: 'reversible', snapshotMethod: 'read_page' },
      });
      await ledgerStore.appendResult({
        jobId: job.id,
        correlationId: 'corr-1',
        outcome: 'succeeded',
        establishedBy: 'observed',
        compensatingAction: {
          connector: 'notion',
          tool: 'delete_page',
          parameters: { id: 'page-123' },
        },
      });
    });

    await jobManager.cancelJob(job.id, 'Cancel before step 2');

    // Verify explanation contains step 1 as completed operation and offers undo
    const explanation = await jobManager.failureReporter.explainFailure(job, 'Cancelled');
    expect(explanation.completedOperations.length).toBe(1);
    expect(explanation.completedOperations[0]?.tool).toBe('create_page');
    expect(explanation.canUndo).toBe(true);
  });

  it('Scenario: Long job is stopped when it exceeds execution time limit', async () => {
    vi.useFakeTimers();
    // Configure a short 100ms execution timeout for testing
    harness = await createTestHarness({
      timeout: { executionTimeoutMs: 100 },
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Long batch task' });
    await jobManager.startJob(job.id);
    expect((await jobManager.getJob(job.id))?.state).toBe('running');

    // Advance fake timer past the 100ms limit
    vi.advanceTimersByTime(150);

    // Let any scheduled promises resolve
    vi.useRealTimers();
    await new Promise((r) => setImmediate(r));

    // Job moves to failed with timeout reason
    const failedJob = await jobManager.getJob(job.id);
    expect(failedJob?.state).toBe('failed');
    expect(failedJob?.summaryResult).toContain('timed out');
  });

  it('Scenario: Waiting does not consume the execution limit', async () => {
    vi.useFakeTimers();
    // 200ms execution timeout
    harness = await createTestHarness({
      timeout: { executionTimeoutMs: 200 },
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Task needing approval' });
    await jobManager.startJob(job.id);

    // Run for 50ms
    vi.advanceTimersByTime(50);

    // Move to waiting_approval
    await jobManager.pauseJob(job.id, 'waiting_approval', 'Waiting user decision');
    expect((await jobManager.getJob(job.id))?.state).toBe('waiting_approval');

    // Job spends 40 minutes (2,400,000 ms) waiting in approval
    vi.advanceTimersByTime(2_400_000);

    // Resume job: should not have timed out because waiting is excluded!
    await jobManager.resumeJob(job.id);
    const resumed = await jobManager.getJob(job.id);
    expect(resumed?.state).toBe('running');

    // Active execution time should only be ~50ms
    expect(jobManager.timeoutMonitor.getActiveRunningTimeMs(job.id)).toBeLessThan(200);

    // Run another 160ms -> now total active execution time > 200ms -> triggers timeout
    vi.advanceTimersByTime(160);

    vi.useRealTimers();
    await new Promise((r) => setImmediate(r));

    const timedOut = await jobManager.getJob(job.id);
    expect(timedOut?.state).toBe('failed');
  });

  it('Scenario: Unanswered inquiry times out to suspended after 30 minutes', async () => {
    vi.useFakeTimers();
    // Configure inquiry timeout to 1000ms for test
    harness = await createTestHarness({
      timeout: { waitingInputTimeoutMs: 1000 },
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Task with question' });
    await jobManager.startJob(job.id);

    // Job enters waiting_input
    await jobManager.pauseJob(job.id, 'waiting_input', 'Which database?');
    expect((await jobManager.getJob(job.id))?.state).toBe('waiting_input');

    // Advance past inquiry timeout
    vi.advanceTimersByTime(1100);

    vi.useRealTimers();
    await new Promise((r) => setImmediate(r));

    // Job transitions to suspended
    const suspendedJob = await jobManager.getJob(job.id);
    expect(suspendedJob?.state).toBe('suspended');

    // Can be resumed later when user answers
    const resumed = await jobManager.resumeJob(job.id);
    expect(resumed.state).toBe('running');
  });
});
