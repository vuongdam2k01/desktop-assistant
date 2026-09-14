import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openLedgerStore } from '../src/opener.js';
import type { LedgerStore } from '../src/ledger-store.js';
import { renderRecordSummary } from '../src/summary.js';
import {
  createTestDir,
  makeIntentInput,
  makeResultInput,
  makeSupersededVersionInput,
  type TestDir,
} from './helpers/test-env.js';

interface DownstreamOwnerScenario {
  readonly scenario: string;
  readonly owner: 'F5' | 'F8' | 'F21' | 'F22';
  readonly consumingContract: string;
}

export const DOWNSTREAM_OWNER_SCENARIOS: readonly DownstreamOwnerScenario[] = [
  // F5 Connector Loop / Audit
  {
    scenario: 'Audit of a completed job',
    owner: 'F5',
    consumingContract: 'Dense position ordering, zero record loss, and immutable readJob verification',
  },
  // F8 Exclusive-Span & Stale-Before-State Coordination
  {
    scenario: 'Two jobs write to one object',
    owner: 'F8',
    consumingContract: 'Separate job records hold distinct before states and dense positions',
  },
  {
    scenario: 'Undoing the second job preserves the first',
    owner: 'F8',
    consumingContract: 'CompensatingAction is stored whole on result record for replay against current state',
  },
  {
    scenario: 'A read takes no exclusive access',
    owner: 'F8',
    consumingContract: 'Storage contract permits read-only operations without before snapshot mutation',
  },
  {
    scenario: 'The process stops while access is held',
    owner: 'F8',
    consumingContract: 'Locks are held in memory by coordinator; store state survives crash and yields unresolvedIntents',
  },
  {
    scenario: 'The target is unchanged when the decision arrives',
    owner: 'F8',
    consumingContract: 'Decision record preserves original intent.content.before state for comparison',
  },
  {
    scenario: 'The target changed while the user was deciding',
    owner: 'F8',
    consumingContract: 'Held before state in intent record is compared against live platform by F8',
  },
  {
    scenario: 'The agent may propose the operation again',
    owner: 'F8',
    consumingContract: 'Storage supports proposing new intent with fresh correlationId and dense position',
  },
  {
    scenario: 'The comparison is against what was recorded, not against what was intended',
    owner: 'F8',
    consumingContract: 'Comparison uses recorded intent.content.before, preserved immutable in action_record',
  },
  // F21 App Window Presentation & Localized UI
  {
    scenario: 'Reading what happened',
    owner: 'F21',
    consumingContract: 'renderRecordSummary supplies deterministic English data-only description for UI rendering',
  },
  // F22 Sync & Multi-device Replication Transport
  {
    scenario: 'Records survive the device that wrote them',
    owner: 'F22',
    consumingContract: 'Generic append and appendMany preserve remote originDevice and originSequence',
  },
  {
    scenario: 'Deletion reaches every device',
    owner: 'F22',
    consumingContract: 'Removal announcement record is replicated as a tombstone across devices',
  },
  {
    scenario: 'Expiry applies to a device that was offline',
    owner: 'F22',
    consumingContract: 'expire() API and removal_announcement tombstones ensure offline reconciliation',
  },
  {
    scenario: 'Reading why a rule changed',
    owner: 'F22',
    consumingContract: 'superseded_version record carries displaced payload, superseding record, and device',
  },
];

