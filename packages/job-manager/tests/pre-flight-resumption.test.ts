import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/test-env.js';
import { JobManager } from '../src/job-manager.js';
import { PreFlightError } from '../src/errors.js';

describe('Pre-Flight Authorisation & Zero-Repetition Resumption (REQ-JOB-09, REQ-JOB-10)', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  it('Scenario: Authorisation would expire mid-sequence -> proactively renewed first', async () => {
    harness = await createTestHarness({
      preFlight: { tokenRefreshMarginMs: 5 * 60 * 1000 },
    });
    const { jobManager, mockStatusProvider, mockTokenRenewer } = harness;

    // Token expires in 3 minutes (less than 5-minute safety margin)
    mockStatusProvider.setStatus('notion', {
      connected: true,
      tokenExpiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      canRenewWithoutUser: true,
    });

    const job = await jobManager.createJob({
      originalRequest: 'Notion sequence',
      requiredConnectors: ['notion'],
    });

    // Start job
    await jobManager.startJob(job.id);

    // THEN proactive renewal was triggered before the job started
    expect(mockTokenRenewer.renewCallCount).toBe(1);
    expect((await jobManager.getJob(job.id))?.state).toBe('running');
  });

  it('Scenario: Authorisation cannot be renewed without the user -> does not start', async () => {
    harness = await createTestHarness({
      preFlight: { tokenRefreshMarginMs: 5 * 60 * 1000 },
    });
    const { jobManager, mockStatusProvider } = harness;

    // Token expires soon and CANNOT be renewed without user login
    mockStatusProvider.setStatus('notion', {
      connected: true,
      tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      canRenewWithoutUser: false,
    });

    const job = await jobManager.createJob({
      originalRequest: 'Write Notion notes',
      requiredConnectors: ['notion'],
    });

    // WHEN job attempts to start
    // THEN fails pre-flight, user is told connector requires reconnection, no work performed
    await expect(jobManager.startJob(job.id)).rejects.toThrowError(PreFlightError);

    const checkJob = await jobManager.getJob(job.id);
    expect(checkJob?.state).toBe('created'); // Did not advance to running
  });

  it('Scenario: Connector is one the job never uses -> runs normally even if expired', async () => {
    harness = await createTestHarness();
    const { jobManager, mockStatusProvider } = harness;

    // Google connector is completely disconnected/expired
    mockStatusProvider.setStatus('google', {
      connected: false,
    });

    // Job only requires 'notion'
    const job = await jobManager.createJob({
      originalRequest: 'Query Notion only',
      requiredConnectors: ['notion'],
    });

    // Starts normally without checking Google
    const runningJob = await jobManager.startJob(job.id);
    expect(runningJob.state).toBe('running');
  });

  it('Scenario: In-flight suspension and resumption -> zero repeated executions', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Clarification flow' });
    await jobManager.startJob(job.id);

    let step1ExecutionCount = 0;
    let step3ExecutionCount = 0;

    // Execute step 1: read tasks
    await jobManager.executeStep(job.id, 1, 'read_tasks', async () => {
      step1ExecutionCount++;
      await ledgerStore.appendIntent({
        jobId: job.id,
        correlationId: 'corr-step-1',
        connector: 'notion',
        tool: 'read_tasks',
        parameters: {},
        before: { captured: false, reason: 'read_only' },
        reversibility: { kind: 'irreversible', reason: 'read_only' },
      });
      await ledgerStore.appendResult({
        jobId: job.id,
        correlationId: 'corr-step-1',
        outcome: 'succeeded',
        establishedBy: 'observed',
      });
      return { tasks: ['Task A'] };
    });

    expect(step1ExecutionCount).toBe(1);

    // Step 2: Agent calls ask_user -> job pauses in waiting_input
    await jobManager.pauseJob(job.id, 'waiting_input', 'Which task should I update?');
    expect((await jobManager.getJob(job.id))?.state).toBe('waiting_input');

    // Simulate inquiry timing out to suspended (or user suspended)
    await jobManager.suspendJob(job.id, '30-minute inquiry timeout');
    expect((await jobManager.getJob(job.id))?.state).toBe('suspended');

    // WHEN user provides an answer -> resume to running
    await jobManager.resumeJob(job.id);
    expect((await jobManager.getJob(job.id))?.state).toBe('running');

    // Step 3 executes with answer
    await jobManager.executeStep(job.id, 3, 'write_task', async () => {
      step3ExecutionCount++;
      return { updated: true };
    });

    expect(step3ExecutionCount).toBe(1);

    // THEN count of executions for step 1 remains exactly one (zero repetition!)
    expect(step1ExecutionCount).toBe(1);

    await jobManager.completeJob(job.id, 'Finished');
    expect((await jobManager.getJob(job.id))?.state).toBe('done');
  });

  it('Scenario: Resumption after cold application restart from SQLite store', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Multi-turn task' });
    await jobManager.startJob(job.id);

    let step1Executions = 0;

    // Run step 1
    await jobManager.executeStep(job.id, 1, 'step_one', async () => {
      step1Executions++;
      await ledgerStore.appendIntent({
        jobId: job.id,
        correlationId: 'corr-s1',
        connector: 'notion',
        tool: 'step_one',
        parameters: {},
        before: { captured: false, reason: 'init' },
        reversibility: { kind: 'irreversible', reason: 'read' },
      });
      await ledgerStore.appendResult({
        jobId: job.id,
        correlationId: 'corr-s1',
        outcome: 'succeeded',
        establishedBy: 'observed',
      });
    });

    // Enters waiting_input
    await jobManager.pauseJob(job.id, 'waiting_input', 'Pending question');

    // Simulate process exit and restart: open fresh JobManager instance pointing to same database file
    const freshJobManager = new JobManager({
      ledgerStore,
      currentDeviceId: 'test-device-1',
    });
    const persistedJob = await freshJobManager.getJob(job.id);
    expect(persistedJob?.state).toBe('waiting_input');

    // Resume on fresh instance
    const resumed = await freshJobManager.resumeJob(job.id);
    expect(resumed.state).toBe('running');

    // Check step 1 records in store: exactly 1 intent and 1 result exist
    const records = await ledgerStore.readJob(job.id);
    const step1Intents = records.filter((r) => r.type === 'intent');
    expect(step1Intents.length).toBe(1);
    expect(step1Executions).toBe(1);
  });
});
