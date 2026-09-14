import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  AppendIntentInput,
  AppendResultInput,
  AppendDecisionInput,
  AppendErrorInput,
  AppendInformationInput,
  AppendSupersededVersionInput,
  NewJob,
} from '../../src/types.js';

export interface TestDir {
  readonly path: string;
  readonly cleanup: () => void;
  dbPath(name?: string): string;
}

const activeHandles = new Set<Database.Database>();

export function trackDb(db: Database.Database): Database.Database {
  activeHandles.add(db);
  return db;
}

export function closeAllDbs(): void {
  for (const db of activeHandles) {
    try {
      if (db.open) db.close();
    } catch {
      // Best effort close
    }
  }
  activeHandles.clear();
}

export function createTestDir(prefix = 'ledger-test-'): TestDir {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  return {
    path: dir,
    dbPath(name = 'ledger.db'): string {
      return path.join(dir, name);
    },
    cleanup(): void {
      closeAllDbs();
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch {
        // Best effort cleanup
      }
    },
  };
}

export function makeJob(id = `job_${crypto.randomUUID()}`): NewJob {
  return {
    id,
    originalRequest: `Test job request for ${id}`,
    approvalMode: 'smart',
  };
}

export function makeIntentInput(
  jobId: string,
  correlationId = `corr_${crypto.randomUUID()}`,
  overrides?: Partial<AppendIntentInput>
): AppendIntentInput {
  return {
    jobId,
    correlationId,
    connector: 'notion',
    tool: 'update_page',
    parameters: { page_id: 'page_123', status: 'In Progress' },
    before: {
      captured: true,
      target: 'page_123',
      state: { status: 'Not Started' },
    },
    reversibility: {
      kind: 'reversible',
      snapshotMethod: 'read_page',
    },
    reconciliation: {
      method: 'readback',
      read_operation: 'get_page',
    },
    ...overrides,
  };
}

export function makeResultInput(
  jobId: string,
  correlationId: string,
  overrides?: Partial<AppendResultInput>
): AppendResultInput {
  return {
    jobId,
    correlationId,
    outcome: 'succeeded',
    establishedBy: 'observed',
    response: { ok: true, page_id: 'page_123' },
    after: {
      captured: true,
      target: 'page_123',
      state: { status: 'In Progress' },
    },
    compensatingAction: {
      connector: 'notion',
      tool: 'update_page',
      parameters: { page_id: 'page_123', status: 'Not Started' },
    },
    ...overrides,
  };
}

export function makeDecisionInput(
  jobId: string,
  overrides?: Partial<AppendDecisionInput>
): AppendDecisionInput {
  return {
    jobId,
    decision: 'approve',
    decidedBy: 'user',
    scope: 'page_123',
    reason: 'Approved by test operator',
    ...overrides,
  };
}

export function makeErrorInput(
  jobId: string,
  overrides?: Partial<AppendErrorInput>
): AppendErrorInput {
  return {
    jobId,
    code: 'PLATFORM_TIMEOUT',
    message: 'Request to remote service timed out after 30000ms',
    interrupted: false,
    ...overrides,
  };
}

export function makeInformationInput(
  jobId: string,
  overrides?: Partial<AppendInformationInput>
): AppendInformationInput {
  return {
    jobId,
    summary: 'Background sync step finished without errors',
    ...overrides,
  };
}

export function makeSupersededVersionInput(
  jobId: string,
  overrides?: Partial<AppendSupersededVersionInput>
): AppendSupersededVersionInput {
  return {
    jobId,
    supersededRecord: `rec_${crypto.randomUUID()}`,
    supersedingRecord: `rec_${crypto.randomUUID()}`,
    supersededPayload: { version: 1, rule: 'deny_all' },
    supersededDevice: 'dev_remote_laptop',
    ...overrides,
  };
}
