import path from 'node:path';
import process from 'node:process';
import { app, ipcMain, safeStorage } from 'electron';
import {
  CredentialStore,
  ElectronSafeStorageCipherGateway,
  DEFAULT_CREDENTIAL_DESCRIPTORS,
} from '@desktop-assistant/credential-store';
import type { DesktopContext } from '../context.js';
import { registerCredentialPresenceIpc } from './register-credential-presence-ipc.js';

export async function registerCredentialStoreModule(context: DesktopContext): Promise<void> {
  const cipherGateway = new ElectronSafeStorageCipherGateway(safeStorage, process.platform);
  const databasePath = path.join(app.getPath('userData'), 'credentials.db');

  const store = new CredentialStore({
    databasePath,
    cipherGateway,
  });

  for (const descriptor of DEFAULT_CREDENTIAL_DESCRIPTORS) {
    store.registerClass(descriptor);
  }

  await store.open();

  context.credentialStore = store;

  registerCredentialPresenceIpc(ipcMain, store);

  app.on('will-quit', () => {
    store.close();
  });
}
