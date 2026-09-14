import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  discoverContracts,
  compareSemver,
  parseSemver,
} from '../scripts/discover-contracts.js';
import { parseSqlTables } from '../scripts/generate.js';
import { checkContractsDrift } from '../scripts/check.js';

describe('Contracts discovery and version selection', () => {
  it('correctly compares semantic versions', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBeGreaterThan(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('0.1.0', '0.1.0')).toBe(0);
    expect(compareSemver('0.1.0', '0.2.0')).toBeLessThan(0);
  });

  it('rejects invalid semantic version strings', () => {
    expect(() => parseSemver('1.0')).toThrow(/Invalid semantic version/);
    expect(() => parseSemver('v1.0.0')).toThrow(/Invalid semantic version/);
    expect(() => parseSemver('beta')).toThrow(/Invalid semantic version/);
  });

  it('discovers specification corpus with exact counts and highest version winners', () => {
    const repoRoot = path.resolve(import.meta.dirname, '../../..');
    const res = discoverContracts(repoRoot);

    expect(res.totalContracts).toBe(49);
    expect(res.eligibleContractsCount).toBe(47);
    expect(res.counts.jsonSchema).toBe(46);
    expect(res.counts.openApi).toBe(6);
    expect(res.counts.sql).toBe(9);

    const winnerMap = new Map(res.winners.map(w => [w.contract, w.version]));
    expect(winnerMap.get('connector-manifest')).toBe('1.2.0');
    expect(winnerMap.get('rive-state-machine')).toBe('2.0.0');
    expect(winnerMap.get('rule-representation')).toBe('1.0.0');
    expect(winnerMap.get('update-feed')).toBe('1.1.0');
    expect(winnerMap.get('agent-session')).toBe('1.0.0');
    expect(winnerMap.get('role-routing')).toBe('1.0.0');
    expect(winnerMap.get('tool-wrapping')).toBe('0.2.0');
    expect(winnerMap.get('worker-loop')).toBe('0.2.0');
  });

  it('refuses duplicate winners with identical highest semantic version', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-dup-test-'));
    try {
      const contractsDir = path.join(tmp, 'docs/spec/changes/c1/contracts');
      fs.mkdirSync(contractsDir, { recursive: true });

      fs.writeFileSync(
        path.join(contractsDir, 'test-a.md'),
        `---\ncontract: test-contract\nversion: 1.0.0\nschema_files: []\n---\n`
      );
      fs.writeFileSync(
        path.join(contractsDir, 'test-b.md'),
        `---\ncontract: test-contract\nversion: 1.0.0\nschema_files: []\n---\n`
      );

      expect(() => discoverContracts(tmp)).toThrow(/Duplicate winner/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('refuses declared schema files that do not exist', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-missing-test-'));
    try {
      const contractsDir = path.join(tmp, 'docs/spec/changes/c1/contracts');
      fs.mkdirSync(contractsDir, { recursive: true });

      fs.writeFileSync(
        path.join(contractsDir, 'test.md'),
        `---\ncontract: test-contract\nversion: 1.0.0\nschema_files: ["non-existent.schema.json"]\n---\n`
      );

      expect(() => discoverContracts(tmp)).toThrow(/Declared schema file not found/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('refuses orphan machine files not owned by any descriptor', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-orphan-test-'));
    try {
      const contractsDir = path.join(tmp, 'docs/spec/changes/c1/contracts');
      fs.mkdirSync(contractsDir, { recursive: true });

      fs.writeFileSync(
        path.join(contractsDir, 'test.md'),
        `---\ncontract: test-contract\nversion: 1.0.0\nschema_files: ["declared.schema.json"]\n---\n`
      );
      fs.writeFileSync(path.join(contractsDir, 'declared.schema.json'), '{}');
      fs.writeFileSync(path.join(contractsDir, 'orphan.schema.json'), '{}');

      expect(() => discoverContracts(tmp)).toThrow(/Orphan machine file detected/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('SQL DDL parsing and interface generation', () => {
  it('parses composite primary keys and marks all components as required', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS test_composite (
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT,
        PRIMARY KEY (tenant_id, user_id)
      );
    `;
    const tables = parseSqlTables(sql);
    expect(tables).toHaveLength(1);
    const t = tables[0]!;
    expect(t.interfaceName).toBe('TestCompositeRow');

    const cols = new Map(t.columns.map(c => [c.colName, c]));
    expect(cols.get('tenant_id')?.isNotNull).toBe(true);
    expect(cols.get('user_id')?.isNotNull).toBe(true);
    expect(cols.get('display_name')?.isNotNull).toBe(false);
  });

  it('maps SQL types accurately including precision-safe integers and binary payloads', () => {
    const sql = `
      CREATE TABLE types_test (
        id BIGSERIAL PRIMARY KEY,
        amount BIGINT NOT NULL,
        flag BOOLEAN NOT NULL,
        payload JSONB NOT NULL,
        binary_data BYTEA NOT NULL,
        ratio DOUBLE PRECISION,
        created_at TIMESTAMPTZ NOT NULL
      );
    `;
    const tables = parseSqlTables(sql);
    expect(tables).toHaveLength(1);
    const cols = new Map(tables[0]!.columns.map(c => [c.colName, c]));

    expect(cols.get('id')?.tsType).toBe('string');
    expect(cols.get('amount')?.tsType).toBe('string');
    expect(cols.get('flag')?.tsType).toBe('boolean');
    expect(cols.get('payload')?.tsType).toBe('unknown');
    expect(cols.get('binary_data')?.tsType).toBe('Uint8Array');
    expect(cols.get('ratio')?.tsType).toBe('number');
    expect(cols.get('created_at')?.tsType).toBe('string');
  });

  it('fails closed on unrecognized column type rather than emitting any', () => {
    const sql = `
      CREATE TABLE bad_table (
        id TEXT PRIMARY KEY,
        bad_col UNKNOWN_GEOMETRY_TYPE NOT NULL
      );
    `;
    expect(() => parseSqlTables(sql)).toThrow(/Unrecognized SQL type/);
  });
});

describe('Contracts drift verification', () => {
  it('passes drift check against generated files', async () => {
    const repoRoot = path.resolve(import.meta.dirname, '../../..');
    const inSync = await checkContractsDrift(repoRoot);
    expect(inSync).toBe(true);
  });
});
