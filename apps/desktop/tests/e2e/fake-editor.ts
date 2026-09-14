import { app, BrowserWindow, ipcMain } from 'electron';

let win: BrowserWindow | null = null;
let blurCount = 0;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 600,
    height: 400,
    title: 'FakeEditor',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 10px; background: #fff; }
    textarea { width: 100%; height: 350px; font-family: monospace; font-size: 14px; }
  </style>
</head>
<body>
  <textarea id="editor" autofocus></textarea>
  <script>
    const ta = document.getElementById('editor');
    window.__text = '';
    window.__blurCount = 0;
    ta.addEventListener('input', () => { window.__text = ta.value; });
    ta.addEventListener('blur', () => { window.__blurCount++; });
  </script>
</body>
</html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  win.on('blur', () => {
    blurCount++;
  });
});

ipcMain.handle('get-handle', () => {
  if (!win) throw new Error('Window not ready');
  return win.getNativeWindowHandle().toString('base64');
});

ipcMain.handle('get-text', async () => {
  if (!win) return '';
  return win.webContents.executeJavaScript('window.__text');
});

ipcMain.handle('get-blur-count', async () => {
  if (!win) return 0;
  const domBlurs = await win.webContents.executeJavaScript('window.__blurCount');
  return blurCount + (domBlurs as number);
});

ipcMain.handle('is-focused', () => {
  if (!win) return false;
  return win.isFocused();
});

ipcMain.handle('get-bounds', () => {
  if (!win) return null;
  return win.getBounds();
});

ipcMain.handle('set-fullscreen', (_event, flag: boolean) => {
  if (!win) return;
  win.setFullScreen(flag);
});
