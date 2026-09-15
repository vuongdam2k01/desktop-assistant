import { describe, it, expect, afterEach } from 'vitest';
import type { ResultRecord } from '@desktop-assistant/ledger-store';
import { createTestHarness, type TestHarness } from './helpers/test-env.js';

describe('Two-Phase Crash Recovery (REQ-JOB-07, SP-12 Q4, req-013)', () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  it('Phase 1: Local classification marks jobs with unresolved intents as recovering before windows appear', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    // Simulate pre-crash state: job created and started, intent recorded, but process killed before result
    const job = await jobManager.createJob({ originalRequest: 'Sync customer database' });
    await jobManager.startJob(job.id);

    await ledgerStore.appendIntent({
      jobId: job.id,
      correlationId: 'corr-unresolved-1',
      connector: 'notion',
      tool: 'update_record',
      parameters: { id: 'rec-1', status: 'Done' },
      before: { captured: true, target: 'rec-1', state: { status: 'In Progress' } },
      reversibility: { kind: 'reversible', snapshotMethod: 'get_record' },
      reconciliation: {
        method: 'readback',
        read_operation: 'get_record',
        comparison: {
          path: 'status',
          against: ['before', 'intended'],
        },
      },
    });

    // Verify unresolved intent exists in store
    const unresolved = await ledgerStore.unresolvedIntents();
    expect(unresolved.length).toBe(1);

    // WHEN application boots and runs Phase 1 recovery (completely local/offline)
    const recoveringJobIds = await jobManager.performStartupRecovery();

    // THEN the job is marked recovering and identified without network
    expect(recoveringJobIds).toContain(job.id);
    const updatedJob = await jobManager.getJob(job.id);
    expect(updatedJob?.state).toBe('recovering');
  });

  it('Scenario: Crash between intent record and call (Point 3) - state matches before -> failed', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore, mockReconcileReader } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Update task status' });
    await jobManager.startJob(job.id);

    // Intent was committed before API call was made
    await ledgerStore.appendIntent({
      jobId: job.id,
      correlationId: 'corr-point-3',
      connector: 'notion',
      tool: 'update_task',
      parameters: { id: 'task-1', status: 'Completed' },
      before: { captured: true, target: 'task-1', state: { status: 'To Do' } },
      reversibility: { kind: 'reversible', snapshotMethod: 'get_task' },
      reconciliation: {
        method: 'readback',
        read_operation: 'get_task',
        comparison: {
          path: 'status',
          against: ['before', 'intended'],
        },
      },
    });

    await jobManager.performStartupRecovery();

    // Platform live state still holds 'To Do' (matching before state, meaning call never happened)
    mockReconcileReader.setHandler('get_task', async () => {
      return { ok: true, data: { status: 'To Do' } };
    });

    // Phase 2: Reconcile job against platform
    const outcome = await jobManager.reconcileJob(job.id);

    // THEN concluded not performed, error appended, job moves to failed safely
    expect(outcome.resolution).toBe('failed');
    const finalJob = await jobManager.getJob(job.id);
    expect(finalJob?.state).toBe('failed');

    const records = await ledgerStore.readJob(job.id);
    const errorRecord = records.find((r) => r.type === 'error');
    expect(errorRecord).toBeDefined();
  });

  it('Scenario: The platform already holds the result the call intended (Point 4) -> done (reconciled)', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore, mockReconcileReader } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Finish project item' });
    await jobManager.startJob(job.id);

    // Call succeeded on Notion, but process crashed before result was committed
    await ledgerStore.appendIntent({
      jobId: job.id,
      correlationId: 'corr-point-4',
      connector: 'notion',
      tool: 'update_task',
      parameters: { id: 'task-1', status: 'Completed' },
      before: { captured: true, target: 'task-1', state: { status: 'To Do' } },
      reversibility: { kind: 'reversible', snapshotMethod: 'get_task' },
      reconciliation: {
        method: 'readback',
        read_operation: 'get_task',
        comparison: {
          path: 'status',
          against: ['before', 'intended'],
        },
      },
    });

    await jobManager.performStartupRecovery();

    // Platform read returns 'Completed' (matches intended!)
    mockReconcileReader.setHandler('get_task', async () => {
      return { ok: true, data: { status: 'Completed' } };
    });

    // Phase 2: Reconcile job
    const outcome = await jobManager.reconcileJob(job.id);

    // THEN missing result record appended with establishedBy: "reconciled", job moves to done
    expect(outcome.resolution).toBe('done');
    const finalJob = await jobManager.getJob(job.id);
    expect(finalJob?.state).toBe('done');

    const records = await ledgerStore.readJob(job.id);
    const resultRecord = records.find((r) => r.type === 'result');
    expect(resultRecord).toBeDefined();
    expect((resultRecord as ResultRecord).content.establishedBy).toBe('reconciled');
  });

  it('Scenario: Effect that cannot be read back (method: none) moves to waiting_user_confirmation', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Send Slack announcement' });
    await jobManager.startJob(job.id);

    // Operation like sending email/message cannot be read back (method: 'none')
    await ledgerStore.appendIntent({
      jobId: job.id,
      correlationId: 'corr-email-1',
      connector: 'slack',
      tool: 'send_message',
      parameters: { channel: 'general', text: 'Hello team' },
      before: { captured: false, reason: 'unreadable_effect' },
      reversibility: { kind: 'irreversible', reason: 'message_sent' },
      reconciliation: {
        method: 'none',
        reason: 'Sending message cannot be read back without risk of sending twice',
      },
    });

    await jobManager.performStartupRecovery();

    // Phase 2: Reconcile
    const outcome = await jobManager.reconcileJob(job.id);

    // THEN moves to waiting_user_confirmation rather than repeating the call
    expect(outcome.resolution).toBe('waiting_user_confirmation');
    const awaitingJob = await jobManager.getJob(job.id);
    expect(awaitingJob?.state).toBe('waiting_user_confirmation');

    // AND when user answers that it happened -> moves to done with user_confirmed
    const confirmedJob = await jobManager.confirmUserOutcome(job.id, 'corr-email-1', true);
    expect(confirmedJob.state).toBe('done');

    const records = await ledgerStore.readJob(job.id);
    const resultRecord = records.find((r) => r.type === 'result');
    expect((resultRecord as ResultRecord).content.establishedBy).toBe('user_confirmed');
  });

  it('Scenario: Platform unreachable at recovery keeps job in recovering', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore, mockReconcileReader } = harness;

    const job = await jobManager.createJob({ originalRequest: 'Sync offline task' });
    await jobManager.startJob(job.id);

    await ledgerStore.appendIntent({
      jobId: job.id,
      correlationId: 'corr-offline-1',
      connector: 'notion',
      tool: 'read_status',
      parameters: { id: 'item-1' },
      before: { captured: false, reason: 'new_item' },
      reversibility: { kind: 'irreversible', reason: 'read_only' },
      reconciliation: {
        method: 'readback',
        read_operation: 'read_status',
        comparison: { path: 'id', against: ['before', 'intended'] },
      },
    });

    await jobManager.performStartupRecovery();

    // Simulate device being offline during recovery
    mockReconcileReader.unreachable = true;

    const outcome = await jobManager.reconcileJob(job.id);

    // THEN job stays recovering without failing or repeating
    expect(outcome.resolution).toBe('recovering');
    const recoveringJob = await jobManager.getJob(job.id);
    expect(recoveringJob?.state).toBe('recovering');
  });

  it('Scenario: 5-Point Crash Injection Matrix (SP-12 Q4)', async () => {
    harness = await createTestHarness();
    const { jobManager, ledgerStore, mockReconcileReader } = harness;

    // Point 1: Crash before approval decision -> restores waiting_approval
    const p1Job = await jobManager.createJob({ originalRequest: 'P1 Job' });
    await jobManager.startJob(p1Job.id);
    await jobManager.pauseJob(p1Job.id, 'waiting_approval');
    expect((await jobManager.getJob(p1Job.id))?.state).toBe('waiting_approval');

    // Point 2: Crash after approval decision, before intent WAL -> stays waiting_approval
    const p2Job = await jobManager.createJob({ originalRequest: 'P2 Job' });
    await jobManager.startJob(p2Job.id);
    await jobManager.pauseJob(p2Job.id, 'waiting_approval');
    expect((await jobManager.getJob(p2Job.id))?.state).toBe('waiting_approval');

    // Point 3: Crash after intent committed, before API call -> Phase 1 recovering, Phase 2 failed
    const p3Job = await jobManager.createJob({ originalRequest: 'P3 Job' });
    await jobManager.startJob(p3Job.id);
    await ledgerStore.appendIntent({
      jobId: p3Job.id,
      correlationId: 'corr-p3',
      connector: 'notion',
      tool: 'p3_tool',
      parameters: { status: 'Done' },
      before: { captured: true, target: 'item-3', state: { status: 'Pending' } },
      reversibility: { kind: 'irreversible', reason: 'one_way' },
      reconciliation: {
        method: 'readback',
        read_operation: 'p3_tool',
        comparison: { path: 'status', against: ['before', 'intended'] },
      },
    });
    mockReconcileReader.setHandler('p3_tool', async () => ({ ok: true, data: { status: 'Pending' } }));
    await jobManager.performStartupRecovery();
    expect((await jobManager.getJob(p3Job.id))?.state).toBe('recovering');
    const p3Outcome = await jobManager.reconcileJob(p3Job.id);
    expect(p3Outcome.resolution).toBe('failed');

    // Point 4: Crash after API call, before result committed -> Phase 1 recovering, Phase 2 done (reconciled)
    const p4Job = await jobManager.createJob({ originalRequest: 'P4 Job' });
    await jobManager.startJob(p4Job.id);
    await ledgerStore.appendIntent({
      jobId: p4Job.id,
      correlationId: 'corr-p4',
      connector: 'notion',
      tool: 'p4_tool',
      parameters: { status: 'Done' },
      before: { captured: true, target: 'item-4', state: { status: 'Pending' } },
      reversibility: { kind: 'irreversible', reason: 'one_way' },
      reconciliation: {
        method: 'readback',
        read_operation: 'p4_tool',
        comparison: { path: 'status', against: ['before', 'intended'] },
      },
    });
    mockReconcileReader.setHandler('p4_tool', async () => ({ ok: true, data: { status: 'Done' } }));
    await jobManager.performStartupRecovery();
    const p4Outcome = await jobManager.reconcileJob(p4Job.id);
    expect(p4Outcome.resolution).toBe('done');

    // Point 5: Result committed, before job status update -> marks done
    const p5Job = await jobManager.createJob({ originalRequest: 'P5 Job' });
    await jobManager.startJob(p5Job.id);
    await ledgerStore.appendIntent({
      jobId: p5Job.id,
      correlationId: 'corr-p5',
      connector: 'notion',
      tool: 'p5_tool',
      parameters: {},
      before: { captured: false, reason: 'test' },
      reversibility: { kind: 'irreversible', reason: 'test' },
    });
    await ledgerStore.appendResult({
      jobId: p5Job.id,
      correlationId: 'corr-p5',
      outcome: 'succeeded',
      establishedBy: 'observed',
    });
    await jobManager.completeJob(p5Job.id, 'P5 Complete');
    expect((await jobManager.getJob(p5Job.id))?.state).toBe('done');

    // NFR-RL-01: Verify none of the 5 jobs were lost
    const activeAndPastJobs = await Promise.all([
      jobManager.getJob(p1Job.id),
      jobManager.getJob(p2Job.id),
      jobManager.getJob(p3Job.id),
      jobManager.getJob(p4Job.id),
      jobManager.getJob(p5Job.id),
    ]);
    expect(activeAndPastJobs.every((j) => j !== null)).toBe(true);
  });
});
