import { app } from 'electron';
import { shouldDisableHardwareAcceleration } from './software-rendering.js';
import { resolveUserDataOverride } from './development-overrides.js';
import { DesktopContext } from './context.js';
import { registerLifecycleModule } from './lifecycle/register-lifecycle-module.js';
import { registerCredentialStoreModule } from './credential-store/register-credential-store-module.js';
import { registerModelRoutingModule } from './model-routing/register-model-routing-module.js';
import { registerLocaleModule } from './locale/register-locale-module.js';
import { registerPetWindowModule } from './pet-window/register-pet-window-module.js';
import { registerAppWindowModule } from './app-window/register-app-window-module.js';
import { registerTrayModule } from './tray/register-tray-module.js';
import { registerUpdaterSafetyModule } from './updater/register-updater-safety-module.js';
import { registerWindowIntegrationModule } from './window-integration/register-window-integration-module.js';

// 1. Data directory override, applied before anything derives a path from it
const userDataOverride = resolveUserDataOverride(process.env, app.isPackaged);
if (userDataOverride) {
  app.setPath('userData', userDataOverride);
}

// 2. Single instance lock (prevent concurrent database access)
// Exiting here rather than asking the application to quit: quit is cooperative and
// lets boot carry on registering modules, which would open the local database that
// the owning instance already holds.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.log('Another DesktopAssistant instance already owns this profile; exiting.');
  app.exit(0);
}

// 3. Inviolable application identity (RISK-078)
app.setName('DesktopAssistant');

// 4. Hardware acceleration policy
if (shouldDisableHardwareAcceleration()) {
  app.disableHardwareAcceleration();
}

async function boot(): Promise<void> {
  await app.whenReady();

  const context = new DesktopContext();

  await registerWindowIntegrationModule(context);
  await registerLifecycleModule(context);
  await registerCredentialStoreModule(context);
  await registerModelRoutingModule(context);
  await registerLocaleModule(context);
  await registerPetWindowModule(context);
  await registerAppWindowModule(context);
  await registerTrayModule(context);
  await registerUpdaterSafetyModule(context);
}

boot().catch(err => {
  console.error('Fatal boot error in DesktopAssistant main process:', err);
  app.exit(1);
});
