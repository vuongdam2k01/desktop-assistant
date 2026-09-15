import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/test-env.js';

const flushTasks = () => new Promise<void>((r) => setImmediate(r));

describe('JobScheduler & Concurrency Admission (REQ-JOB-02)', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  it('Scenario: Second command during a running job runs concurrently', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    // GIVEN a job is running
    const job1 = await jobManager.createJob({
      originalRequest: 'Read Notion database A',
      connectorAccountId: 'acc-notion-1',
      priority: 'interactive',
    });
    const running1 = await jobManager.startJob(job1.id);
    expect(running1.state).toBe('running');

    // WHEN the user hands over an unrelated command
    const job2 = await jobManager.createJob({
      originalRequest: 'Summarize emails',
      connectorAccountId: 'acc-google-1',
      priority: 'interactive',
    });
    const running2 = await jobManager.startJob(job2.id);

    // THEN a second job is created and both run concurrently
    expect(running2.state).toBe('running');
    const active = await jobManager.listActiveJobs();
    expect(active.length).toBe(2);
    expect(active.map((j) => j.id)).toContain(job1.id);
    expect(active.map((j) => j.id)).toContain(job2.id);
  });

  it('Scenario: One job fails without affecting the other', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    // GIVEN two jobs are running
    const job1 = await jobManager.createJob({
      originalRequest: 'Export documents',
      connectorAccountId: 'acc-notion-1',
    });
    const job2 = await jobManager.createJob({
      originalRequest: 'Process images',
      connectorAccountId: 'acc-notion-1',
    });
    await jobManager.startJob(job1.id);
    await jobManager.startJob(job2.id);

    // WHEN one fails
    await jobManager.failJob(job1.id, 'Disk write error');

    // THEN the other continues unaffected and its state is unchanged
    const j1 = await jobManager.getJob(job1.id);
    const j2 = await jobManager.getJob(job2.id);
    expect(j1?.state).toBe('failed');
    expect(j2?.state).toBe('running');
  });

  it('Scenario: More jobs are created than the account allows to run', async () => {
    harness = await createTestHarness({
      scheduler: { concurrencyCap: 4, reservedSlots: 1 },
    });
    const { jobManager } = harness;

    // GIVEN 3 background jobs are running (unreserved cap = 3)
    const b1 = await jobManager.createJob({ originalRequest: 'B1', connectorAccountId: 'acc-1', priority: 'background' });
    const b2 = await jobManager.createJob({ originalRequest: 'B2', connectorAccountId: 'acc-1', priority: 'background' });
    const b3 = await jobManager.createJob({ originalRequest: 'B3', connectorAccountId: 'acc-1', priority: 'background' });

    await jobManager.startJob(b1.id);
    await jobManager.startJob(b2.id);
    await jobManager.startJob(b3.id);

    expect(jobManager.scheduler.getRunningCount('acc-1')).toBe(3);

    // WHEN a 4th background job that needs the same account starts
    const b4 = await jobManager.createJob({ originalRequest: 'B4', connectorAccountId: 'acc-1', priority: 'background' });
    const startPromise = jobManager.startJob(b4.id);

    // Give scheduler microtask tick
    await flushTasks();

    // THEN it stays queued and does not exceed unreserved budget
    const currentB4 = await jobManager.getJob(b4.id);
    expect(currentB4?.state).toBe('queued');
    expect(jobManager.scheduler.getQueuedCount('acc-1')).toBe(1);

    // AND when b1 completes, slot is freed and b4 starts
    await jobManager.completeJob(b1.id, 'Done');
    await startPromise;

    const startedB4 = await jobManager.getJob(b4.id);
    expect(startedB4?.state).toBe('running');
    expect(jobManager.scheduler.getRunningCount('acc-1')).toBe(3);
    expect(jobManager.scheduler.getQueuedCount('acc-1')).toBe(0);
  });

  it('Scenario: A command from the user arrives while background jobs fill the account', async () => {
    harness = await createTestHarness({
      scheduler: { concurrencyCap: 4, reservedSlots: 1 },
    });
    const { jobManager } = harness;

    // GIVEN every unreserved slot (3) is taken by background jobs
    const b1 = await jobManager.createJob({ originalRequest: 'B1', connectorAccountId: 'acc-1', priority: 'background' });
    const b2 = await jobManager.createJob({ originalRequest: 'B2', connectorAccountId: 'acc-1', priority: 'background' });
    const b3 = await jobManager.createJob({ originalRequest: 'B3', connectorAccountId: 'acc-1', priority: 'background' });

    await jobManager.startJob(b1.id);
    await jobManager.startJob(b2.id);
    await jobManager.startJob(b3.id);

    expect(jobManager.scheduler.getRunningCount('acc-1')).toBe(3);

    // WHEN the user hands over a command that needs the same account
    const userCmd = await jobManager.createJob({
      originalRequest: 'Urgent user search',
      connectorAccountId: 'acc-1',
      priority: 'interactive',
    });

    // THEN that job starts immediately in the reserved slot rather than queueing
    const runningUser = await jobManager.startJob(userCmd.id);
    expect(runningUser.state).toBe('running');
    expect(jobManager.scheduler.getRunningCount('acc-1')).toBe(4);
  });

  it('Scenario: Two connectors are not one budget', async () => {
    harness = await createTestHarness({
      scheduler: { concurrencyCap: 2, reservedSlots: 0 },
    });
    const { jobManager } = harness;

    // GIVEN limit for account 1 is reached
    const j1 = await jobManager.createJob({ originalRequest: 'J1', connectorAccountId: 'acc-notion' });
    const j2 = await jobManager.createJob({ originalRequest: 'J2', connectorAccountId: 'acc-notion' });
    await jobManager.startJob(j1.id);
    await jobManager.startJob(j2.id);

    expect(jobManager.scheduler.getRunningCount('acc-notion')).toBe(2);

    // WHEN a job is created that uses a different connector account
    const j3 = await jobManager.createJob({ originalRequest: 'J3', connectorAccountId: 'acc-google' });

    // THEN it starts because two platforms do not share one budget
    const runningJ3 = await jobManager.startJob(j3.id);
    expect(runningJ3.state).toBe('running');
    expect(jobManager.scheduler.getRunningCount('acc-google')).toBe(1);
  });

  it('Scenario: Waiting does not hold a slot', async () => {
    harness = await createTestHarness({
      scheduler: { concurrencyCap: 2, reservedSlots: 0 },
    });
    const { jobManager } = harness;

    // GIVEN two jobs fill the account
    const j1 = await jobManager.createJob({ originalRequest: 'J1', connectorAccountId: 'acc-1' });
    const j2 = await jobManager.createJob({ originalRequest: 'J2', connectorAccountId: 'acc-1' });
    await jobManager.startJob(j1.id);
    await jobManager.startJob(j2.id);

    // Queue 3rd job
    const j3 = await jobManager.createJob({ originalRequest: 'J3', connectorAccountId: 'acc-1' });
    const j3Promise = jobManager.startJob(j3.id);
    await flushTasks();
    expect((await jobManager.getJob(j3.id))?.state).toBe('queued');

    // WHEN j1 moves to waiting_approval
    await jobManager.pauseJob(j1.id, 'waiting_approval', 'Awaiting approval');

    // THEN j1 slot is released and j3 starts
    await j3Promise;
    expect((await jobManager.getJob(j3.id))?.state).toBe('running');

    // AND when j1 resumes, it waits for next slot if full
    const resumePromise = jobManager.resumeJob(j1.id);
    await flushTasks();

    // Finish j2 to free slot for resumed j1
    await jobManager.completeJob(j2.id, 'Done');
    const resumedJ1 = await resumePromise;
    expect(resumedJ1.state).toBe('running');
  });
});
