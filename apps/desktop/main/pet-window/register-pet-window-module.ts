import { BrowserWindow, app, ipcMain } from 'electron';
import path from 'node:path';
import type { DesktopContext } from '../context.js';
import {
  PET_WINDOW_HEIGHT,
  PET_WINDOW_WIDTH,
} from './pet-bounds-topology.js';
import { PetWindowControllerImpl } from './pet-controller.js';
import { resolveDevServerUrl } from '../development-overrides.js';

export async function registerPetWindowModule(context: DesktopContext): Promise<void> {
  const devServerUrl = resolveDevServerUrl(
    process.env,
    'VITE_DEV_SERVER_URL_PET',
    app.isPackaged
  );
  const preloadPath = path.resolve(__dirname, '../preload/index.cjs');

  const win = new BrowserWindow({
    width: PET_WINDOW_WIDTH,
    height: PET_WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false, // Hidden until default asset activates
    ...context.windowIntegration.browserWindowOptions('pet'),
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  // Security bounds: deny navigation and popups
  win.webContents.on('will-navigate', event => {
    event.preventDefault();
  });

  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  context.windowIntegration.applyNoActivateTopmost(win);
  context.windowIntegration.excludeFromCapture(win, true);

  const controller = new PetWindowControllerImpl(win, context.windowIntegration);
  context.petController = controller;
  context.petWindow = win;
  (win as unknown as { petController: PetWindowControllerImpl }).petController = controller;
  // Always-on-top reassertion on application activation
  const onAppActivate = (): void => {
    controller.reassertAlwaysOnTop();
  };
  app.on('activate', onAppActivate);

  const onReady = (event: Electron.IpcMainEvent): void => {
    if (event.senderFrame === win.webContents.mainFrame) {
      controller.handleRendererReady();
    }
  };

  const onReload = (event: Electron.IpcMainEvent): void => {
    if (event.senderFrame === win.webContents.mainFrame) {
      // A rejection with no reader ends the process. Nothing about a failed reload should
      // take the tray, the ledger and the credential store down with it.
      controller.reloadActivePack().catch(err => {
        console.error('[PetWindow] Reloading the active pack failed:', err);
      });
    }
  };

  ipcMain.on('pet:ready', onReady);
  ipcMain.on('pet:reloadPack', onReload);
  ipcMain.handle('pet:packState', async event => {
    if (event.senderFrame === win.webContents.mainFrame) {
      return controller.getPackState();
    }
    return null;
  });

  win.on('closed', () => {
    app.removeListener('activate', onAppActivate);
    ipcMain.removeListener('pet:ready', onReady);
    ipcMain.removeListener('pet:reloadPack', onReload);
    ipcMain.removeHandler('pet:packState');
  });

  if (devServerUrl) {
    await win.loadURL(devServerUrl);
  } else {
    const htmlPath = path.resolve(__dirname, '../renderer-pet/index.html');
    await win.loadFile(htmlPath);
  }
}
