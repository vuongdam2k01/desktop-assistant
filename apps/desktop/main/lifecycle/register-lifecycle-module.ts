import { app } from 'electron';
import type { DesktopContext } from '../context.js';

export async function registerLifecycleModule(context: DesktopContext): Promise<void> {
  app.on('before-quit', () => {
    context.isQuitting = true;
  });
}
