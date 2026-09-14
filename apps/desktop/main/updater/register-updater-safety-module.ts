import { autoUpdater } from 'electron-updater';
import type { DesktopContext } from '../context.js';

export async function registerUpdaterSafetyModule(_context: DesktopContext): Promise<void> {
  // Hard safety invariant for F0: do not auto-install on app quit
  try {
    autoUpdater.autoInstallOnAppQuit = false;
  } catch (err) {
    console.warn('[Updater] autoUpdater bypassed in dev/test environment:', err);
  }
  // Must NOT check, download, install, or expose update UI in F0
}