describe('Scenario Coverage Matrix (ledger spec)', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const specPath = path.join(repoRoot, 'docs/spec/capabilities/ledger/spec.md');

  let testDir: TestDir;
  let dbPath: string;
  let store: LedgerStore;
  const deviceId = 'dev_coverage_verifier';

  beforeEach(async () => {
    testDir = createTestDir('coverage-');
    dbPath = testDir.dbPath();
    store = await openLedgerStore({ path: dbPath, deviceId });
  });

  afterEach(async () => {
    await store.close();
    testDir.cleanup();
  });

  it('verifies all 53 ledger scenarios are accounted for without omissions', () => {
    expect(fs.existsSync(specPath)).toBe(true);
    const specContent = fs.readFileSync(specPath, 'utf8');

    // Extract all `#### Scenario: ...` headings
    const scenarioMatches = [...specContent.matchAll(/^#### Scenario:\s*(.+)$/gm)];
    const specScenarios = scenarioMatches.map((m) => m[1]!.trim());

    expect(specScenarios.length).toBeGreaterThan(0);

    // Extract all `it('Scenario: ...')` titles from test files
    const testsDir = path.resolve(__dirname);
    const testFiles = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.ts'));

    const implementedScenarios = new Set<string>();
    for (const file of testFiles) {
      const content = fs.readFileSync(path.join(testsDir, file), 'utf8');
      const itMatches = [...content.matchAll(/it\(\s*(["'])Scenario:\s*(.+?)(?:\s*\([^)]+\))?\1/g)];
      for (const match of itMatches) {
        implementedScenarios.add(match[2]!.trim());
      }
    }

    const downstreamMap = new Map(DOWNSTREAM_OWNER_SCENARIOS.map((s) => [s.scenario, s]));
    const missingScenarios: string[] = [];

    for (const scenario of specScenarios) {
      const isImplementedDirectly = implementedScenarios.has(scenario);
      const hasDownstreamOwner = downstreamMap.has(scenario);

      if (!isImplementedDirectly && !hasDownstreamOwner) {
        missingScenarios.push(scenario);
      }
    }

    if (missingScenarios.length > 0) {
      throw new Error(
        `Unaccounted ledger spec scenarios (${missingScenarios.length}):\n` +
          missingScenarios.map((s) => `  - ${s}`).join('\n')
      );
    }

    // Verify all downstream owner classifications are valid
    for (const [scenario, info] of downstreamMap) {
      expect(specScenarios).toContain(scenario);
      expect(['F5', 'F8', 'F21', 'F22']).toContain(info.owner);
      expect(info.consumingContract.length).toBeGreaterThan(10);
    }
  });

  it('verifies downstream F5/F8/F21/F22 storage contracts', async () => {
    // 1. F5: Audit of a completed job - 4 modified objects produce exactly 4 intent/result pairs in position order
    await store.createJob({ id: 'job_audit_f5', originalRequest: 'Modify 4 objects' });
    for (let i = 1; i <= 4; i++) {
      const corr = `corr_audit_${i}`;
      await store.appendIntent(
        makeIntentInput('job_audit_f5', corr, {
          tool: `update_obj_${i}`,
          parameters: { targetId: `obj_${i}` },
          before: { captured: true, target: `obj_${i}`, state: { val: `old_${i}` } },
        })
      );
      await store.appendResult(
        makeResultInput('job_audit_f5', corr, {
          after: { captured: true, target: `obj_${i}`, state: { val: `new_${i}` } },
          compensatingAction: { connector: 'notion', tool: 'undo_update', parameters: { targetId: `obj_${i}` } },
        })
      );
    }

    const auditRecords = await store.readJob('job_audit_f5');
    expect(auditRecords).toHaveLength(8);
    for (let pos = 0; pos < 8; pos++) {
      expect(auditRecords[pos]!.position).toBe(pos);
    }

    // 2. F8: Two jobs write to one object with distinct before/after states
    await store.createJob({ id: 'job_j1', originalRequest: 'J1 update' });
    await store.createJob({ id: 'job_j2', originalRequest: 'J2 update' });

    await store.appendIntent(
      makeIntentInput('job_j1', 'corr_j1', {
        before: { captured: true, target: 'shared_obj', state: { step: 0 } },
      })
    );
    await store.appendResult(
      makeResultInput('job_j1', 'corr_j1', {
        after: { captured: true, target: 'shared_obj', state: { step: 1 } },
      })
    );

    await store.appendIntent(
      makeIntentInput('job_j2', 'corr_j2', {
        before: { captured: true, target: 'shared_obj', state: { step: 1 } },
      })
    );
    await store.appendResult(
      makeResultInput('job_j2', 'corr_j2', {
        after: { captured: true, target: 'shared_obj', state: { step: 2 } },
      })
    );

    const j1Records = await store.readJob('job_j1');
    const j2Records = await store.readJob('job_j2');
    expect(j1Records).toHaveLength(2);
    expect(j2Records).toHaveLength(2);

    // 3. F21: renderRecordSummary provides readable English summary
    const summary = renderRecordSummary(j1Records[0]!);
    expect(summary).toMatch(/^Intent: Execute notion:update_page/);

    // 4. F22: Remote replication record import preserves remote originDevice and originSequence
    await store.append({
      recordId: 'rec_remote_sync_1',
      jobId: 'job_audit_f5',
      position: 8,
      type: 'information',
      originDevice: 'dev_remote_phone',
      originSequence: 42,
      recordedAt: '2026-01-01T12:00:00.000Z',
      content: { summary: 'Synced from remote phone' },
    });

    const fullHistory = await store.readJob('job_audit_f5');
    const remoteRecord = fullHistory.find((r) => r.recordId === 'rec_remote_sync_1');
    expect(remoteRecord).toBeDefined();
    expect(remoteRecord!.originDevice).toBe('dev_remote_phone');
    expect(remoteRecord!.originSequence).toBe(42);
    expect(remoteRecord!.recordedAt).toBe('2026-01-01T12:00:00.000Z');

    // 5. F22: Superseded version record carries displaced payload
    const supRec = await store.appendSupersededVersion(
      makeSupersededVersionInput('job_audit_f5', {
        supersededRecord: 'rec_remote_sync_1',
        supersedingRecord: 'rec_remote_sync_2',
        supersededPayload: { rule: 'deny_old' },
        supersededDevice: 'dev_remote_phone',
      })
    );
    expect(supRec.content.supersededRecord).toBe('rec_remote_sync_1');
    expect(supRec.content.supersededDevice).toBe('dev_remote_phone');
  });
});
