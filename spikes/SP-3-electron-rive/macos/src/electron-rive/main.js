const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let occlusionWindow = null;
let rendererGpuInfo = null;
let assetLoadCallback = null;

const powerEvents = [];

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
  transitions: [],
  totalFramesRendered: 0
};

const HTTP_PORT = parseInt(process.env.PET_PORT || '3838', 10);
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
    title: 'SP3-Pet-Window-macOS',
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

  // macOS specific alwaysOnTop level and Space behavior
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    log('mainWindow closed');
    mainWindow = null;
  });
}

// PowerMonitor events
powerMonitor.on('suspend', () => {
  const evt = { event: 'suspend', timestamp: Date.now(), iso: new Date().toISOString() };
  powerEvents.push(evt);
  log('[PowerMonitor] System suspend detected');
});

powerMonitor.on('resume', () => {
  const evt = { event: 'resume', timestamp: Date.now(), iso: new Date().toISOString() };
  powerEvents.push(evt);
  log('[PowerMonitor] System resume detected');
});

powerMonitor.on('lock-screen', () => {
  const evt = { event: 'lock-screen', timestamp: Date.now(), iso: new Date().toISOString() };
  powerEvents.push(evt);
  log('[PowerMonitor] Lock screen detected');
});

powerMonitor.on('unlock-screen', () => {
  const evt = { event: 'unlock-screen', timestamp: Date.now(), iso: new Date().toISOString() };
  powerEvents.push(evt);
  log('[PowerMonitor] Unlock screen detected');
});

// IPC handlers
ipcMain.on('update-metrics', (event, metrics) => {
  currentMetrics = { ...currentMetrics, ...metrics };
});

ipcMain.on('state-transition-done', (event, data) => {
  currentMetrics.activeState = data.state;
  currentMetrics.lastTransitionMs = data.latencyMs;
  currentMetrics.transitions.push(data);
});

ipcMain.on('renderer-gpu-info-reply', (event, info) => {
  rendererGpuInfo = info;
});

ipcMain.on('asset-loaded', (event, result) => {
  if (assetLoadCallback) {
    assetLoadCallback(result);
    assetLoadCallback = null;
  }
});

// Control HTTP Server
function startHttpServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200);
      return res.end(JSON.stringify({
        status: 'ok',
        pid: process.pid,
        platform: process.platform,
        arch: process.arch
      }));
    }

    if (req.method === 'GET' && req.url === '/bounds') {
      if (!mainWindow) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: 'No window' }));
      }
      const bounds = mainWindow.getBounds();
      res.writeHead(200);
      return res.end(JSON.stringify(bounds));
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
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
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

    if (req.method === 'POST' && req.url === '/toggle-hud') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        const payload = JSON.parse(body || '{}');
        if (mainWindow) {
          mainWindow.webContents.send('toggle-hud', payload.show);
        }
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', hudVisible: payload.show }));
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/metrics') {
      const mem = process.memoryUsage();
      const appMetrics = app.getAppMetrics();
      res.writeHead(200);
      return res.end(JSON.stringify({
        ...currentMetrics,
        processMemory: {
          rssMb: (mem.rss / 1024 / 1024).toFixed(2),
          heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(2),
          heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(2)
        },
        clusterProcesses: appMetrics.map(p => ({
          pid: p.pid,
          type: p.type,
          cpuPercent: p.cpu.percentCPUUsage,
          workingSetSizeKb: p.memory.workingSetSize,
          peakWorkingSetSizeKb: p.memory.peakWorkingSetSize,
          privateBytesKb: p.memory.privateBytes
        })),
        powerEvents
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
          }, 80);
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/gpu-info') {
      const gpuFeatureStatus = app.getGPUFeatureStatus();
      if (mainWindow) {
        mainWindow.webContents.send('get-renderer-gpu-info');
      }

      setTimeout(() => {
        app.getGPUInfo('basic').then((gpuBasic) => {
          res.writeHead(200);
          res.end(JSON.stringify({
            gpuFeatureStatus,
            gpuBasic,
            rendererGpuInfo
          }, null, 2));
        }).catch(err => {
          res.writeHead(200);
          res.end(JSON.stringify({
            gpuFeatureStatus,
            rendererGpuInfo,
            gpuBasicError: err.message
          }, null, 2));
        });
      }, 100);
      return;
    }

    if (req.method === 'POST' && req.url === '/simulate-occlusion') {
      if (!mainWindow) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: 'No main window' }));
      }
      const b = mainWindow.getBounds();
      if (occlusionWindow) {
        occlusionWindow.close();
        occlusionWindow = null;
      }
      occlusionWindow = new BrowserWindow({
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        frame: false,
        backgroundColor: '#000000',
        alwaysOnTop: true,
        hasShadow: false,
        show: true
      });
      occlusionWindow.setAlwaysOnTop(true, 'screen-saver', 2);
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'occlusion_active', bounds: b }));
    }

    if (req.method === 'POST' && req.url === '/remove-occlusion') {
      if (occlusionWindow) {
        occlusionWindow.close();
        occlusionWindow = null;
      }
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'occlusion_removed' }));
    }

    if (req.method === 'POST' && req.url === '/load-asset') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const assetName = payload.asset || 'skills.riv';
          assetLoadCallback = (result) => {
            res.writeHead(200);
            res.end(JSON.stringify(result));
          };
          if (mainWindow) {
            mainWindow.webContents.send('load-asset', assetName);
          } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'No main window' }));
          }
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
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
    console.log(`[SP-3/mac Control Server] listening on http://127.0.0.1:${HTTP_PORT}`);
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
