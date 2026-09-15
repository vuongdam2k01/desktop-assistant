import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { RuleStore } from '../src/catalogue/rule-store.js';
import { GateHealthTracker } from '../src/catalogue/health.js';
import { ApprovalGateError } from '../src/errors.js';
import { validateRule } from '../src/ir/validator.js';
import type { Rule } from '../src/types.js';

describe('RuleStore and Catalogue Schema Validation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  const validRule: Rule = {
    representationVersion: '1.0.0',
    id: 'rule-sample-1',
    name: 'Sample User Rule',
    restatement: 'Sample confirmed restatement',
    origin: 'user',
    verdict: 'hold',
    condition: {
      kind: 'tool',
      tool: 'archive_page',
    },
    confirmedAt: '2026-09-15T10:00:00.000Z',
  };

  it('initializes schema and loads empty catalogue cleanly', () => {
    const healthTracker = new GateHealthTracker();
    const store = new RuleStore(db, healthTracker);

    expect(store.rules.length).toBe(0);
    expect(healthTracker.health.status).toBe('open');
  });

  it('upserts and retrieves valid rules', () => {
    const store = new RuleStore(db);
    store.upsertRule(validRule);

    expect(store.rules.length).toBe(1);
    expect(store.getRule('rule-sample-1')?.name).toBe('Sample User Rule');

    // Update rule name
    store.upsertRule({
      ...validRule,
      name: 'Updated Rule Name',
    });
    expect(store.rules.length).toBe(1);
    expect(store.getRule('rule-sample-1')?.name).toBe('Updated Rule Name');
  });

  it('deletes existing rule and throws RULE_UNKNOWN for non-existent rule', () => {
    const store = new RuleStore(db);
    store.upsertRule(validRule);

    store.deleteRule('rule-sample-1');
    expect(store.rules.length).toBe(0);

    expect(() => store.deleteRule('non-existent-rule')).toThrowError(ApprovalGateError);
    try {
      store.deleteRule('non-existent-rule');
    } catch (err) {
      expect((err as ApprovalGateError).code).toBe('RULE_UNKNOWN');
    }
  });

  it('rejects rule claiming non-user origin (RULE_ORIGIN_FORBIDDEN)', () => {
    const store = new RuleStore(db);
    const forbiddenRule = {
      ...validRule,
      origin: 'hardline',
    };

    expect(() => store.upsertRule(forbiddenRule as unknown as Rule)).toThrowError(
      ApprovalGateError
    );
    try {
      store.upsertRule(forbiddenRule as unknown as Rule);
    } catch (err) {
      expect((err as ApprovalGateError).code).toBe('RULE_ORIGIN_FORBIDDEN');
    }
  });

  it('rejects rule with representation version ahead of build (RULE_VERSION_AHEAD)', () => {
    const store = new RuleStore(db);
    const aheadRule = {
      ...validRule,
      representationVersion: '2.0.0',
    };

    expect(() => store.upsertRule(aheadRule)).toThrowError(ApprovalGateError);
    try {
      store.upsertRule(aheadRule);
    } catch (err) {
      expect((err as ApprovalGateError).code).toBe('RULE_VERSION_AHEAD');
    }
  });

  it('rejects invalid regex patterns (RULE_PATTERN_INVALID)', () => {
    const store = new RuleStore(db);
    const invalidPatternRule: Rule = {
      ...validRule,
      condition: {
        kind: 'field',
        becomes: {
          field: 'title',
          matches: '[unclosed-regex-bracket(',
        },
      },
    };

    expect(() => store.upsertRule(invalidPatternRule)).toThrowError(ApprovalGateError);
    try {
      store.upsertRule(invalidPatternRule);
    } catch (err) {
      expect((err as ApprovalGateError).code).toBe('RULE_PATTERN_INVALID');
    }
  });

  it('fails closed and sets health to STOPPED when catalogue has corrupt JSON in DB', () => {
    const healthTracker = new GateHealthTracker();
    const store = new RuleStore(db, healthTracker);

    // Inject corrupt JSON into rule table directly
    db.prepare(`
      INSERT INTO rule (id, representation_version, name, restatement, origin, verdict, condition_json, confirmed_at, updated_at)
      VALUES ('bad-rule', '1.0.0', 'Bad', 'Bad', 'user', 'hold', '{invalid-json', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')
    `).run();

    expect(() => store.loadCatalogue()).toThrowError(ApprovalGateError);
    expect(healthTracker.isStopped).toBe(true);
    expect(healthTracker.errorCode).toBe('RULE_CATALOGUE_INVALID');
  });

  it('rejects nested quantifiers with catastrophic backtracking ReDoS risk', () => {

    const redosRule: Rule = {
      ...validRule,
      condition: {
        kind: 'field',
        becomes: {
          field: 'title',
          matches: '((a+)+)$',
        },
      },
    };

    expect(() => validateRule(redosRule)).toThrowError(/RULE_PATTERN_INVALID/);
  });

  it('enforces RULE_REFERENCE_UNKNOWN when manifest registry is provided', () => {

    const unknownToolRule: Rule = {
      ...validRule,
      condition: {
        kind: 'tool',
        connector: 'unknown_connector',
      },
    };

    const registry = {
      knownConnectors: ['notion', 'gmail'],
      knownTools: ['archive_page'],
    };

    expect(() => validateRule(unknownToolRule, registry)).toThrowError(/RULE_REFERENCE_UNKNOWN/);
  });

  it('guarantees defensive cloning of rules on listRules and getRule', () => {
    const store = new RuleStore(db);
    store.upsertRule(validRule);

    const listed = store.listRules();
    // Mutate local copy
    (listed[0] as unknown as { name: string }).name = 'Hacked Name';

    // Store copy remains unchanged
    expect(store.getRule('rule-sample-1')?.name).toBe('Sample User Rule');
  });
});
