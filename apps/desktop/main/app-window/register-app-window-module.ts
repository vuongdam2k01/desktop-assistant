import { BrowserWindow, app } from 'electron';
import path from 'node:path';
import type { DesktopContext } from '../context.js';
import { resolveDevServerUrl } from '../development-overrides.js';

export async function registerAppWindowModule(context: DesktopContext): Promise<void> {
  const devServerUrl = resolveDevServerUrl(
    process.env,
    'VITE_DEV_SERVER_URL_APP',
    app.isPackaged
  );
  const preloadPath = path.resolve(__dirname, '../preload/index.cjs');

  const win = new BrowserWindow({
    width: 960, // UNVERIFIED: provisional scaffold geometry
    height: 720, // UNVERIFIED: provisional scaffold geometry
    title: 'Desktop Assistant',
    show: false, // Initially hidden or shown via tray
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  win.on('close', event => {
    if (!context.isQuitting) {
      event.preventDefault();
      win.hide();
      context.windowIntegration.setActivationPolicy('accessory');
    }
  });

  win.on('show', () => {
    context.windowIntegration.setActivationPolicy('regular');
  });

  win.on('hide', () => {
    context.windowIntegration.setActivationPolicy('accessory');
  });

  if (devServerUrl) {
    await win.loadURL(devServerUrl);
  } else {
    const htmlPath = path.resolve(__dirname, '../renderer-app/index.html');
    await win.loadFile(htmlPath);
  }

  context.appWindow = win;
}
