import { app, BrowserWindow, ipcMain } from 'electron';
import { selectWindowIntegration } from '../../main/window-integration/select-window-integration.js';
import type { WindowIntegration } from '../../main/window-integration/types.js';
import type { WindowPlacementOptions } from '@desktop-assistant/contracts/native-window-manager';

let petWin: BrowserWindow | null = null;
let cardWin: BrowserWindow | null = null;
let integration: WindowIntegration | null = null;

async function bootHarness(): Promise<void> {
  integration = selectWindowIntegration({ skipCapabilityValidation: true });
  integration.setActivationPolicy('accessory');

  // Pre-warm card window
  cardWin = await integration.prewarmCardWindow();

  // Load interactive test card content
  const cardHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: rgba(30, 30, 30, 0.95); color: #fff; font-family: sans-serif; }
    #card-btn { width: 100%; height: 100%; padding: 20px; box-sizing: border-box; }
  </style>
</head>
<body>
  <div id="card-btn">Companion Card</div>
  <script>
    document.getElementById('card-btn').addEventListener('mousedown', () => {
      // Direct user interaction seam: request focus
      window.require && window.require('electron').ipcRenderer.send('card-focus-request');
    });
  </script>
</body>
</html>`;
  await cardWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(cardHtml)}`);

  // Create pet window with click counter
  petWin = new BrowserWindow({
    width: 200,
    height: 200,
    ...integration.browserWindowOptions('pet'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const petHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: transparent; overflow: hidden; }
    #pet-target {
      width: 100px;
      height: 100px;
      margin: 50px;
      background: #00ff00;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="pet-target"></div>
  <script>
    window.__clickCount = 0;
    document.getElementById('pet-target').addEventListener('click', () => {
      window.__clickCount++;
    });
  </script>
</body>
</html>`;

  await petWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(petHtml)}`);
  integration.applyNoActivateTopmost(petWin);
  integration.excludeFromCapture(petWin, true);
}

// A harness that fails while starting must say so. Left as an unhandled rejection, it
// simply never opens a window, and the driver can only report that it waited and saw none.
app.whenReady().then(
  () =>
    bootHarness().catch(err => {
      console.error('[product-harness] Failed to start:', err);
      app.exit(1);
    }),
  err => {
    console.error('[product-harness] Electron never became ready:', err);
    app.exit(1);
  }
);

ipcMain.on('card-focus-request', () => {
  if (cardWin && !cardWin.isDestroyed()) {
    cardWin.focus();
  }
});

ipcMain.handle('get-prewarmed-card-info', () => {
  if (!cardWin) throw new Error('Card not prewarmed');
  return {
    handle: cardWin.getNativeWindowHandle().toString('base64'),
    webContentsId: cardWin.webContents.id,
  };
});

ipcMain.handle('move-card', (_event, placement: WindowPlacementOptions) => {
  if (!cardWin || !integration) throw new Error('Not ready');
  integration.moveWithoutActivate(cardWin, placement);
});

ipcMain.handle('enable-pet-pixel-hit-test', () => {
  if (!petWin || !integration) throw new Error('Not ready');
  // 4x4 mask: corners transparent, center 2x2 opaque
  integration.enablePixelHitTest(petWin, {
    width: 4,
    height: 4,
    getAlphaAt(x, y) {
      if ((x === 1 || x === 2) && (y === 1 || y === 2)) {
        return 255;
      }
      return 0;
    },
  });
});

ipcMain.handle('get-pet-click-count', async () => {
  if (!petWin) return 0;
  return petWin.webContents.executeJavaScript('window.__clickCount');
});

ipcMain.handle('test-foreign-handle', (_event, foreignBase64: string) => {
  if (!integration) throw new Error('Integration not ready');
  const buf = Buffer.from(foreignBase64, 'base64');
  // Attempt to call applyNoActivateTopmost with foreign handle via mock/fake BrowserWindow wrapper
  const fakeWin = {
    isDestroyed: () => false,
    getNativeWindowHandle: () => buf,
  } as unknown as BrowserWindow;

  try {
    integration.applyNoActivateTopmost(fakeWin);
    return { ok: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
});

ipcMain.handle('restore-focus', () => {
  if (!integration) return false;
  return integration.restorePreviousFocus();
});

ipcMain.handle('set-activation-policy', (_event, mode: 'accessory' | 'regular') => {
  if (!integration) return false;
  return integration.setActivationPolicy(mode);
});

ipcMain.handle('exclude-card-capture', (_event, flag: boolean) => {
  if (!cardWin || !integration) return false;
  return integration.excludeFromCapture(cardWin, flag);
});

ipcMain.handle('get-window-count', () => {
  return BrowserWindow.getAllWindows().length;
});
