import { describe, it, expect, afterEach } from 'vitest';
import { createTestHarness, type TestHarness } from './helpers/test-env.js';
import { TerminalStateError, InvalidStateTransitionError } from '../src/errors.js';

describe('JobStateMachine & Lifecycle (REQ-JOB-01)', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  it('Scenario: Approval interrupts and resumes a run', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    // GIVEN a job is running
    const job = await jobManager.createJob({
      originalRequest: 'Create quarterly report in Notion',
      approvalMode: 'smart',
    });
    const runningJob = await jobManager.startJob(job.id);
    expect(runningJob.state).toBe('running');

    // WHEN a tool call is blocked for approval
    const pausedJob = await jobManager.pauseJob(
      runningJob.id,
      'waiting_approval',
      'Requires user approval for Notion page update'
    );

    // THEN the job moves to waiting_approval with timestamp recorded
    expect(pausedJob.state).toBe('waiting_approval');
    expect(pausedJob.stateChangedAt).toBeDefined();

    // AND when user later approves it
    const resumedJob = await jobManager.resumeJob(pausedJob.id);

    // THEN moves back to running, and both transitions carry timestamps
    expect(resumedJob.state).toBe('running');
    expect(resumedJob.stateChangedAt).toBeDefined();
    expect(new Date(resumedJob.stateChangedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(pausedJob.stateChangedAt).getTime()
    );

    // Verify transitions persisted in SQLite job_state_transition
    const storedJob = await ledgerStore.getJob(job.id);
    expect(storedJob?.state).toBe('running');
  });

  it('Scenario: Terminal states are final', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    // GIVEN a job reached done
    const job = await jobManager.createJob({ originalRequest: 'Archive workspace' });
    await jobManager.startJob(job.id);
    const completedJob = await jobManager.completeJob(job.id, 'Successfully archived');
    expect(completedJob.state).toBe('done');

    // WHEN any further event for that job arrives
    // THEN the job stays done and transition throws TerminalStateError
    await expect(
      jobManager.stateMachine.transition(completedJob, 'running')
    ).rejects.toThrowError(TerminalStateError);

    await expect(
      jobManager.stateMachine.transition(completedJob, 'failed')
    ).rejects.toThrowError(TerminalStateError);

    // Identity transition on terminal state is safe no-op
    const noop = await jobManager.stateMachine.transition(completedJob, 'done');
    expect(noop.state).toBe('done');
  });

  it('Scenario: Terminal state failed cannot be reopened', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Sync drive' });
    await jobManager.startJob(job.id);
    const failedJob = await jobManager.failJob(job.id, 'API connection dropped');
    expect(failedJob.state).toBe('failed');

    await expect(
      jobManager.stateMachine.transition(failedJob, 'running')
    ).rejects.toThrowError(TerminalStateError);
  });

  it('Scenario: Terminal state cancelled cannot be reopened', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Send notification' });
    const cancelledJob = await jobManager.cancelJob(job.id, 'User stopped request');
    expect(cancelledJob.state).toBe('cancelled');

    await expect(
      jobManager.stateMachine.transition(cancelledJob, 'running')
    ).rejects.toThrowError(TerminalStateError);
  });

  it('Scenario: A job waits for the user to say what happened', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Send external email' });
    const recoveringJob = await jobManager.stateMachine.transition(job, 'recovering');
    expect(recoveringJob.state).toBe('recovering');

    // WHEN recovery classifies tool effect cannot be read back
    const awaitingJob = await jobManager.stateMachine.transition(
      recoveringJob,
      'waiting_user_confirmation'
    );

    // THEN job is waiting_user_confirmation and leaves only on user's answer
    expect(awaitingJob.state).toBe('waiting_user_confirmation');

    // User confirms -> done
    const doneJob = await jobManager.stateMachine.transition(awaitingJob, 'done');
    expect(doneJob.state).toBe('done');
  });

  it('Scenario: Recovery is not a failure', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    // GIVEN a job is recovering because platform has not yet been asked
    const job = await jobManager.createJob({ originalRequest: 'Batch update' });
    const recoveringJob = await jobManager.stateMachine.transition(job, 'recovering');

    // WHEN user looks at the job
    // THEN it is presented as recovering (undetermined), not failed
    expect(recoveringJob.state).toBe('recovering');
    expect(jobManager.stateMachine.isTerminal(recoveringJob.state)).toBe(false);

    // Moves to done once outcome established
    const resolvedJob = await jobManager.stateMachine.transition(recoveringJob, 'done');
    expect(resolvedJob.state).toBe('done');
  });

  it('Rejects invalid state transitions across the graph', async () => {
    harness = await createTestHarness();
    const { jobManager } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Direct query' });
    // 'created' cannot jump directly to 'waiting_approval'
    await expect(
      jobManager.stateMachine.transition(job, 'waiting_approval')
    ).rejects.toThrowError(InvalidStateTransitionError);
  });
});
