const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const koffi = require('koffi');

const logFile = path.join(__dirname, '../../evidence/electron-startup.log');
function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch(e) {}
}

log('Starting main.js, process.argv: ' + JSON.stringify(process.argv));

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err}`);
});
process.on('unhandledRejection', (r) => {
  log(`UNHANDLED REJECTION: ${r}`);
});

// Win32 API via Koffi
let user32 = null;
let SetWindowLongPtrA = null;
let GetWindowLongPtrA = null;
let SetWindowPos = null;
let GetForegroundWindow = null;
let GetWindowRect = null;

try {
  user32 = koffi.load('user32.dll');
  SetWindowLongPtrA = user32.func('intptr_t __stdcall SetWindowLongPtrA(void* hWnd, int nIndex, intptr_t dwNewLong)');
  GetWindowLongPtrA = user32.func('intptr_t __stdcall GetWindowLongPtrA(void* hWnd, int nIndex)');
  SetWindowPos = user32.func('bool __stdcall SetWindowPos(void* hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)');
  GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()');
  log('Win32 API loaded via koffi');
} catch (err) {
  log('[Win32] Koffi load warning: ' + err.message);
}

const GWL_EXSTYLE = -20;
const WS_EX_NOACTIVATE = 0x08000000;
const WS_EX_TOPMOST = 0x00000008;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOACTIVATE = 0x0010;
const SWP_SHOWWINDOW = 0x0040;
const SWP_NOOWNERZORDER = 0x0200;
const SWP_NOSENDCHANGING = 0x0400;

function applyWin32Styles(win) {
  if (!SetWindowLongPtrA || !win) return;
  try {
    const hwndBuf = win.getNativeWindowHandle();
    const currentEx = GetWindowLongPtrA(hwndBuf, GWL_EXSTYLE);
    const newEx = BigInt(currentEx) | BigInt(WS_EX_NOACTIVATE) | BigInt(WS_EX_TOPMOST);
    SetWindowLongPtrA(hwndBuf, GWL_EXSTYLE, newEx);
    SetWindowPos(hwndBuf, -1, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING | SWP_SHOWWINDOW);
    log('applyWin32Styles applied successfully to HWND');
  } catch (e) {
    log('[Win32] Failed to apply styles: ' + e.message);
  }
}

// Global App State
let mode = 'arch-a'; // 'arch-a' or 'arch-b'
let petWindow = null;
let cardWindow = null;
let overlayWindow = null;

let petState = 'idle';
let locomotion = 'standing';

let currentPos = { x: 300, y: 300 };
let petSize = { width: 200, height: 200 };

let motionConfig = {
  type: 'idle', // 'idle' | 'linear' | 'circle' | 'patrol' | 'cross-screen' | 'perch'
  speed: 4,
  startX: 100,
  startY: 300,
  endX: 800,
  endY: 300,
  direction: 1,
  angle: 0,
  centerX: 500,
  centerY: 400,
  radius: 200,
  perchTargetHwnd: null,
  perchOffset: { x: 20, y: -180 }
};

let motionTimer = null;
let cardVisible = false;
let cardOrientation = 'right';

// Telemetry
let metrics = {
  fps: 60,
  minFps: 60,
  maxFps: 60,
  avgFps: 60,
  p95Fps: 60,
  fpsSamples: [],
  frameCount: 0,
  droppedFrames: 0,
  movesCount: 0,
  lastMoveTimestamp: Date.now()
};

function recordFps(fps) {
  metrics.fps = fps;
  metrics.fpsSamples.push(fps);
  if (metrics.fpsSamples.length > 300) metrics.fpsSamples.shift();

  const sorted = [...metrics.fpsSamples].sort((a, b) => a - b);
  metrics.minFps = sorted[0];
  metrics.maxFps = sorted[sorted.length - 1];
  metrics.avgFps = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  metrics.p95Fps = sorted[Math.floor(sorted.length * 0.95)] || metrics.maxFps;
}

// ----------------- WINDOW CREATION -----------------
function createArchA() {
  closeAllWindows();
  mode = 'arch-a';

  const primary = screen.getPrimaryDisplay();
  const wa = primary.workArea;

  currentPos.x = wa.x + 200;
  currentPos.y = wa.y + 200;

  petWindow = new BrowserWindow({
    title: 'SP18-Pet-ArchA',
    width: petSize.width,
    height: petSize.height,
    x: currentPos.x,
    y: currentPos.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  petWindow.loadFile(path.join(__dirname, 'index-a.html'));

  petWindow.once('ready-to-show', () => {
    applyWin32Styles(petWindow);
  });

  // Card Window for Arch A
  cardWindow = new BrowserWindow({
    title: 'SP18-Dialogue-Card-ArchA',
    width: 340,
    height: 180,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  cardWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  cardWindow.loadFile(path.join(__dirname, 'card-a.html'));

  cardWindow.once('ready-to-show', () => {
    applyWin32Styles(cardWindow);
  });

  startMotionLoop();
}

function createArchB() {
  closeAllWindows();
  mode = 'arch-b';

  const primary = screen.getPrimaryDisplay();
  const bounds = primary.bounds;

  overlayWindow = new BrowserWindow({
    title: 'SP18-Pet-ArchB-Overlay',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, 'index-b.html'));

  overlayWindow.once('ready-to-show', () => {
    applyWin32Styles(overlayWindow);
  });

  startMotionLoop();
}

function closeAllWindows() {
  stopMotionLoop();
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.destroy();
    petWindow = null;
  }
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.destroy();
    cardWindow = null;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
    overlayWindow = null;
  }
}

// ----------------- MOTION ENGINE -----------------
function startMotionLoop() {
  stopMotionLoop();
  metrics.fpsSamples = [];

  const targetInterval = 16; // ~60fps
  motionTimer = setInterval(() => {
    stepMotion();
  }, targetInterval);
}

function stopMotionLoop() {
  if (motionTimer) {
    clearInterval(motionTimer);
    motionTimer = null;
  }
}

function stepMotion() {
  metrics.movesCount++;
  const cfg = motionConfig;

  if (cfg.type === 'linear') {
    currentPos.x += cfg.speed * cfg.direction;
    if (cfg.direction > 0 && currentPos.x >= cfg.endX) {
      cfg.direction = -1;
    } else if (cfg.direction < 0 && currentPos.x <= cfg.startX) {
      cfg.direction = 1;
    }
  } else if (cfg.type === 'circle') {
    cfg.angle += (cfg.speed * 0.015);
    currentPos.x = Math.round(cfg.centerX + Math.cos(cfg.angle) * cfg.radius);
    currentPos.y = Math.round(cfg.centerY + Math.sin(cfg.angle) * cfg.radius);
  } else if (cfg.type === 'cross-screen') {
    // Crosses Monitor 1 (0..1280) to Monitor 2 (1920..3840)
    currentPos.x += cfg.speed * cfg.direction;
    if (cfg.direction > 0 && currentPos.x >= 2400) {
      cfg.direction = -1;
    } else if (cfg.direction < 0 && currentPos.x <= 400) {
      cfg.direction = 1;
    }
  }

  // Update position according to mode
  if (mode === 'arch-a') {
    if (petWindow && !petWindow.isDestroyed()) {
      if (SetWindowPos) {
        const hwndBuf = petWindow.getNativeWindowHandle();
        SetWindowPos(hwndBuf, -1, currentPos.x, currentPos.y, petSize.width, petSize.height,
          SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING | SWP_SHOWWINDOW);
      } else {
        petWindow.setBounds({ x: currentPos.x, y: currentPos.y, width: petSize.width, height: petSize.height });
      }

      // If card window is visible, update its position to follow pet
      if (cardVisible && cardWindow && !cardWindow.isDestroyed()) {
        updateCardArchAPosition();
      }
    }
  } else if (mode === 'arch-b') {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('motion-update', { x: currentPos.x, y: currentPos.y });
    }
  }
}

function updateCardArchAPosition() {
  if (!cardWindow || cardWindow.isDestroyed()) return;

  const currentDisplay = screen.getDisplayNearestPoint({ x: currentPos.x, y: currentPos.y });
  const wa = currentDisplay.workArea;

  const cardW = 340;
  const cardH = 180;

  let cx = currentPos.x + petSize.width + 10;
  let cy = currentPos.y;
  let orient = 'right';

  // Adaptive Edge (E1)
  if (cx + cardW > wa.x + wa.width) {
    cx = currentPos.x - cardW - 10;
    orient = 'left';
  }
  if (cy + cardH > wa.y + wa.height) {
    cy = wa.y + wa.height - cardH - 10;
  }
  if (cx < wa.x) {
    cx = wa.x + 10;
  }
  if (cy < wa.y) {
    cy = wa.y + 10;
  }

  cardOrientation = orient;

  if (SetWindowPos) {
    const hwndBuf = cardWindow.getNativeWindowHandle();
    SetWindowPos(hwndBuf, -1, cx, cy, cardW, cardH,
      SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING | SWP_SHOWWINDOW);
  } else {
    cardWindow.setBounds({ x: cx, y: cy, width: cardW, height: cardH });
  }
}

// ----------------- IPC LISTENERS -----------------
ipcMain.on('pet-metrics', (_, data) => {
  if (data && data.fps) recordFps(data.fps);
  if (data && data.locomotion) locomotion = data.locomotion;
});

ipcMain.on('set-mouse-ignore', (_, ignore) => {
  if (mode === 'arch-b' && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('drag-start', (_, pt) => {
  locomotion = 'dragged';
});

ipcMain.on('drag-move', (_, pt) => {
  if (pt.screenX !== undefined && pt.screenY !== undefined) {
    currentPos.x = pt.screenX - 100;
    currentPos.y = pt.screenY - 100;
    if (mode === 'arch-a' && petWindow && !petWindow.isDestroyed()) {
      petWindow.setBounds({ x: currentPos.x, y: currentPos.y, width: petSize.width, height: petSize.height });
    }
  }
});

ipcMain.on('drag-end', (_, pt) => {
  locomotion = 'standing';
});

// ----------------- HTTP CONTROL SERVER -----------------
const HTTP_PORT = 18928;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + HTTP_PORT);

  function sendJson(code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(200, {
      status: 'ok',
      pid: process.pid,
      mode,
      petState,
      locomotion,
      x: currentPos.x,
      y: currentPos.y,
      fps: metrics.fps,
      movesCount: metrics.movesCount
    });
  }

  if (req.method === 'POST' && url.pathname === '/set-mode') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (payload.mode === 'arch-a') {
          createArchA();
        } else if (payload.mode === 'arch-b') {
          createArchB();
        }
        return sendJson(200, { success: true, mode });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/set-motion') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        Object.assign(motionConfig, payload);
        if (payload.x !== undefined) currentPos.x = payload.x;
        if (payload.y !== undefined) currentPos.y = payload.y;
        if (payload.startX !== undefined && payload.type === 'none') {
          currentPos.x = payload.startX;
          if (payload.startY !== undefined) currentPos.y = payload.startY;
        }
        if (payload.type === 'linear' || payload.type === 'circle' || payload.type === 'cross-screen') {
          locomotion = 'walking';
        } else {
          locomotion = 'standing';
        }
        stepMotion();

        // Broadcast to renderer
        const targetWin = mode === 'arch-a' ? petWindow : overlayWindow;
        if (targetWin && !targetWin.isDestroyed()) {
          targetWin.webContents.send('state-change', { locomotion });
        }
        return sendJson(200, { success: true, motionConfig });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/set-state') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (payload.state) {
          petState = payload.state;
          const targetWin = mode === 'arch-a' ? petWindow : overlayWindow;
          if (targetWin && !targetWin.isDestroyed()) {
            targetWin.webContents.send('state-change', { state: petState });
          }
        }
        return sendJson(200, { success: true, petState });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/card/show') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        cardVisible = true;
        if (mode === 'arch-a') {
          if (cardWindow && !cardWindow.isDestroyed()) {
            cardWindow.webContents.send('card-show', payload);
            updateCardArchAPosition();
            cardWindow.showInactive();
          }
        } else if (mode === 'arch-b') {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('card-show', payload);
          }
        }
        return sendJson(200, { success: true, cardVisible, orientation: cardOrientation });
      } catch (err) {
        return sendJson(400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/card/hide') {
    cardVisible = false;
    if (mode === 'arch-a') {
      if (cardWindow && !cardWindow.isDestroyed()) cardWindow.hide();
    } else if (mode === 'arch-b') {
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('card-hide');
    }
    return sendJson(200, { success: true, cardVisible });
  }

  if (req.method === 'GET' && url.pathname === '/metrics') {
    return sendJson(200, {
      mode,
      petState,
      locomotion,
      currentPos,
      cardVisible,
      cardOrientation,
      metrics
    });
  }

  if (req.method === 'GET' && url.pathname === '/window-info') {
    const displays = screen.getAllDisplays().map(d => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor
    }));
    return sendJson(200, {
      mode,
      currentPos,
      petSize,
      displays,
      primaryDisplay: screen.getPrimaryDisplay().id
    });
  }

  if (req.method === 'POST' && url.pathname === '/quit') {
    sendJson(200, { quitting: true });
    setTimeout(() => {
      closeAllWindows();
      app.quit();
    }, 100);
    return;
  }

  sendJson(404, { error: 'Not found' });
});

app.whenReady().then(() => {
  log('app.whenReady reached');
  server.listen(HTTP_PORT, '127.0.0.1', () => {
    log('Control server running at http://127.0.0.1:' + HTTP_PORT);
  });

  const hasModeB = process.argv.includes('--mode=arch-b');
  log('Selected mode: ' + (hasModeB ? 'arch-b' : 'arch-a'));
  if (hasModeB) {
    createArchB();
  } else {
    createArchA();
  }
});

app.on('window-all-closed', () => {
  // Keep server alive
});
