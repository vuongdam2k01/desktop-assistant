import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/test-env.js';
import { JobManager } from '../src/job-manager.js';
import {
  ForeignDeviceExecutionError,
  JobCancelledError,
  PreFlightError,
} from '../src/errors.js';

const flushTasks = () => new Promise<void>((r) => setImmediate(r));

describe('Code Review Regression Tests (Hardened Boundaries)', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  it('1. Queued cancellation cleanly rejects startJob and prevents zombie admission', async () => {
    harness = await createTestHarness({
      scheduler: { concurrencyCap: 1, reservedSlots: 0 },
    });
    const { jobManager } = harness;

    // Fill slot
    const j1 = await jobManager.createJob({ originalRequest: 'J1', connectorAccountId: 'acc-1' });
    await jobManager.startJob(j1.id);

    // Queue J2
    const j2 = await jobManager.createJob({ originalRequest: 'J2', connectorAccountId: 'acc-1' });
    const j2StartPromise = jobManager.startJob(j2.id);
    await flushTasks();
    expect((await jobManager.getJob(j2.id))?.state).toBe('queued');

    // Cancel J2 while queued
    await jobManager.cancelJob(j2.id, 'Cancelled while in queue');

    // startJob promise must reject with JobCancelledError
    await expect(j2StartPromise).rejects.toThrowError(JobCancelledError);

    // Verify J2 state is cancelled
    const cancelledJ2 = await jobManager.getJob(j2.id);
    expect(cancelledJ2?.state).toBe('cancelled');

    // When J1 completes, the slot is freed; J2 must NOT be admitted or reopened
    await jobManager.completeJob(j1.id, 'Finished');
    await flushTasks();

    const checkJ2 = await jobManager.getJob(j2.id);
    expect(checkJ2?.state).toBe('cancelled');
    expect(jobManager.scheduler.getRunningCount('acc-1')).toBe(0);
  });

  it('2. Cancellation during retry backoff halts execution before next attempt', async () => {
    harness = await createTestHarness({
      retry: { baseDelayMs: 20, maxRetries: 3 },
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Flaky network task' });
    await jobManager.startJob(job.id);

    let attempts = 0;
    const stepPromise = jobManager.executeStep(job.id, 1, 'retryable_call', async () => {
      attempts++;
      if (attempts === 1) {
        // Trigger cancellation during first attempt failure
        jobManager.cancelJob(job.id, 'User stopped during retry').catch(() => {});
        const err = new Error('Transient 503');
        Object.assign(err, { code: 'UNREACHABLE' });
        throw err;
      }
      return { ok: true };
    });

    await expect(stepPromise).rejects.toThrowError(JobCancelledError);
    // Did not execute attempt 2 because cancellation was caught at retry boundary!
    expect(attempts).toBe(1);
    expect((await jobManager.getJob(job.id))?.state).toBe('cancelled');
  });

  it('3. Reconciler respects comparison.against and ambiguous_outcome policies', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore, mockReconcileReader } = harness;

    // A: against is only ['before']: matching intended is NOT considered performed
    const jobA = await jobManager.createJob({ originalRequest: 'Before-only check' });
    await jobManager.startJob(jobA.id);

    await ledgerStore.appendIntent({
      jobId: jobA.id,
      correlationId: 'corr-against-before',
      connector: 'notion',
      tool: 'check_item',
      parameters: { id: 'it-1', status: 'Completed' },
      before: { captured: true, target: 'it-1', state: { status: 'Draft' } },
      reversibility: { kind: 'irreversible', reason: 'read' },
      reconciliation: {
        method: 'readback',
        read_operation: 'get_status',
        comparison: {
          path: 'status',
          against: ['before'], // ONLY check before!
        },
      },
    });

    await jobManager.performStartupRecovery();

    // Platform returns 'Completed' (which matches intended, but against only allowed 'before')
    mockReconcileReader.setHandler('get_status', async () => ({ ok: true, data: { status: 'Completed' } }));
    const outcomeA = await jobManager.reconcileJob(jobA.id);
    // Matches neither in the declared set -> waiting_user_confirmation
    expect(outcomeA.resolution).toBe('waiting_user_confirmation');

    // B: ambiguous_outcome: 'treat_as_unperformed' resolves to 'failed' rather than asking user
    const jobB = await jobManager.createJob({ originalRequest: 'Ambiguous policy check' });
    await jobManager.startJob(jobB.id);

    await ledgerStore.appendIntent({
      jobId: jobB.id,
      correlationId: 'corr-ambiguous-policy',
      connector: 'notion',
      tool: 'check_item',
      parameters: { id: 'it-2', status: 'Completed' },
      before: { captured: true, target: 'it-2', state: { status: 'Draft' } },
      reversibility: { kind: 'irreversible', reason: 'read' },
      reconciliation: {
        method: 'readback',
        read_operation: 'get_status',
        comparison: {
          path: 'status',
          against: ['before', 'intended'],
        },
        ambiguous_outcome: 'treat_as_unperformed',
      },
    });

    await jobManager.performStartupRecovery();

    // Platform returns 'In Review' (matches neither)
    mockReconcileReader.setHandler('get_status', async () => ({ ok: true, data: { status: 'In Review' } }));
    const outcomeB = await jobManager.reconcileJob(jobB.id);
    // Policy treat_as_unperformed causes it to resolve to failed directly!
    expect(outcomeB.resolution).toBe('failed');
    expect((await jobManager.getJob(jobB.id))?.state).toBe('failed');
  });

  it('4. Point 5 Crash Recovery: result committed before job state update is recovered to done', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Point 5 crash task' });
    await jobManager.startJob(job.id);

    // Simulate crash after result append: intent + result exist in ledger, but job row is still 'running'
    await ledgerStore.appendIntent({
      jobId: job.id,
      correlationId: 'corr-p5-crash',
      connector: 'notion',
      tool: 'create_item',
      parameters: {},
      before: { captured: false, reason: 'new' },
      reversibility: { kind: 'irreversible', reason: 'new' },
    });
    await ledgerStore.appendResult({
      jobId: job.id,
      correlationId: 'corr-p5-crash',
      outcome: 'succeeded',
      establishedBy: 'observed',
    });

    expect((await jobManager.getJob(job.id))?.state).toBe('running');

    // Startup recovery scans non-terminal jobs and finds the committed result
    await jobManager.performStartupRecovery();

    // Job state is cleanly recovered to 'done'
    const recoveredJob = await jobManager.getJob(job.id);
    expect(recoveredJob?.state).toBe('done');
    expect(recoveredJob?.summaryResult).toContain('result recovered from ledger');
  });

  it('5. Durable job metadata and device pinning persist across instance restart', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    // Create job with rich metadata
    const job = await jobManager.createJob({
      originalRequest: 'Multi-device job',
      priority: 'interactive',
      connectorAccountId: 'acc-enterprise-99',
      requiredConnectors: ['notion', 'gmail'],
      createdOnDevice: 'dev-alpha',
    });

    // Create a fresh JobManager instance simulating restart
    const freshJobManager = new JobManager({
      ledgerStore,
      currentDeviceId: 'dev-beta', // A different device!
    });

    // Reconstruct job from SQLite
    const loadedJob = await freshJobManager.getJob(job.id);
    expect(loadedJob).toBeDefined();
    expect(loadedJob?.priority).toBe('interactive');
    expect(loadedJob?.connectorAccountId).toBe('acc-enterprise-99');
    expect(loadedJob?.requiredConnectors).toEqual(['notion', 'gmail']);
    expect(loadedJob?.createdOnDevice).toBe('dev-alpha');

    // Device pinning enforcement (Constitution VII / AC-28):
    // Trying to start dev-alpha's job on dev-beta must throw ForeignDeviceExecutionError!
    await expect(freshJobManager.startJob(job.id)).rejects.toThrowError(ForeignDeviceExecutionError);

    // Active jobs listing accurately reconstructs non-terminal jobs from SQLite
    const activeJobs = await freshJobManager.listActiveJobs();
    expect(activeJobs.some((j) => j.id === job.id)).toBe(true);
  });

  it('6. PreFlightChecker fails closed when required connector has no provider', async () => {
    harness = await createTestHarness({
      statusProvider: undefined, // No provider configured!
    });
    const { jobManager } = harness;

    const job = await jobManager.createJob({
      originalRequest: 'Needs notion',
      requiredConnectors: ['notion'],
    });

    // Fails closed with PreFlightError
    await expect(jobManager.startJob(job.id)).rejects.toThrowError(PreFlightError);
    expect((await jobManager.getJob(job.id))?.state).toBe('created');
  });

  it('7. Concurrent state transitions on the same job are serialized atomically and preserve terminal immutability', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Concurrent transitions' });
    await jobManager.startJob(job.id);

    // Concurrently invoke complete and fail
    const [t1, t2] = await Promise.allSettled([
      jobManager.completeJob(job.id, 'Completed race winner'),
      jobManager.failJob(job.id, 'Failed race loser'),
    ]);

    // One succeeds and sets terminal state; the second is rejected with TerminalStateError
    const finalJob = await jobManager.getJob(job.id);
    expect(jobManager.stateMachine.isTerminal(finalJob!.state)).toBe(true);

    const rejections = [t1, t2].filter((res) => res.status === 'rejected');
    expect(rejections.length).toBe(1);
  });
});
