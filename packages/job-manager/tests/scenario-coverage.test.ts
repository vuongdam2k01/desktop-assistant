import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/test-env.js';

describe('Scenario Coverage Matrix (capabilities/job/spec.md)', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  // ── REQ-JOB-08: Simple job median duration <= 30s ────────────────────────────
  it('Scenario: Creating one task (REQ-JOB-08: median duration <= 30s)', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    const durations: number[] = [];

    // Run 5 simple jobs to measure duration
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();

      const job = await jobManager.createJob({ originalRequest: `Simple task ${i}` });
      await jobManager.startJob(job.id);

      await jobManager.executeStep(job.id, 1, 'create_task', async () => {
        await ledgerStore.appendIntent({
          jobId: job.id,
          correlationId: `corr-simple-${i}`,
          connector: 'notion',
          tool: 'create_task',
          parameters: { title: `Task ${i}` },
          before: { captured: false, reason: 'new_item' },
          reversibility: { kind: 'reversible', snapshotMethod: 'get_task' },
        });

        await ledgerStore.appendResult({
          jobId: job.id,
          correlationId: `corr-simple-${i}`,
          outcome: 'succeeded',
          establishedBy: 'observed',
          compensatingAction: {
            connector: 'notion',
            tool: 'delete_task',
            parameters: { id: `task-${i}` },
          },
        });

        return { id: `task-${i}` };
      });

      await jobManager.completeJob(job.id, 'Task created');
      const elapsed = Date.now() - startTime;
      durations.push(elapsed);
    }

    // Sort to compute median
    durations.sort((a, b) => a - b);
    const medianMs = durations[Math.floor(durations.length / 2)];

    // Requirement: median duration <= 30,000 ms (SP-4 measured 16.9s on real Notion)
    expect(medianMs).toBeLessThanOrEqual(30_000);
    // On local SQLite harness, median duration is typically well under 500ms
    expect(medianMs).toBeLessThan(10_000);
  });

  // ── REQ-JOB-04: Failure with nothing done offers no undo ─────────────────────
  it('Scenario: Failure with nothing done states reason and offers no undo (REQ-JOB-04)', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    // GIVEN a job failed before any write
    const job = await jobManager.createJob({ originalRequest: 'Immediate failure task' });
    await jobManager.startJob(job.id);

    // WHEN failure is presented
    await jobManager.failJob(job.id, 'Connection failed before any operation', 'NETWORK_ERROR');

    // THEN it states reason and offers no undo because nothing was completed
    const explanation = await jobManager.failureReporter.explainFailure(
      job,
      'Connection failed before any operation'
    );
    expect(explanation.reason).toContain('Connection failed');
    expect(explanation.completedOperations.length).toBe(0);
    expect(explanation.canUndo).toBe(false);
  });

  // ── REQ-JOB-04: Failure after partial work offers undo ───────────────────────
  it('Scenario: Failure after partial work offers undo for completed reversible steps (REQ-JOB-04)', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    // GIVEN a job created two tasks and failed on the third
    const job = await jobManager.createJob({ originalRequest: 'Batch task creation' });
    await jobManager.startJob(job.id);

    // Step 1: create task 1 (reversible)
    await jobManager.executeStep(job.id, 1, 'create_task', async () => {
      await ledgerStore.appendIntent({
        jobId: job.id,
        correlationId: 'corr-t1',
        connector: 'notion',
        tool: 'create_task',
        parameters: { title: 'T1' },
        before: { captured: false, reason: 'new' },
        reversibility: { kind: 'reversible', snapshotMethod: 'get_task' },
      });
      await ledgerStore.appendResult({
        jobId: job.id,
        correlationId: 'corr-t1',
        outcome: 'succeeded',
        establishedBy: 'observed',
        compensatingAction: { connector: 'notion', tool: 'delete_task', parameters: { id: 't1' } },
      });
    });

    // Step 2: create task 2 (reversible)
    await jobManager.executeStep(job.id, 2, 'create_task', async () => {
      await ledgerStore.appendIntent({
        jobId: job.id,
        correlationId: 'corr-t2',
        connector: 'notion',
        tool: 'create_task',
        parameters: { title: 'T2' },
        before: { captured: false, reason: 'new' },
        reversibility: { kind: 'reversible', snapshotMethod: 'get_task' },
      });
      await ledgerStore.appendResult({
        jobId: job.id,
        correlationId: 'corr-t2',
        outcome: 'succeeded',
        establishedBy: 'observed',
        compensatingAction: { connector: 'notion', tool: 'delete_task', parameters: { id: 't2' } },
      });
    });

    // Step 3: fails
    await jobManager.failJob(job.id, 'Failed on step 3: third party quota exceeded');

    // WHEN failure is presented
    const explanation = await jobManager.failureReporter.explainFailure(
      job,
      'Failed on step 3: third party quota exceeded'
    );

    // THEN states reason, lists the two created tasks, and offers to undo them
    expect(explanation.completedOperations.length).toBe(2);
    expect(explanation.completedOperations[0]?.tool).toBe('create_task');
    expect(explanation.completedOperations[1]?.tool).toBe('create_task');
    expect(explanation.canUndo).toBe(true);
  });

  // ── REQ-JOB-07: The user was answered before platform was asked ──────────────
  it('Scenario: The user was answered before platform was asked (REQ-JOB-07)', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'User confirmation check' });
    await jobManager.startJob(job.id);

    await ledgerStore.appendIntent({
      jobId: job.id,
      correlationId: 'corr-user-ans',
      connector: 'slack',
      tool: 'send_webhook',
      parameters: { url: 'https://example.com' },
      before: { captured: false, reason: 'webhook' },
      reversibility: { kind: 'irreversible', reason: 'webhook' },
      reconciliation: { method: 'none' },
    });

    await jobManager.performStartupRecovery();
    await jobManager.reconcileJob(job.id);
    expect((await jobManager.getJob(job.id))?.state).toBe('waiting_user_confirmation');

    // WHEN the user states what happened
    const doneJob = await jobManager.confirmUserOutcome(job.id, 'corr-user-ans', true);

    // THEN answer is recorded as decision record and job moves on, no reconcile overwrites it
    expect(doneJob.state).toBe('done');

    const records = await ledgerStore.readJob(job.id);
    const decision = records.find((r) => r.type === 'decision');
    expect(decision).toBeDefined();

    // A subsequent reconcile does not overwrite user's confirmation
    const outcome = await jobManager.reconcileJob(job.id);
    expect(outcome.resolution).toBe('recovering'); // no unresolved intent left
    expect((await jobManager.getJob(job.id))?.state).toBe('done');
  });

  // ── REQ-JOB-05: Held resource is not a platform fault ─────────────────────────
  it('Scenario: A held resource is not a platform fault (REQ-JOB-05)', async () => {
    harness = await createTestHarness({
      retry: { baseDelayMs: 5 },
    });
    const { jobManager, mockStatusProvider } = harness;

    const job = await jobManager.createJob({
      originalRequest: 'Locked resource check',
      requiredConnectors: ['notion'],
    });
    await jobManager.startJob(job.id);

    // Call fails with RESOURCE_HELD
    let threwResourceHeld = false;
    try {
      await jobManager.executeStep(job.id, 1, 'locked_call', async () => {
        const err = new Error('Resource held');
        Object.assign(err, { code: 'RESOURCE_HELD', heldByJobId: 'job-other' });
        throw err;
      });
    } catch {
      threwResourceHeld = true;
    }

    expect(threwResourceHeld).toBe(true);

    // THEN connector status is NOT presented as failing or unhealthy
    const status = await mockStatusProvider.checkStatus('notion');
    expect(status.connected).toBe(true);
  });
});
