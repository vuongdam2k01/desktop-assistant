const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  ipcMain.on('inspect-done', (evt, results) => {
    console.log('INSPECT_RESULTS_BEGIN');
    console.log(JSON.stringify(results, null, 2));
    console.log('INSPECT_RESULTS_END');
    app.quit();
  });

  win.loadFile(path.join(__dirname, 'test.html'));
});
