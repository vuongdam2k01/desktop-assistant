import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openLedgerStore, type LedgerStore } from '@desktop-assistant/ledger-store';
import { JobManager } from '../../src/job-manager.js';
import type {
  ConnectorReconcileReader,
  ConnectorStatus,
  ConnectorStatusProvider,
  ConnectorTokenRenewer,
  JobManagerOptions,
  ReconcileReadInput,
  ReconcileReadResult,
} from '../../src/types.js';

export interface TestHarness {
  readonly tempDir: string;
  readonly dbPath: string;
  readonly ledgerStore: LedgerStore;
  readonly jobManager: JobManager;
  readonly mockStatusProvider: MockConnectorStatusProvider;
  readonly mockTokenRenewer: MockConnectorTokenRenewer;
  readonly mockReconcileReader: MockConnectorReconcileReader;
  cleanup(): Promise<void>;
}

export class MockConnectorStatusProvider implements ConnectorStatusProvider {
  readonly statuses = new Map<string, ConnectorStatus>();

  setStatus(connector: string, status: Partial<ConnectorStatus>): void {
    this.statuses.set(connector, {
      connector,
      connected: status.connected ?? true,
      tokenExpiresAt: status.tokenExpiresAt ?? new Date(Date.now() + 3600000).toISOString(),
      canRenewWithoutUser: status.canRenewWithoutUser ?? true,
      ...status,
    });
  }

  async checkStatus(connector: string): Promise<ConnectorStatus> {
    const found = this.statuses.get(connector);
    if (found) {
      return found;
    }
    return {
      connector,
      connected: true,
      tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      canRenewWithoutUser: true,
    };
  }
}

export class MockConnectorTokenRenewer implements ConnectorTokenRenewer {
  renewCallCount = 0;
  shouldSucceed = true;

  async renewToken(_connector: string): Promise<boolean> {
    this.renewCallCount++;
    return this.shouldSucceed;
  }
}

export class MockConnectorReconcileReader implements ConnectorReconcileReader {
  readonly readHandlers = new Map<string, (input: ReconcileReadInput) => Promise<ReconcileReadResult>>();
  defaultResponse: ReconcileReadResult = { ok: true, data: {} };
  unreachable = false;

  setHandler(operation: string, handler: (input: ReconcileReadInput) => Promise<ReconcileReadResult>): void {
    this.readHandlers.set(operation, handler);
  }

  async executeRead(input: ReconcileReadInput): Promise<ReconcileReadResult> {
    if (this.unreachable) {
      return { ok: false, unreachable: true };
    }
    const handler = this.readHandlers.get(input.operation);
    if (handler) {
      return await handler(input);
    }
    return this.defaultResponse;
  }
}

export async function createTestHarness(customOptions?: Partial<JobManagerOptions>): Promise<TestHarness> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `da-job-test-${randomUUID()}`));
  const dbPath = path.join(tempDir, 'test-ledger.db');

  const ledgerStore = await openLedgerStore({
    path: dbPath,
    deviceId: 'test-device-1',
  });
  const mockStatusProvider = new MockConnectorStatusProvider();
  const mockTokenRenewer = new MockConnectorTokenRenewer();
  const mockReconcileReader = new MockConnectorReconcileReader();

  const jobManager = new JobManager({
    ledgerStore,
    currentDeviceId: 'test-device-1',
    statusProvider: mockStatusProvider,
    tokenRenewer: mockTokenRenewer,
    reconcileReader: mockReconcileReader,
    ...customOptions,
  });

  return {
    tempDir,
    dbPath,
    ledgerStore,
    jobManager,
    mockStatusProvider,
    mockTokenRenewer,
    mockReconcileReader,
    async cleanup() {
      await ledgerStore.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}
