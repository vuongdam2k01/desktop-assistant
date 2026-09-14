const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();

let win = null;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 440,
    height: 240,
    x: 420,
    y: 220,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: true,
    skipTaskbar: false,
    title: "SP-0-Electron-Minimal",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Expose an exit signal after 10s or when requested
  ipcMain.on('close-app', () => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
