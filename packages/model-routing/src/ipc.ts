import type { ProviderProfile } from '@desktop-assistant/contracts/provider-profile';
import type { UnitPrice } from '@desktop-assistant/contracts/usage-accounting';
import type { ModelRoutingModule } from './model-routing-module.js';

export interface IpcMainHandlerRegistrar {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
  ): void;
  removeHandler?(channel: string): void;
}

export interface IpcBroadcaster {
  send(channel: string, ...args: unknown[]): void;
}
function isSafeString(val: unknown, maxLength = 256): val is string {
  return typeof val === 'string' && val.trim().length > 0 && val.length <= maxLength;
}

const ROLE_KEY_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
function isSafeRoleKey(val: unknown): val is string {
  return typeof val === 'string' && ROLE_KEY_PATTERN.test(val);
}

export function registerModelRoutingIpc(
  ipcMain: IpcMainHandlerRegistrar,
  module: ModelRoutingModule,
  broadcaster?: IpcBroadcaster | undefined
): () => void {
  const registeredChannels: string[] = [
    'routing/table',
    'routing/assign',
    'routing/clear',
    'routing/choices',
    'routing/defaults',
    'routing/apply-defaults',
    'profiles/list',
    'profiles/get',
    'profiles/save',
    'profiles/delete',
    'provider-failure/standing',
    'provider-failure/remedy',
    'usage/for-job',
    'usage/prices',
    'usage/set-price',
    'usage/clear-price',
  ];
  ipcMain.handle('routing/table', async () => {
    return module.routingRegistry.table();
  });

  ipcMain.handle('routing/assign', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as Record<string, unknown> | undefined;
    if (!payload || !isSafeRoleKey(payload.role) || !isSafeString(payload.profileId, 64) || !isSafeString(payload.model, 128)) {
      return {
        ok: false,
        error: 'ROLE_UNASSIGNED',
        detail: 'Invalid or malformed role assignment payload',
      };
    }
    return module.routingRegistry.assign(
      payload.role,
      payload.profileId,
      payload.model,
      payload.acknowledgeUnmeasured === true
    );
  });

  ipcMain.handle('routing/clear', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as Record<string, unknown> | undefined;
    if (!payload || !isSafeRoleKey(payload.role)) {
      throw new Error('Invalid role specified for routing/clear');
    }
    await module.routingRegistry.clear(payload.role);
    return { cleared: true };
  });

  ipcMain.handle('routing/apply-defaults', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as Record<string, unknown> | undefined;
    if (!payload || !isSafeString(payload.profileId, 64)) {
      throw new Error('Invalid profileId specified for routing/apply-defaults');
    }
    return module.routingRegistry.applyDefaults(payload.profileId);
  });
  ipcMain.handle('routing/choices', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as Record<string, unknown> | undefined;
    if (!payload || !isSafeRoleKey(payload.role)) {
      throw new Error('Invalid role specified for routing/choices');
    }
    return module.routingRegistry.choices(payload.role);
  });

  ipcMain.handle('routing/defaults', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as Record<string, unknown> | undefined;
    if (!payload || !isSafeString(payload.profileId, 64)) {
      throw new Error('Invalid profileId specified for routing/defaults');
    }
    return module.routingRegistry.proposeDefaults(payload.profileId);
  });
  ipcMain.handle('routing/image-route', async () => {
    return module.routingRegistry.imageRouteState();
  });

  // --- Provider Profiles Channels ---
  ipcMain.handle('profiles/list', async () => {
    return module.profileStore.list();
  });
  ipcMain.handle('profiles/get', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as Record<string, unknown> | undefined;
    if (!payload || !isSafeString(payload.id, 64)) {
      return null;
    }
    return module.profileStore.get(payload.id);
  });

  ipcMain.handle('profiles/save', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as { profile?: ProviderProfile } | undefined;
    if (!payload || !payload.profile) {
      throw new Error('Missing profile in profiles/save payload');
    }
    const hasAssignments = await module.routingRegistry.hasAnyAssignment();
    await module.profileStore.save(payload.profile);
    // C4: Automatically propose and apply defaults on first profile save
    if (!hasAssignments) {
      await module.routingRegistry.applyDefaults(payload.profile.id);
    }
    return { ok: true };
  });

  ipcMain.handle('profiles/delete', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as Record<string, unknown> | undefined;
    if (!payload || !isSafeString(payload.id, 64)) {
      throw new Error('Invalid profile ID in profiles/delete');
    }
    await module.profileStore.delete(payload.id);
    return { ok: true };
  });
  // --- Failure Notice Channels ---
  ipcMain.handle('provider-failure/standing', async () => {
    return module.failureRegistry.standing();
  });

  ipcMain.handle(
    'provider-failure/remedy',
    async (_event: unknown, ...args: unknown[]) => {
      const payload = args[0] as Record<string, unknown> | undefined;
      if (!payload || !isSafeString(payload.dedupeKey, 128)) {
        return { ok: false, error: 'INVALID_PAYLOAD' };
      }
      const standing = await module.failureRegistry.standing();
      const notice = standing.find((n) => n.dedupeKey === payload.dedupeKey);
      if (!notice) {
        return { ok: false, error: 'NOTICE_NOT_FOUND' };
      }
      return { ok: true, remedy: notice.remedy };
    }
  );

  // --- Usage Accounting Channels ---
  ipcMain.handle('usage/for-job', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as Record<string, unknown> | undefined;
    if (!payload || !isSafeString(payload.jobId, 128)) {
      throw new Error('Invalid jobId in usage/for-job');
    }
    return module.usageAccounting.forJob(payload.jobId);
  });

  ipcMain.handle('usage/prices', async () => {
    return module.usageAccounting.prices();
  });

  ipcMain.handle('usage/set-price', async (_event: unknown, ...args: unknown[]) => {
    const payload = args[0] as { price?: UnitPrice } | undefined;
    if (!payload || !payload.price) {
      throw new Error('Missing price in usage/set-price');
    }
    await module.usageAccounting.setPrice(payload.price);
    return { ok: true };
  });

  ipcMain.handle(
    'usage/clear-price',
    async (_event: unknown, ...args: unknown[]) => {
      const payload = args[0] as Record<string, unknown> | undefined;
      if (!payload || !isSafeString(payload.profileId, 64) || !isSafeString(payload.model, 128)) {
        throw new Error('Invalid payload in usage/clear-price');
      }
      await module.usageAccounting.clearPrice(payload.profileId, payload.model);
      return { ok: true };
    }
  );
  // --- Wire Pub-Sub Broadcasts if broadcaster provided ---
  let unsubRaised: (() => void) | undefined = undefined;
  let unsubWithdrawn: (() => void) | undefined = undefined;

  if (broadcaster) {
    unsubRaised = module.failureRegistry.onRaised((notice) => {
      broadcaster.send('provider-failure/raised', notice);
    });
    unsubWithdrawn = module.failureRegistry.onWithdrawn((payload) => {
      broadcaster.send('provider-failure/withdrawn', payload);
    });
  }

  return () => {
    unsubRaised?.();
    unsubWithdrawn?.();
    if (ipcMain.removeHandler) {
      for (const ch of registeredChannels) {
        ipcMain.removeHandler(ch);
      }
    }
  };
}
