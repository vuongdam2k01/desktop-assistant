import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../src/schema.js';
import { ModelRoutingModule } from '../src/model-routing-module.js';
import {
  registerModelRoutingIpc,
  type IpcMainHandlerRegistrar,
  type IpcBroadcaster,
} from '../src/ipc.js';
import type { RoutingTable } from '@desktop-assistant/contracts/role-routing';
import type { UnitPrice } from '@desktop-assistant/contracts/usage-accounting';
import type { ProviderProfile } from '@desktop-assistant/contracts/provider-profile';
describe('ModelRouting IPC Registration', () => {
  let db: Database.Database;
  let module: ModelRoutingModule;
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown>();
  const broadcastSpy = vi.fn();

  const mockIpcMain: IpcMainHandlerRegistrar = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    },
  };

  const mockBroadcaster: IpcBroadcaster = {
    send: (channel, ...args) => {
      broadcastSpy(channel, ...args);
    },
  };

  const sampleProfile: ProviderProfile = {
    profileVersion: '0.1.0',
    id: 'ipc-profile',
    displayName: 'IPC Profile',
    endpoint: {
      address: 'https://api.example.com/v1',
      dialect: 'openai-completions',
    },
    credential: 'llm:provider:ipc:api_key',
    models: [
      { name: 'ipc-model', label: 'IPC Model', capabilities: ['text', 'tools'] },
    ],
    builtIn: false,
  };

  beforeEach(async () => {
    handlers.clear();
    broadcastSpy.mockClear();
    db = new Database(':memory:');
    initializeDatabase(db);

    module = new ModelRoutingModule({ db });
    registerModelRoutingIpc(mockIpcMain, module, mockBroadcaster);

    await module.profileStore.save(sampleProfile);
  });

  afterEach(() => {
    module.close();
  });

  it('handles profiles CRUD through IPC', async () => {
    const listHandler = handlers.get('profiles/list');
    expect(listHandler).toBeDefined();
    const list = (await listHandler!({})) as ProviderProfile[];
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('ipc-profile');

    const getHandler = handlers.get('profiles/get');
    const profile = (await getHandler!({}, { id: 'ipc-profile' })) as ProviderProfile | null;
    expect(profile?.displayName).toBe('IPC Profile');
  });

  it('handles routing assignments and queries through IPC', async () => {
    const assignHandler = handlers.get('routing/assign');
    expect(assignHandler).toBeDefined();

    const outcome = (await assignHandler!({}, {
      role: 'worker',
      profileId: 'ipc-profile',
      model: 'ipc-model',
    })) as { ok: boolean };
    expect(outcome.ok).toBe(true);

    const tableHandler = handlers.get('routing/table');
    const table = (await tableHandler!({})) as RoutingTable;
    expect(table.assignments.worker.state).toBe('assigned');
    if (table.assignments.worker.state === 'assigned') {
      expect(table.assignments.worker.model).toBe('ipc-model');
    }

    const choicesHandler = handlers.get('routing/choices');
    const choices = (await choicesHandler!({}, { role: 'worker' })) as Array<{ model: string }>;
    expect(choices).toHaveLength(1);
    expect(choices[0]?.model).toBe('ipc-model');
  });

  it('automatically applies routing defaults on saving first profile (C4)', async () => {
    const freshDb = new Database(':memory:');
    initializeDatabase(freshDb);
    const freshModule = new ModelRoutingModule({ db: freshDb });
    const freshHandlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown>();
    registerModelRoutingIpc({
      handle: (ch, l) => freshHandlers.set(ch, l),
    }, freshModule);

    // Table is initially unassigned
    const initialTable = await freshModule.routingRegistry.table();
    expect(initialTable.assignments.worker.state).toBe('unassigned');

    // Save first profile through IPC
    const saveHandler = freshHandlers.get('profiles/save');
    await saveHandler!({}, { profile: sampleProfile });

    // Now table should have defaults automatically applied!
    const updatedTable = await freshModule.routingRegistry.table();
    expect(updatedTable.assignments.worker.state).toBe('assigned');
    if (updatedTable.assignments.worker.state === 'assigned') {
      expect(updatedTable.assignments.worker.model).toBe('ipc-model');
    }

    freshModule.close();
  });

  it('rejects malformed role keys in routing/assign (I7)', async () => {
    const assignHandler = handlers.get('routing/assign');
    const outcome = (await assignHandler!({}, {
      role: 'INVALID_ROLE!@#',
      profileId: 'ipc-profile',
      model: 'ipc-model',
    })) as { ok: boolean; error?: string };

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe('ROLE_UNASSIGNED');
  });

  it('handles usage and unit pricing through IPC', async () => {
    const setPriceHandler = handlers.get('usage/set-price');
    const pricesHandler = handlers.get('usage/prices');

    await setPriceHandler!({}, {
      price: {
        profileId: 'ipc-profile',
        model: 'ipc-model',
        inputPricePerMillion: '0.500000',
        outputPricePerMillion: '1.000000',
        currency: 'USD',
        enteredAt: new Date().toISOString(),
      },
    });

    const prices = (await pricesHandler!({})) as UnitPrice[];
    expect(prices).toHaveLength(1);
    expect(prices[0]?.inputPricePerMillion).toBe('0.500000');
  });

  it('broadcasts standing notice events via broadcaster', async () => {
    await module.failureRegistry.raise({
      cause: 'CREDENTIAL_REFUSED',
      profileId: 'ipc-profile',
      roles: ['worker'],
      remedy: { kind: 'profile-credential', profileId: 'ipc-profile' },
      observedAt: new Date().toISOString(),
      dedupeKey: 'ipc-profile:CREDENTIAL_REFUSED',
    });

    expect(broadcastSpy).toHaveBeenCalledWith(
      'provider-failure/raised',
      expect.objectContaining({
        cause: 'CREDENTIAL_REFUSED',
        profileId: 'ipc-profile',
      })
    );

    await module.failureRegistry.withdraw('ipc-profile:CREDENTIAL_REFUSED');

    expect(broadcastSpy).toHaveBeenCalledWith(
      'provider-failure/withdrawn',
      { dedupeKey: 'ipc-profile:CREDENTIAL_REFUSED' }
    );
  });
});
