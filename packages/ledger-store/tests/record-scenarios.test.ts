import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { renderRecordSummary } from '../src/summary.js';
import {
  createTestDir,
  makeIntentInput,
  makeResultInput,
  makeDecisionInput,
  type TestDir,
} from './helpers/test-env.js';

describe('Record Scenarios (ledger spec)', () => {
  let testDir: TestDir;
  let dbPath: string;
  let store: LedgerStore;
  const deviceId = 'dev_test_1';

  beforeEach(async () => {
    testDir = createTestDir('rec-scenarios-');
    dbPath = testDir.dbPath();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('Scenario: Snapshot is unavailable', async () => {
    await store.createJob({ id: 'job_snap_unavail', originalRequest: 'Update target without snapshot' });

    const intent = await store.appendIntent(
      makeIntentInput('job_snap_unavail', 'corr_snap_unavail', {
        before: {
          captured: false,
          target: 'notion_block_404',
          reason: 'Target block not found or access denied',
        },
        reversibility: {
          kind: 'irreversible',
          reason: 'Target could not be inspected beforehand',
        },
      })
    );

    expect(intent.content.before.captured).toBe(false);
    expect((intent.content.before as { reason: string }).reason).toBe(
      'Target block not found or access denied'
    );
    expect(intent.content.reversibility.kind).toBe('irreversible');
  });

  it('Scenario: Outcome is not yet known', async () => {
    await store.createJob({ id: 'job_pending_outcome', originalRequest: 'Long running tool call' });

    const intent = await store.appendIntent(
      makeIntentInput('job_pending_outcome', 'corr_pending_1')
    );

    const unresolved = await store.unresolvedIntents();
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]!.correlationId).toBe('corr_pending_1');

    const records = await store.readJob('job_pending_outcome');
    expect(records).toHaveLength(1);
    expect(records[0]!.type).toBe('intent');
    expect(records[0]!.recordId).toBe(intent.recordId);
  });

  it('Scenario: Repeated modifications to the same target object in one job', async () => {
    await store.createJob({ id: 'job_repeated_mods', originalRequest: 'Modify page twice' });

    // Step 1
    const corr1 = 'corr_step_1';
    await store.appendIntent(
      makeIntentInput('job_repeated_mods', corr1, {
        before: { captured: true, target: 'page_42', state: { stage: 'draft' } },
      })
    );
    await store.appendResult(
      makeResultInput('job_repeated_mods', corr1, {
        after: { captured: true, target: 'page_42', state: { stage: 'in_review' } },
        compensatingAction: {
          connector: 'notion',
          tool: 'update_page',
          parameters: { page_id: 'page_42', stage: 'draft' },
        },
      })
    );

    // Step 2
    const corr2 = 'corr_step_2';
    await store.appendIntent(
      makeIntentInput('job_repeated_mods', corr2, {
        before: { captured: true, target: 'page_42', state: { stage: 'in_review' } },
      })
    );
    await store.appendResult(
      makeResultInput('job_repeated_mods', corr2, {
        after: { captured: true, target: 'page_42', state: { stage: 'published' } },
        compensatingAction: {
          connector: 'notion',
          tool: 'update_page',
          parameters: { page_id: 'page_42', stage: 'in_review' },
        },
      })
    );

    const history = await store.readJob('job_repeated_mods');
    expect(history).toHaveLength(4);
    expect(history[0]!.position).toBe(0);
    expect(history[1]!.position).toBe(1);
    expect(history[2]!.position).toBe(2);
    expect(history[3]!.position).toBe(3);

    // Initial before preserved in record 0
    expect((history[0]!.content as { before: { state: { stage: string } } }).before.state.stage).toBe('draft');
    // Intermediate after preserved in record 1
    expect((history[1]!.content as { after: { state: { stage: string } } }).after.state.stage).toBe('in_review');
    // Final after preserved in record 3
    expect((history[3]!.content as { after: { state: { stage: string } } }).after.state.stage).toBe('published');
  });

  it('Scenario: Correcting a recorded mistake', async () => {
    await store.createJob({ id: 'job_mistake', originalRequest: 'Record mistake and correct it' });

    const corr = 'corr_erroneous';
    await store.appendIntent(makeIntentInput('job_mistake', corr));
    const badResult = await store.appendResult(
      makeResultInput('job_mistake', corr, {
        outcome: 'failed',
        failure: { code: 'NETWORK_ERR', message: 'Connection dropped', retriable: true },
      })
    );

    // Correction is an appended record referencing the original
    const correctionInfo = await store.appendInformation({
      jobId: 'job_mistake',
      summary: 'Correcting status: network call actually succeeded on remote server',
      references: [badResult.recordId],
      detail: { verifiedOnRemote: true },
    });

    const history = await store.readJob('job_mistake');
    expect(history).toHaveLength(3);
    // Original badResult is unmodified
    expect(history[1]!.recordId).toBe(badResult.recordId);
    expect((history[1]!.content as { outcome: string }).outcome).toBe('failed');
    // Correction record references original
    expect(history[2]!.recordId).toBe(correctionInfo.recordId);
    expect(history[2]!.references).toEqual([badResult.recordId]);
  });

  it('Scenario: Denial is recorded', async () => {
    await store.createJob({ id: 'job_denial', originalRequest: 'Operation subject to gate' });
    const approvalReq = await store.createApprovalRequest({
      requestId: 'req_deny_1',
      jobId: 'job_denial',
      tool: 'delete_database',
      matched: [{ ruleId: 'rule_hard_delete', verdict: 'require_approval' }],
      reason: 'Destructive deletion of Notion database',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      appealable: true,
    });

    const decision = await store.appendDecision(
      makeDecisionInput('job_denial', {
        decision: 'deny',
        decidedBy: 'user',
        reason: 'Too risky to perform right now',
        answers: approvalReq.requestId,
      })
    );

    expect(decision.content.decision).toBe('deny');
    expect(decision.content.answers).toBe('req_deny_1');

    const storedReq = await store.getApprovalRequest('req_deny_1');
    expect(storedReq?.status).toBe('denied');
  });

  it('Scenario: Automatic decision is distinguishable', async () => {
    await store.createJob({ id: 'job_auto_decision', originalRequest: 'Low risk action' });

    const autoDecision = await store.appendDecision(
      makeDecisionInput('job_auto_decision', {
        decision: 'approve',
        decidedBy: 'risk_judge',
        reason: 'Read-only query matches benign allowlist rule rule_read_safe',
      })
    );

    expect(autoDecision.content.decidedBy).toBe('risk_judge');
    expect(autoDecision.content.reason).toContain('rule_read_safe');

    const summary = renderRecordSummary(autoDecision);
    expect(summary).toContain('risk_judge');
  });

  it('Scenario: Reading what happened', async () => {
    await store.createJob({ id: 'job_narrative', originalRequest: 'Document workflow steps' });
    const corr = 'corr_narrative_1';

    await store.appendIntent(
      makeIntentInput('job_narrative', corr, {
        connector: 'notion',
        tool: 'create_page',
        before: { captured: false, reason: 'Target is being created' },
      })
    );
    await store.appendResult(
      makeResultInput('job_narrative', corr, {
        outcome: 'succeeded',
        response: { page_id: 'p_999' },
      })
    );

    const history = await store.readJob('job_narrative');
    const sentences = history.map((rec) => renderRecordSummary(rec));

    expect(sentences[0]).toContain('Intent: Execute notion:create_page');
    expect(sentences[1]).toContain('Result: Operation succeeded');
  });

  it('Scenario: Inspecting the underlying call', async () => {
    await store.createJob({ id: 'job_inspect', originalRequest: 'Detailed inspection test' });
    const corr = 'corr_inspect_1';

    const intent = await store.appendIntent(
      makeIntentInput('job_inspect', corr, {
        parameters: { page_id: 'page_alpha', title: 'New Alpha Title' },
        before: { captured: true, target: 'page_alpha', state: { title: 'Old Title' } },
      })
    );
    const result = await store.appendResult(
      makeResultInput('job_inspect', corr, {
        response: { id: 'page_alpha', version: 2 },
        after: { captured: true, target: 'page_alpha', state: { title: 'New Alpha Title' } },
      })
    );

    const records = await store.readJob('job_inspect');
    expect(records[0]!.content).toEqual(intent.content);
    expect(records[1]!.content).toEqual(result.content);
  });

  it('Scenario: Finding every deletion in a period', async () => {
    await store.createJob({ id: 'job_filter_query', originalRequest: 'Query filtering test' });

    const pastDate1 = '2026-03-01T10:00:00.000Z';
    const pastDate2 = '2026-03-02T10:00:00.000Z';
    const pastDate3 = '2026-03-05T10:00:00.000Z';

    // Step 1: information record on March 1
    await store.append({
      recordId: 'rec_info_march1',
      jobId: 'job_filter_query',
      position: 0,
      type: 'information',
      originDevice: deviceId,
      originSequence: 50,
      recordedAt: pastDate1,
      content: { summary: 'Task initialized' },
    });

    // Step 2: removal announcement on March 2
    await store.append({
      recordId: 'rec_del_march2',
      jobId: 'job_filter_query',
      position: 1,
      type: 'removal_announcement',
      originDevice: deviceId,
      originSequence: 51,
      recordedAt: pastDate2,
      content: {
        reason: 'user_deletion',
        requestedBy: 'user',
        range: { fromRecordedAt: pastDate1, toRecordedAt: pastDate1, recordCount: 1 },
      },
    });

    // Step 3: error on March 5
    await store.append({
      recordId: 'rec_err_march5',
      jobId: 'job_filter_query',
      position: 2,
      type: 'error',
      originDevice: deviceId,
      originSequence: 52,
      recordedAt: pastDate3,
      content: { code: 'AUTH_FAILED', message: 'Token expired' },
    });

    // Filter by type: removal_announcement in March 1 - March 3 window
    const deletionsOnly = await store.read({
      jobId: 'job_filter_query',
      types: ['removal_announcement'],
      from: '2026-03-02T00:00:00.000Z',
      to: '2026-03-03T00:00:00.000Z',
      limit: 10,
    });
    expect(deletionsOnly).toHaveLength(1);
    expect(deletionsOnly[0]!.type).toBe('removal_announcement');
    expect(deletionsOnly[0]!.recordId).toBe('rec_del_march2');

    // Text search matches rendered summary
    const textMatch = await store.read({
      jobId: 'job_filter_query',
      text: 'Token expired',
      limit: 10,
    });
    expect(textMatch).toHaveLength(1);
    expect(textMatch[0]!.type).toBe('error');
  });

  it('verifies readOnly facade is frozen and exposes only reading and stream', async () => {
    const readOnlyStore = store.readOnly();

    // 1. Facade is frozen
    expect(Object.isFrozen(readOnlyStore)).toBe(true);

    // 2. Facade does not expose write operations
    expect('append' in readOnlyStore).toBe(false);
    expect('appendMany' in readOnlyStore).toBe(false);
    expect('appendIntent' in readOnlyStore).toBe(false);
    expect('createJob' in readOnlyStore).toBe(false);
    expect('close' in readOnlyStore).toBe(false);

    // 3. Facade reading works
    await store.createJob({ id: 'job_ro_test', originalRequest: 'RO test' });
    await store.appendIntent(makeIntentInput('job_ro_test', 'corr_ro_1'));

    const records = await readOnlyStore.readJob('job_ro_test');
    expect(records).toHaveLength(1);
    expect(records[0]!.type).toBe('intent');

    const shape = await readOnlyStore.shape();
    expect(shape.current).toBe(1);

    // 4. Facade subscription works
    const received: string[] = [];
    const unsubscribe = readOnlyStore.subscribe((rec) => {
      received.push(rec.recordId);
    });

    const secondIntent = await store.appendIntent(makeIntentInput('job_ro_test', 'corr_ro_2'));
    expect(received).toContain(secondIntent.recordId);
    unsubscribe();
  });

  it('Scenario: Reading where a step ran', async () => {
    await store.createJob({ id: 'job_device_trace', originalRequest: 'Verify device attribution' });

    const intent = await store.appendIntent(makeIntentInput('job_device_trace'));
    expect(intent.originDevice).toBe(deviceId);
    expect(typeof intent.originSequence).toBe('number');
  });

  it('Scenario: A call that returns', async () => {
    await store.createJob({ id: 'job_standard_call', originalRequest: 'Normal successful call' });
    const corr = 'corr_standard_call';

    await store.appendIntent(makeIntentInput('job_standard_call', corr));
    await store.appendResult(makeResultInput('job_standard_call', corr));

    const records = await store.readJob('job_standard_call');
    expect(records).toHaveLength(2);
    expect(records[0]!.correlationId).toBe(corr);
    expect(records[1]!.correlationId).toBe(corr);
    expect(records[0]!.type).toBe('intent');
    expect(records[1]!.type).toBe('result');
  });

  it('Scenario: A call the platform refuses', async () => {
    await store.createJob({ id: 'job_platform_refusal', originalRequest: 'Call refused by remote' });
    const corr = 'corr_refused_call';

    const intent = await store.appendIntent(makeIntentInput('job_platform_refusal', corr));
    const result = await store.appendResult(
      makeResultInput('job_platform_refusal', corr, {
        outcome: 'failed',
        failure: { code: 'HTTP_403', message: 'Forbidden: Insufficient permissions', retriable: false },
      })
    );

    const records = await store.readJob('job_platform_refusal');
    expect(records).toHaveLength(2);
    expect(records[0]!.recordId).toBe(intent.recordId);
    expect(records[1]!.recordId).toBe(result.recordId);
    const resultRecord = records[1]!;
    expect(resultRecord.type).toBe('result');
    if (resultRecord.type !== 'result') throw new Error('expected a result record');
    expect(resultRecord.content.outcome).toBe('failed');
  });

  it('Scenario: The process stops between the two records', async () => {
    await store.createJob({ id: 'job_half_flight', originalRequest: 'Interrupted call' });
    const corr = 'corr_half_flight';

    await store.appendIntent(makeIntentInput('job_half_flight', corr));
    // No result appended

    const unresolved = await store.unresolvedIntents();
    expect(unresolved.some((u) => u.correlationId === corr)).toBe(true);
  });

  it('Scenario: Two calls in one job', async () => {
    await store.createJob({ id: 'job_two_calls', originalRequest: 'Two sequential calls' });

    const corr1 = 'corr_call_1';
    const corr2 = 'corr_call_2';

    await store.appendIntent(makeIntentInput('job_two_calls', corr1));
    await store.appendResult(makeResultInput('job_two_calls', corr1));

    await store.appendIntent(makeIntentInput('job_two_calls', corr2));
    await store.appendResult(makeResultInput('job_two_calls', corr2));

    const records = await store.readJob('job_two_calls');
    expect(records).toHaveLength(4);
    expect(records[0]!.correlationId).toBe(corr1);
    expect(records[1]!.correlationId).toBe(corr1);
    expect(records[2]!.correlationId).toBe(corr2);
    expect(records[3]!.correlationId).toBe(corr2);
  });

  it('Scenario: The declaration changes between the call and the recovery', async () => {
    await store.createJob({ id: 'job_reconcile_freeze', originalRequest: 'Manifest reconciliation freeze' });
    const corr = 'corr_recon_freeze';

    // Original manifest declaration
    const originalDecl = {
      method: 'readback' as const,
      read_operation: 'get_page_v1',
      comparison: { path: 'properties.status', against: ['before' as const, 'intended' as const] },
    };

    await store.appendIntent(
      makeIntentInput('job_reconcile_freeze', corr, {
        reconciliation: originalDecl,
      })
    );

    // Later manifest changes in code
    const changedManifest = {
      method: 'none' as const,
      reason: 'connector deprecated readback',
    };
    void changedManifest;

    // Unresolved intent still carries the frozen declaration
    const unresolved = await store.unresolvedIntents();
    const item = unresolved.find((u) => u.correlationId === corr);
    expect(item).toBeDefined();
    expect(item!.intent.content.reconciliation).toEqual(originalDecl);
  });

  it('Scenario: The target cannot be read before the call', async () => {
    await store.createJob({ id: 'job_unread_target', originalRequest: 'Write to unreadable target' });

    const intent = await store.appendIntent(
      makeIntentInput('job_unread_target', 'corr_unread_target', {
        before: {
          captured: false,
          target: 'secret_doc_1',
          reason: 'Read permission denied by upstream policy',
        },
        reversibility: {
          kind: 'irreversible',
          reason: 'Cannot reverse without prior snapshot',
        },
      })
    );

    expect(intent.content.before.captured).toBe(false);
    expect((intent.content.before as { reason: string }).reason).toBe(
      'Read permission denied by upstream policy'
    );
  });

  it('Scenario: No declaration exists for the tool', async () => {
    await store.createJob({ id: 'job_no_decl', originalRequest: 'Undeclared tool' });

    const intent = await store.appendIntent(
      makeIntentInput('job_no_decl', 'corr_no_decl', {
        reconciliation: undefined,
      })
    );

    expect(intent.content.reconciliation).toEqual({
      method: 'none',
      reason: 'missing_or_invalid_declaration',
    });
  });

  it('Scenario: After an abrupt stop', async () => {
    await store.createJob({ id: 'job_three_flight', originalRequest: 'Three calls in flight' });

    // Call 1: completed
    await store.appendIntent(makeIntentInput('job_three_flight', 'corr_call_c1'));
    await store.appendResult(makeResultInput('job_three_flight', 'corr_call_c1'));

    // Call 2: in flight
    await store.appendIntent(makeIntentInput('job_three_flight', 'corr_call_c2'));

    // Call 3: in flight
    await store.appendIntent(makeIntentInput('job_three_flight', 'corr_call_c3'));

    const unresolved = await store.unresolvedIntents();
    const correlations = unresolved.map((u) => u.correlationId);

    expect(correlations).toContain('corr_call_c2');
    expect(correlations).toContain('corr_call_c3');
    expect(correlations).not.toContain('corr_call_c1');
  });

  it('Scenario: Nothing was interrupted', async () => {
    await store.createJob({ id: 'job_all_clean', originalRequest: 'All calls succeeded' });

    await store.appendIntent(makeIntentInput('job_all_clean', 'corr_clean_1'));
    await store.appendResult(makeResultInput('job_all_clean', 'corr_clean_1'));

    await store.appendIntent(makeIntentInput('job_all_clean', 'corr_clean_2'));
    await store.appendResult(makeResultInput('job_all_clean', 'corr_clean_2'));

    const unresolved = await store.unresolvedIntents();
    expect(unresolved.filter((u) => u.jobId === 'job_all_clean')).toHaveLength(0);
  });
});
