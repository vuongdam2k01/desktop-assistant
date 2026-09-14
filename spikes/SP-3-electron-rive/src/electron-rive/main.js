const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let currentMetrics = {
  currentFps: 60,
  avgFps: 60,
  minFps: 60,
  maxFps: 60,
  p95Fps: 60,
  sampleCount: 0,
  fpsHistory: [],
  activeState: 'idle',
  lastTransitionMs: 0,
  transitions: []
};

const HTTP_PORT = parseInt(process.env.PET_PORT || '3838', 10);

const fs = require('fs');
const logFile = path.join(__dirname, 'debug-main.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  try { fs.appendFileSync(logFile, line); } catch(e) {}
  console.log(...args);
}

process.on('uncaughtException', (err) => {
  log('FATAL uncaughtException:', err.stack || err);
});
process.on('unhandledRejection', (err) => {
  log('FATAL unhandledRejection:', err.stack || err);
});

function createWindow() {
  log('createWindow called');
  mainWindow = new BrowserWindow({
    title: 'SP3-Pet-Window',
    width: 320,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });


  mainWindow.webContents.on('console-message', (event, level, message) => {
    log(`[Renderer L${level}] ${message}`);
  });

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    log('did-fail-load:', code, desc);
  });

  mainWindow.webContents.on('render-process-gone', (e, details) => {
    log('render-process-gone:', details);
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    log('mainWindow closed');
    mainWindow = null;
  });
}



// IPC handlers
ipcMain.on('update-metrics', (event, metrics) => {
  currentMetrics = { ...currentMetrics, ...metrics };
});

ipcMain.on('state-transition-done', (event, data) => {
  currentMetrics.activeState = data.state;
  currentMetrics.lastTransitionMs = data.latencyMs;
  currentMetrics.transitions.push(data);
});

// Control HTTP Server
function startHttpServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', pid: process.pid }));
    }

    if (req.method === 'GET' && req.url === '/bounds') {
      if (!mainWindow) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: 'No window' }));
      }
      const bounds = mainWindow.getBounds();
      const hwnd = mainWindow.getNativeWindowHandle();
      res.writeHead(200);
      return res.end(JSON.stringify({
        ...bounds,
        hwnd: hwnd.readInt32LE(0)
      }));
    }

    if (req.method === 'GET' && req.url.startsWith('/capture-page')) {
      if (!mainWindow) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: 'No window' }));
      }
      const u = new URL(req.url, 'http://127.0.0.1:3838');
      const destPath = u.searchParams.get('path');
      mainWindow.webContents.capturePage().then((img) => {
        const pngBuf = img.toPNG();
        if (destPath) {
          fs.writeFileSync(destPath, pngBuf);
        }
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          path: destPath,
          sizeBytes: pngBuf.length,
          width: img.getSize().width,
          height: img.getSize().height
        }));
      }).catch(err => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/metrics') {

      const mem = process.memoryUsage();
      res.writeHead(200);
      return res.end(JSON.stringify({
        ...currentMetrics,
        processMemory: {
          rssMb: (mem.rss / 1024 / 1024).toFixed(2),
          heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(2),
          heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(2)
        }
      }));
    }

    if (req.method === 'POST' && req.url === '/reset-metrics') {
      if (mainWindow) {
        mainWindow.webContents.send('reset-fps');
      }
      currentMetrics.fpsHistory = [];
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'reset_ok' }));
    }

    if (req.method === 'POST' && req.url === '/state') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const targetState = payload.state;
          if (!targetState) {
            res.writeHead(400);
            return res.end(JSON.stringify({ error: 'Missing state' }));
          }

          if (mainWindow) {
            mainWindow.webContents.send('change-state', targetState);
          }

          // Wait brief moment for renderer to process and reply
          setTimeout(() => {
            res.writeHead(200);
            res.end(JSON.stringify({
              status: 'ok',
              activeState: currentMetrics.activeState,
              latencyMs: currentMetrics.lastTransitionMs
            }));
          }, 60);
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/close') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'closing' }));
      setTimeout(() => app.quit(), 200);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`[SP-3 Control Server] listening on http://127.0.0.1:${HTTP_PORT}`);
  });
}

app.whenReady().then(() => {
  createWindow();
  startHttpServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
