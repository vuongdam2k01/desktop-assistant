import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { AllowlistStore } from '../src/catalogue/allowlist-store.js';
import { initializeRuleCatalogueSchema } from '../src/catalogue/schema.js';
import { HardGateEvaluator } from '../src/evaluator/evaluator.js';
import { ApprovalGate } from '../src/approval-gate.js';
import { ApprovalGateError } from '../src/errors.js';
import type { Rule, EvaluationContext, CallSubject } from '../src/types.js';

describe('AllowlistStore and Permanent Exceptions', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initializeRuleCatalogueSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  const sampleEntry = {
    connector: 'notion',
    tool: 'update_page_properties',
    objectType: 'page',
    objectId: 'allowed-page-123',
  };

  const evalContext: EvaluationContext = {
    jobId: 'job-test',
    mode: 'smart',
    currentUser: 'alice',
    now: '2026-09-15T12:00:00.000Z',
    timezone: 'UTC',
  };

  it('adds and verifies allowlist entry', () => {
    const store = new AllowlistStore(db);
    const entry = store.addEntry(sampleEntry);

    expect(entry.id).toMatch(/^al-/);
    expect(
      store.isAllowlisted('notion', 'update_page_properties', 'page', 'allowed-page-123')
    ).toBe(true);
    expect(
      store.isAllowlisted('notion', 'update_page_properties', 'page', 'other-page')
    ).toBe(false);

    // Idempotent addition
    const entry2 = store.addEntry(sampleEntry);
    expect(entry2.id).toBe(entry.id);
  });

  it('lists and deletes allowlist entries', () => {
    const store = new AllowlistStore(db);
    const entry = store.addEntry(sampleEntry);

    expect(store.listEntries().length).toBe(1);

    store.deleteEntry(entry.id);
    expect(store.listEntries().length).toBe(0);
    expect(
      store.isAllowlisted('notion', 'update_page_properties', 'page', 'allowed-page-123')
    ).toBe(false);

    expect(() => store.deleteEntry('non-existent')).toThrowError(ApprovalGateError);
  });

  it('enforces APPROVAL_LEVEL_FORBIDDEN when stopping rule matches target', () => {
    const stoppingRule: Rule = {
      representationVersion: '1.0.0',
      id: 'rule-block-archive',
      name: 'Block Archival on Target Page',
      restatement: 'Never archive this page',
      origin: 'user',
      verdict: 'refuse',
      condition: {
        kind: 'all',
        of: [
          { kind: 'tool', tool: 'archive_page' },
          { kind: 'scope', objectId: 'forbidden-page' },
        ],
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    };

    const evaluator = new HardGateEvaluator({ rules: [stoppingRule] });
    const store = new AllowlistStore(db);

    expect(() =>
      store.addEntry(
        {
          connector: 'notion',
          tool: 'archive_page',
          objectType: 'page',
          objectId: 'forbidden-page',
        },
        evaluator,
        evalContext
      )
    ).toThrowError(ApprovalGateError);

    try {
      store.addEntry(
        {
          connector: 'notion',
          tool: 'archive_page',
          objectType: 'page',
          objectId: 'forbidden-page',
        },
        evaluator,
        evalContext
      );
    } catch (err) {
      expect((err as ApprovalGateError).code).toBe('APPROVAL_LEVEL_FORBIDDEN');
    }
  });

  it('guarantees that permanent allowlist cannot override user refuse or hold rules in ApprovalGate.evaluate', () => {
    const gate = new ApprovalGate({ db });

    // Add allowlist entry directly
    gate.allowlistStore.addEntry({
      connector: 'notion',
      tool: 'update_page_properties',
      objectType: 'page',
      objectId: 'p-stopped',
    });

    // 1. Add user refuse rule
    gate.ruleStore.upsertRule({
      representationVersion: '1.0.0',
      id: 'rule-refuse-stopped',
      name: 'Refuse updates to p-stopped',
      restatement: 'Never update p-stopped',
      origin: 'user',
      verdict: 'refuse',
      condition: {
        kind: 'all',
        of: [
          { kind: 'tool', tool: 'update_page_properties' },
          { kind: 'scope', objectId: 'p-stopped' },
        ],
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    });

    const subject: CallSubject = {
      callId: 'call-check-allowlist',
      connector: 'notion',
      tool: 'update_page_properties',
      arguments: { properties: { Status: 'Done' } },
      object: { type: 'page', id: 'p-stopped', ancestorIds: [], createdBy: 'alice' },
      isIrreversible: false,
      changesPermission: false,
    };

    const decisionRefuse = gate.evaluate(subject, evalContext);
    expect('verdict' in decisionRefuse && decisionRefuse.verdict).toBe('refuse');
    expect('matched' in decisionRefuse && decisionRefuse.matched[0]?.ruleId).toBe(
      'rule-refuse-stopped'
    );

    // 2. Replace with hold rule
    gate.ruleStore.deleteRule('rule-refuse-stopped');
    gate.ruleStore.upsertRule({
      representationVersion: '1.0.0',
      id: 'rule-hold-stopped',
      name: 'Hold updates to p-stopped',
      restatement: 'Hold updates to p-stopped',
      origin: 'user',
      verdict: 'hold',
      condition: {
        kind: 'all',
        of: [
          { kind: 'tool', tool: 'update_page_properties' },
          { kind: 'scope', objectId: 'p-stopped' },
        ],
      },
      confirmedAt: '2026-09-01T00:00:00.000Z',
    });

    const decisionHold = gate.evaluate(subject, evalContext);
    expect('verdict' in decisionHold && decisionHold.verdict).toBe('hold');
    expect('matched' in decisionHold && decisionHold.matched.some((r) => r.ruleId === 'rule-hold-stopped')).toBe(true);
  });
});
