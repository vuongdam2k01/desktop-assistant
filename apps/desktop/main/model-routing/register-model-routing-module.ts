import path from 'node:path';
import { app, ipcMain } from 'electron';
import { ModelRoutingModule, registerModelRoutingIpc } from '@desktop-assistant/model-routing';
import type { DesktopContext } from '../context.js';

export async function registerModelRoutingModule(context: DesktopContext): Promise<void> {
  const databasePath = path.join(app.getPath('userData'), 'model-routing.db');

  const module = new ModelRoutingModule({
    databasePath,
    credentialStore: context.hasCredentialStore ? context.credentialStore : undefined,
  });

  context.modelRoutingModule = module;

  const broadcaster = {
    send: (channel: string, ...args: unknown[]) => {
      if (context.hasCardWindow && !context.cardWindow.isDestroyed()) {
        context.cardWindow.webContents.send(channel, ...args);
      }
      if (context.appWindow && !context.appWindow.isDestroyed()) {
        context.appWindow.webContents.send(channel, ...args);
      }
    },
  };

  const disposeIpc = registerModelRoutingIpc(ipcMain, module, broadcaster);

  app.on('will-quit', () => {
    disposeIpc();
    module.close();
  });
}
