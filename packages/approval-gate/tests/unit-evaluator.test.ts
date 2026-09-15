import { describe, it, expect } from 'vitest';
import { HardGateEvaluator } from '../src/evaluator/evaluator.js';
import type { CallSubject, EvaluationContext, Rule } from '../src/types.js';

function createMockSubject(overrides?: Partial<CallSubject>): CallSubject {
  return {
    callId: 'call-test-1',
    connector: 'notion',
    tool: 'update_page_properties',
    arguments: {},
    object: {
      type: 'page',
      id: 'page-123',
      ancestorIds: ['db-tasks-001'],
      createdBy: 'current_user',
      assignedTo: ['current_user'],
    },
    isIrreversible: false,
    changesPermission: false,
    ...overrides,
  };
}

function createMockContext(overrides?: Partial<EvaluationContext>): EvaluationContext {
  return {
    jobId: 'job-100',
    mode: 'smart',
    currentUser: 'alice',
    now: '2026-09-15T14:30:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
    counts: {},
    activeGrants: [],
    ...overrides,
  };
}

describe('HardGateEvaluator Unit Tests', () => {
  describe('Hardline Blocklist (FR-AP-10, Principle II)', () => {
    it('blocks whole database deletion in all modes including mode OFF', () => {
      const evaluator = new HardGateEvaluator();
      const subject = createMockSubject({
        tool: 'archive_database',
        arguments: { database_id: 'db-tasks' },
        object: { type: 'database', id: 'db-tasks', ancestorIds: [] },
      });

      const resOff = evaluator.evaluateOrThrow(subject, createMockContext({ mode: 'off' }));
      expect(resOff.verdict).toBe('refuse');
      expect(resOff.unappealable).toBe(true);
      expect(resOff.matched[0]?.ruleId).toBe('HL-01-DATABASE-DELETION');

      const resSmart = evaluator.evaluateOrThrow(subject, createMockContext({ mode: 'smart' }));
      expect(resSmart.verdict).toBe('refuse');

      const resOn = evaluator.evaluateOrThrow(subject, createMockContext({ mode: 'on' }));
      expect(resOn.verdict).toBe('refuse');
    });

    it('blocks ledger config tampering in all modes', () => {
      const evaluator = new HardGateEvaluator();
      const subject = createMockSubject({
        connector: 'system',
        tool: 'clear_ledger',
      });

      const res = evaluator.evaluateOrThrow(subject, createMockContext({ mode: 'off' }));
      expect(res.verdict).toBe('refuse');
      expect(res.matched[0]?.ruleId).toBe('HL-02-LEDGER-CONFIG-TAMPERING');
    });

    it('blocks database update with archived = true', () => {
      const evaluator = new HardGateEvaluator();
      const subject = createMockSubject({
        tool: 'update_database',
        arguments: { archived: true },
      });

      const res = evaluator.evaluateOrThrow(subject, createMockContext({ mode: 'smart' }));
      expect(res.verdict).toBe('refuse');
      expect(res.unappealable).toBe(true);
    });
  });

  describe('Mode Semantics (on, smart, off)', () => {
    const userRefusalRule: Rule = {
      representationVersion: '1.0.0',
      id: 'rule-refuse-colleague',
      name: 'Refuse edits to coworker tasks',
      restatement: 'Never modify tasks created by other users',
      origin: 'user',
      verdict: 'refuse',
      condition: {
        kind: 'ownership',
        createdBy: { notIn: ['current_user'] },
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    };

    const userApprovalRule: Rule = {
      representationVersion: '1.0.0',
      id: 'rule-hold-done',
      name: 'Ask before moving to Done',
      restatement: 'Ask before setting status to Done',
      origin: 'user',
      verdict: 'hold',
      condition: {
        kind: 'field',
        becomes: { field: 'status', equals: 'Done' },
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    };

    it('mode OFF allows harmless write, enforces user refuse, keeps user hold silent', () => {
      const evaluator = new HardGateEvaluator({ rules: [userRefusalRule, userApprovalRule] });

      // Harmless write
      const harmless = createMockSubject({
        arguments: { properties: { title: 'Harmless task' } },
      });
      const res1 = evaluator.evaluateOrThrow(harmless, createMockContext({ mode: 'off' }));
      expect(res1.verdict).toBe('allow');

      // User refusal rule MUST STILL BIND in mode OFF (clarifications 2026-09-12)
      const coworkerTask = createMockSubject({
        object: {
          type: 'page',
          id: 'p-1',
          ancestorIds: [],
          createdBy: 'bob',
        },
      });
      const res2 = evaluator.evaluateOrThrow(coworkerTask, createMockContext({ mode: 'off' }));
      expect(res2.verdict).toBe('refuse');
      expect(res2.matched[0]?.ruleId).toBe('rule-refuse-colleague');

      // User hold rule matches but falls silent in mode OFF
      const moveToDone = createMockSubject({
        arguments: { properties: { status: { name: 'Done' } } },
      });
      const res3 = evaluator.evaluateOrThrow(moveToDone, createMockContext({ mode: 'off' }));
      expect(res3.verdict).toBe('allow');
      expect(res3.matched[0]?.ruleId).toBe('rule-hold-done');
    });

    it('mode ON stops all writes unless covered by scoped grant, and user refuse outranks blanket hold', () => {
      const evaluator = new HardGateEvaluator({ rules: [userRefusalRule] });

      const harmless = createMockSubject();
      const res1 = evaluator.evaluateOrThrow(harmless, createMockContext({ mode: 'on' }));
      expect(res1.verdict).toBe('hold');
      expect(res1.matched[0]?.ruleId).toBe('MODE-ON-BLANKET');

      // With scoped approval grant covering the blanket gate
      const resGranted = evaluator.evaluateOrThrow(
        harmless,
        createMockContext({
          mode: 'on',
          activeGrants: [
            {
              jobId: 'job-100',
              ruleId: 'MODE-ON-BLANKET',
              tool: 'update_page_properties',
              objectScope: { type: 'page', id: 'page-123' },
              grantedAt: '2026-09-15T14:30:00.000Z',
            },
          ],
        })
      );
      expect(resGranted.verdict).toBe('allow');

      // Coworker task with user refusal rule in mode ON -> refuse outranks blanket hold
      const coworkerTask = createMockSubject({
        object: { type: 'page', id: 'p-coworker', ancestorIds: [], createdBy: 'bob' },
      });
      const resRefuse = evaluator.evaluateOrThrow(coworkerTask, createMockContext({ mode: 'on' }));
      expect(resRefuse.verdict).toBe('refuse');
    });

    it('mode SMART intercepts Tier 1 static patterns', () => {
      const evaluator = new HardGateEvaluator();

      // 1. Irreversible operation
      const irreversible = createMockSubject({ isIrreversible: true });
      const res1 = evaluator.evaluateOrThrow(irreversible, createMockContext());
      expect(res1.verdict).toBe('hold');
      expect(res1.matched.some((r) => r.ruleId === 'STATIC-01-IRREVERSIBLE')).toBe(true);

      // 2. Snapshot unavailable treated as irreversible (FR-AP-05)
      const noSnapshot = createMockSubject({ isSnapshotUnavailable: true });
      const res2 = evaluator.evaluateOrThrow(noSnapshot, createMockContext());
      expect(res2.verdict).toBe('hold');
      expect(res2.matched.some((r) => r.ruleId === 'STATIC-01-IRREVERSIBLE')).toBe(true);

      // 3. Deletion tool
      const deletion = createMockSubject({ tool: 'archive_page' });
      const res3 = evaluator.evaluateOrThrow(deletion, createMockContext());
      expect(res3.verdict).toBe('hold');
      expect(res3.matched.some((r) => r.ruleId === 'STATIC-02-DELETION-ARCHIVAL')).toBe(true);

      // 4. Permission change
      const permChange = createMockSubject({ changesPermission: true });
      const res4 = evaluator.evaluateOrThrow(permChange, createMockContext());
      expect(res4.verdict).toBe('hold');
      expect(res4.matched.some((r) => r.ruleId === 'STATIC-04-PERMISSION-CHANGE')).toBe(true);

      // 5. Foreign object ownership
      const foreign = createMockSubject({
        object: { type: 'page', id: 'p-foreign', ancestorIds: [], createdBy: 'charlie' },
      });
      const res5 = evaluator.evaluateOrThrow(foreign, createMockContext());
      expect(res5.verdict).toBe('hold');
      expect(res5.matched.some((r) => r.ruleId === 'STATIC-05-FOREIGN-OWNERSHIP')).toBe(true);

      // 6. Bulk > 5
      const bulk = createMockSubject({
        affectedObjects: [
          { type: 'page', id: '1' },
          { type: 'page', id: '2' },
          { type: 'page', id: '3' },
          { type: 'page', id: '4' },
          { type: 'page', id: '5' },
          { type: 'page', id: '6' },
        ],
      });
      const res6 = evaluator.evaluateOrThrow(bulk, createMockContext());
      expect(res6.verdict).toBe('hold');
      expect(res6.matched.some((r) => r.ruleId === 'STATIC-03-BULK-OPERATIONS')).toBe(true);

      // 7. Tier 2 unattached fails closed to hold
      const safeSubject = createMockSubject();
      const res7 = evaluator.evaluateOrThrow(safeSubject, createMockContext());
      expect(res7.verdict).toBe('hold');
      expect(res7.matched.some((r) => r.ruleId === 'TIER2-UNATTACHED-FALLBACK')).toBe(true);
    });
  });

  describe('Predicate Kinds and Leaf Evaluations', () => {
    it('evaluates scope ancestor hierarchy matching (RISK-026)', () => {
      const ancestorRule: Rule = {
        representationVersion: '1.0.0',
        id: 'rule-ancestor',
        name: 'Protect Roadmap tree',
        restatement: 'Protect Q3 Roadmap and all descendant subpages',
        origin: 'user',
        verdict: 'hold',
        condition: {
          kind: 'scope',
          ancestor: { contains: 'roadmap-parent-uuid' },
        },
        confirmedAt: '2026-09-01T00:00:00.000Z',
      };

      const evaluator = new HardGateEvaluator({ rules: [ancestorRule] });

      const childSubject = createMockSubject({
        object: {
          type: 'page',
          id: 'child-page-deep',
          ancestorIds: ['root-workspace', 'roadmap-parent-uuid', 'intermediate-page'],
          createdBy: 'current_user',
        },
      });

      const res = evaluator.evaluateOrThrow(childSubject, createMockContext());
      expect(res.verdict).toBe('hold');
      expect(res.matched.some((r) => r.ruleId === 'rule-ancestor')).toBe(true);

      const unrelatedSubject = createMockSubject({
        object: {
          type: 'page',
          id: 'unrelated-page',
          ancestorIds: ['other-parent'],
          createdBy: 'current_user',
        },
      });
      const resUnrelated = evaluator.evaluateOrThrow(unrelatedSubject, createMockContext());
      expect(resUnrelated.matched.some((r) => r.ruleId === 'rule-ancestor')).toBe(false);
    });

    it('evaluates field remainderNotEmpty and pattern matching (RISK-036, A-15)', () => {
      const patternRule: Rule = {
        representationVersion: '1.0.0',
        id: 'rule-trash-title',
        name: 'Block setting trash title',
        restatement: 'Block setting title starting with zzz or trash',
        origin: 'user',
        verdict: 'refuse',
        condition: {
          kind: 'field',
          becomes: {
            field: 'title',
            matches: '^(?:zzz|trash|ignore|deleted)',
          },
        },
        confirmedAt: '2026-09-01T00:00:00.000Z',
      };

      const evaluator = new HardGateEvaluator({ rules: [patternRule] });

      const evasionCall = createMockSubject({
        arguments: {
          properties: {
            Title: [{ plain_text: 'zzz - old task' }],
          },
        },
      });

      const res = evaluator.evaluateOrThrow(evasionCall, createMockContext());
      expect(res.verdict).toBe('refuse');
      expect(res.matched[0]?.ruleId).toBe('rule-trash-title');
    });

    it('evaluates time window and days of week', () => {
      const workingHoursRule: Rule = {
        representationVersion: '1.0.0',
        id: 'rule-after-hours',
        name: 'Hold changes outside work hours',
        restatement: 'Hold changes outside 08:00 to 18:00 or on weekends',
        origin: 'user',
        verdict: 'hold',
        condition: {
          kind: 'any',
          of: [
            {
              kind: 'time',
              outside: ['08:00', '18:00'],
            },
            {
              kind: 'time',
              onDays: ['sat', 'sun'],
            },
          ],
        },
        confirmedAt: '2026-09-01T00:00:00.000Z',
      };

      const evaluator = new HardGateEvaluator({ rules: [workingHoursRule] });

      // Midnight in Vietnam (2026-09-15 01:00 UTC = 08:00 VN) -> inside
      const workHoursContext = createMockContext({
        now: '2026-09-15T02:00:00.000Z', // 09:00 VN (Tuesday)
        timezone: 'Asia/Ho_Chi_Minh',
      });
      const resDay = evaluator.evaluateOrThrow(createMockSubject(), workHoursContext);
      expect(resDay.matched.some((r) => r.ruleId === 'rule-after-hours')).toBe(false);

      // Night time in Vietnam (2026-09-15 15:00 UTC = 22:00 VN) -> outside
      const nightContext = createMockContext({
        now: '2026-09-15T15:00:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      });
      const resNight = evaluator.evaluateOrThrow(createMockSubject(), nightContext);
      expect(resNight.verdict).toBe('hold');
      expect(resNight.matched.some((r) => r.ruleId === 'rule-after-hours')).toBe(true);
    });

    it('resolves conflicts using strictest-wins resolution (refuse > hold > allow)', () => {
      const allowRule: Rule = {
        representationVersion: '1.0.0',
        id: 'rule-allow',
        name: 'Allow updates to dev notes',
        restatement: 'Allow updates',
        origin: 'user',
        verdict: 'allow',
        condition: { kind: 'tool', tool: 'update_page_properties' },
        confirmedAt: '2026-09-01T00:00:00.000Z',
      };
      const holdRule: Rule = {
        representationVersion: '1.0.0',
        id: 'rule-hold',
        name: 'Hold page properties update',
        restatement: 'Hold updates',
        origin: 'user',
        verdict: 'hold',
        condition: { kind: 'tool', tool: 'update_page_properties' },
        confirmedAt: '2026-09-01T00:00:00.000Z',
      };
      const refuseRule: Rule = {
        representationVersion: '1.0.0',
        id: 'rule-refuse',
        name: 'Refuse page properties update',
        restatement: 'Refuse updates',
        origin: 'user',
        verdict: 'refuse',
        condition: { kind: 'tool', tool: 'update_page_properties' },
        confirmedAt: '2026-09-01T00:00:00.000Z',
      };

      // hold + allow -> hold
      const eval1 = new HardGateEvaluator({ rules: [allowRule, holdRule] });
      const res1 = eval1.evaluateOrThrow(createMockSubject(), createMockContext());
      expect(res1.verdict).toBe('hold');

      // refuse + hold + allow -> refuse
      const eval2 = new HardGateEvaluator({ rules: [allowRule, holdRule, refuseRule] });
      const res2 = eval2.evaluateOrThrow(createMockSubject(), createMockContext());
      expect(res2.verdict).toBe('refuse');
      expect(res2.matched[0]?.verdict).toBe('refuse');
    });

    it('returns MANIFEST_DECLARATION_MISSING when irreversibility or permission declaration is missing', () => {
      const evaluator = new HardGateEvaluator();
      const invalidSubject = {
        ...createMockSubject(),
        isIrreversible: undefined as unknown as boolean,
      };

      const res = evaluator.evaluate(invalidSubject, createMockContext());
      expect('error' in res).toBe(true);
      expect('error' in res && res.error).toBe('MANIFEST_DECLARATION_MISSING');
    });

    it('hardline refuses operations with outside or unknown scopeAuthorization', () => {
      const evaluator = new HardGateEvaluator();
      const outsideSubject = createMockSubject({
        scopeAuthorization: 'outside',
      });
      const resOutside = evaluator.evaluateOrThrow(outsideSubject, createMockContext());
      expect(resOutside.verdict).toBe('refuse');
      expect(resOutside.unappealable).toBe(true);
      expect(resOutside.matched[0]?.ruleId).toBe('HL-03-OUT-OF-SCOPE-OPERATIONS');

      const unknownSubject = createMockSubject({
        scopeAuthorization: 'unknown',
      });
      const resUnknown = evaluator.evaluateOrThrow(unknownSubject, createMockContext());
      expect(resUnknown.verdict).toBe('refuse');
      expect(resUnknown.unappealable).toBe(true);
    });

    it('holds object in smart mode when createdBy is unknown/missing (STATIC-05-FOREIGN-OWNERSHIP)', () => {
      const evaluator = new HardGateEvaluator();
      const missingCreatorSubject = createMockSubject({
        object: {
          type: 'page',
          id: 'p-no-creator',
          ancestorIds: [],
          createdBy: undefined,
        },
      });
      const res = evaluator.evaluateOrThrow(missingCreatorSubject, createMockContext());
      expect(res.verdict).toBe('hold');
      expect(res.matched.some((r) => r.ruleId === 'STATIC-05-FOREIGN-OWNERSHIP')).toBe(true);
    });
  });
});
