import { describe, it, expect } from 'vitest';
import { SuspensionManager } from '../src/held-call/suspension-manager.js';
import { GrantRegister } from '../src/grants/grant-register.js';
import { RefusalRegister } from '../src/refusal/refusal-register.js';
import { ApprovalGateError } from '../src/errors.js';
import { ApprovalGate } from '../src/approval-gate.js';
import Database from 'better-sqlite3';
import type { LedgerStore } from '@desktop-assistant/ledger-store';
import type {
  CallSubject,
  Decision,
  EvaluationContext,
  StateRecheckHook,
} from '../src/types.js';

describe('Held-Call Suspension, Decisions & State Re-Check', () => {
  const subject: CallSubject = {
    callId: 'call-1',
    connector: 'notion',
    tool: 'update_page_properties',
    arguments: { properties: { Status: 'Done' } },
    object: {
      type: 'page',
      id: 'page-100',
      ancestorIds: ['db-tasks'],
      createdBy: 'alice',
    },
    isIrreversible: false,
    changesPermission: false,
  };

  const decision: Decision = {
    verdict: 'hold',
    matched: [
      {
        ruleId: 'rule-hold-done',
        origin: 'user',
        name: 'Ask before Done',
        verdict: 'hold',
      },
    ],
    reason: 'Held for human approval',
  };

  const context: EvaluationContext = {
    jobId: 'job-123',
    mode: 'smart',
    currentUser: 'alice',
    now: '2026-09-15T10:00:00.000Z',
    timezone: 'UTC',
  };

  it('creates an approval request with default 30-minute expiry and accurate payload', () => {
    const manager = new SuspensionManager(30);
    const req = manager.createRequest(subject, decision, context, {
      initialSnapshot: { status: 'In Progress' },
    });

    expect(req.requestId).toMatch(/^req-/);
    expect(req.jobId).toBe('job-123');
    expect(req.tool).toBe('update_page_properties');
    expect(req.heldAt).toBe('2026-09-15T10:00:00.000Z');
    expect(req.expiresAt).toBe('2026-09-15T10:30:00.000Z');
    expect(req.objectsAffected[0]?.id).toBe('page-100');
  });

  it('enforces anti-double-decision lock (second decision receives alreadyHandled)', async () => {
    const manager = new SuspensionManager(30);
    const req = manager.createRequest(subject, decision, context);

    // Decision 1: approve
    const res1 = await manager.applyDecision({
      requestId: req.requestId,
      level: 'once',
      decidedAt: '2026-09-15T10:05:00.000Z',
      decidedBy: 'alice',
    });
    expect(res1.alreadyHandled).toBe(false);
    expect(res1.status).toBe('approved');

    // Decision 2: duplicate arrival
    const res2 = await manager.applyDecision({
      requestId: req.requestId,
      level: 'once',
      decidedAt: '2026-09-15T10:06:00.000Z',
      decidedBy: 'alice',
    });
    expect(res2.alreadyHandled).toBe(true);
    expect(res2.status).toBe('already_handled');
  });

  it('rejects expired approval requests after waiting period (30 minutes)', async () => {
    const manager = new SuspensionManager(30);
    const req = manager.createRequest(subject, decision, context);

    // Decision arrives at 10:31:00 (1 minute past expiry)
    await expect(
      manager.applyDecision(
        {
          requestId: req.requestId,
          level: 'once',
          decidedAt: '2026-09-15T10:31:00.000Z',
          decidedBy: 'alice',
        },
        {
          nowIso: '2026-09-15T10:31:00.000Z',
        }
      )
    ).rejects.toThrowError(ApprovalGateError);
  });

  it('re-checks before-state on late approval and refuses if drifted or unavailable', async () => {
    const manager = new SuspensionManager(30);
    const req = manager.createRequest(subject, decision, context, {
      initialSnapshot: { status: 'In Progress', version: 1 },
    });

    // 1. Successful re-check when state is identical
    const matchingHook: StateRecheckHook = {
      reacquireState: async () => ({ status: 'In Progress', version: 1 }),
    };
    const okRes = await manager.applyDecision(
      {
        requestId: req.requestId,
        level: 'once',
        decidedAt: '2026-09-15T10:10:00.000Z',
        decidedBy: 'alice',
      },
      { stateRecheckHook: matchingHook }
    );
    expect(okRes.status).toBe('approved');

    // 2. State drifted: object modified out of band
    const req2 = manager.createRequest(subject, decision, context, {
      initialSnapshot: { status: 'In Progress', version: 1 },
    });
    const driftedHook: StateRecheckHook = {
      reacquireState: async () => ({ status: 'Cancelled', version: 2 }),
    };
    await expect(
      manager.applyDecision(
        {
          requestId: req2.requestId,
          level: 'once',
          decidedAt: '2026-09-15T10:15:00.000Z',
          decidedBy: 'alice',
        },
        { stateRecheckHook: driftedHook }
      )
    ).rejects.toThrowError(/BEFORE_STATE_DRIFTED/);

    // 3. Platform state unavailable
    const req3 = manager.createRequest(subject, decision, context, {
      initialSnapshot: { status: 'In Progress' },
    });
    const unavailHook: StateRecheckHook = {
      reacquireState: async () => 'unavailable',
    };
    await expect(
      manager.applyDecision(
        {
          requestId: req3.requestId,
          level: 'once',
          decidedAt: '2026-09-15T10:15:00.000Z',
          decidedBy: 'alice',
        },
        { stateRecheckHook: unavailHook }
      )
    ).rejects.toThrowError(/BEFORE_STATE_DRIFTED/);
  });

  it('manages scoped grant lifecycle and question disclosures', async () => {
    const manager = new SuspensionManager(30);
    const grantRegister = new GrantRegister();
    const refusalRegister = new RefusalRegister();

    const req = manager.createRequest(subject, decision, context);

    // Approve with job-scoped level
    await manager.applyDecision(
      {
        requestId: req.requestId,
        level: 'job',
        decidedAt: '2026-09-15T10:05:00.000Z',
        decidedBy: 'alice',
      },
      { grantRegister }
    );

    // Check grant exists for this job, tool, and object
    expect(
      grantRegister.hasGrant('job-123', 'rule-hold-done', 'update_page_properties', {
        type: 'page',
        id: 'page-100',
      })
    ).toBe(true);

    // Different object is NOT covered
    expect(
      grantRegister.hasGrant('job-123', 'rule-hold-done', 'update_page_properties', {
        type: 'page',
        id: 'other-page',
      })
    ).toBe(false);

    // Revoke grants on job termination
    grantRegister.revokeGrantsForJob('job-123');
    expect(grantRegister.getGrantsForJob('job-123').length).toBe(0);

    // Refusal notice disclosure attachment
    refusalRegister.addNotice({
      jobId: 'job-123',
      tool: 'archive_page',
      object: { type: 'page', id: 'p-secret' },
      ruleId: 'rule-block-archive',
      ruleName: 'Block Archiving',
      reason: 'Protected page',
      at: '2026-09-15T10:00:00.000Z',
    });

    const disclosedQuestion = refusalRegister.formatDisclosureForQuestion(
      'job-123',
      'Should I continue with the summary?'
    );
    expect(disclosedQuestion).toContain('DISCLOSURE');
    expect(disclosedQuestion).toContain('archive_page');
    expect(disclosedQuestion).toContain('rule-block-archive');
    expect(disclosedQuestion).toContain('Should I continue with the summary?');
  });

  it('prevents race conditions across concurrent applyDecision calls', async () => {
    const manager = new SuspensionManager(30);
    const req = manager.createRequest(subject, decision, context);

    // Simulate concurrent double decision via Promise.all
    const [resA, resB] = await Promise.all([
      manager.applyDecision({
        requestId: req.requestId,
        level: 'once',
        decidedAt: '2026-09-15T10:05:00.000Z',
        decidedBy: 'alice',
      }),
      manager.applyDecision({
        requestId: req.requestId,
        level: 'once',
        decidedAt: '2026-09-15T10:05:00.000Z',
        decidedBy: 'bob',
      }),
    ]);

    // Exactly one must be approved, the other must be already_handled
    const approvedCount = [resA, resB].filter((r) => r.status === 'approved').length;
    const alreadyHandledCount = [resA, resB].filter((r) => r.alreadyHandled).length;
    expect(approvedCount).toBe(1);
    expect(alreadyHandledCount).toBe(1);
  });

  it('rejects invalid decision level at runtime', async () => {
    const manager = new SuspensionManager(30);
    const req = manager.createRequest(subject, decision, context);

    await expect(
      manager.applyDecision({
        requestId: req.requestId,
        level: 'bogus_level' as unknown as 'once',
        decidedAt: '2026-09-15T10:05:00.000Z',
        decidedBy: 'alice',
      })
    ).rejects.toThrowError(/RULE_SCHEMA_INVALID/);
  });

  it('refuses to create request for non-hold verdict or unappealable refusal', () => {
    const manager = new SuspensionManager(30);
    const refuseDecision: Decision = {
      verdict: 'refuse',
      matched: [{ ruleId: 'HL-01', origin: 'hardline', name: 'HL-01', verdict: 'refuse' }],
      reason: 'Hardline refusal',
      unappealable: true,
    };

    expect(() => manager.createRequest(subject, refuseDecision, context)).toThrowError(
      ApprovalGateError
    );
  });

  it('records decision to ledger store when decision is applied via ApprovalGate (Principle III)', async () => {
    const db = new Database(':memory:');
    const recordedDecisions: unknown[] = [];
    const mockLedger = {
      createApprovalRequest: async () => ({}),
      appendDecision: async (d: unknown) => {
        recordedDecisions.push(d);
        return {};
      },
    } as unknown as LedgerStore;

    const gate = new ApprovalGate({ db, ledgerStore: mockLedger });
    const req = gate.createApprovalRequest(subject, decision, context);

    const outcome = await gate.applyDecision({
      requestId: req.requestId,
      level: 'once',
      decidedAt: '2026-09-15T10:05:00.000Z',
      decidedBy: 'alice',
    });

    expect(outcome.status).toBe('approved');
    expect(recordedDecisions.length).toBe(1);
    expect((recordedDecisions[0] as { decision: string }).decision).toBe('approve');
    expect((recordedDecisions[0] as { decidedBy: string }).decidedBy).toBe('user');
    db.close();
  });
});
