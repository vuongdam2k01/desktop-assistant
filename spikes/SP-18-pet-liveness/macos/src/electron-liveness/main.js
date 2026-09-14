const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.PET_PORT || '3838', 10);
const logFile = path.join(__dirname, '../../evidence/liveness-electron.log');

function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch(e) {}
  console.log(msg);
}

let mode = 'arch-a'; // 'arch-a' or 'arch-b'
let petWindow = null;
let cardWindow = null;
let overlayWindow = null;

let currentPos = { x: 300, y: 300 };
const petSize = { width: 200, height: 200 };
const cardSize = { width: 340, height: 180 };

let cardVisible = false;
let cardOrientation = 'right';

let motionConfig = {
  type: 'idle', // 'idle' | 'linear' | 'circle' | 'cross-screen'
  speed: 4,
  startX: 100,
  startY: 300,
  endX: 1000,
  endY: 300,
  direction: 1,
  angle: 0,
  centerX: 500,
  centerY: 400,
  radius: 200
};

let motionTimer = null;

let metrics = {
  fps: 60,
  avgFps: 60,
  minFps: 60,
  maxFps: 60,
  p95Fps: 60,
  fpsSamples: [],
  frameCount: 0,
  movesCount: 0,
  droppedFrames: 0,
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

// ----------------- ARCH A WINDOWS -----------------
function createArchA() {
  closeAllWindows();
  mode = 'arch-a';

  const primary = screen.getPrimaryDisplay();
  const wa = primary.workArea;

  currentPos.x = wa.x + 300;
  currentPos.y = wa.y + 300;

  // Pet Window
  petWindow = new BrowserWindow({
    title: 'SP18-Pet-ArchA',
    width: petSize.width,
    height: petSize.height,
    x: currentPos.x,
    y: currentPos.y,
    type: 'panel',
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
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.loadFile(path.join(__dirname, 'index-a.html'));

  // Dialogue Card Window
  cardWindow = new BrowserWindow({
    title: 'SP18-Card-ArchA',
    width: cardSize.width,
    height: cardSize.height,
    show: false,
    type: 'panel',
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
  cardWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  cardWindow.loadFile(path.join(__dirname, 'card-a.html'));

  startMotionLoop();
  log(`Created Architecture A windows successfully at (${currentPos.x}, ${currentPos.y})`);
}

// ----------------- ARCH B WINDOW (OVERLAY) -----------------
function createArchB() {
  closeAllWindows();
  mode = 'arch-b';

  const primary = screen.getPrimaryDisplay();
  const bounds = primary.bounds;

  overlayWindow = new BrowserWindow({
    title: 'SP18-Overlay-ArchB',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    type: 'panel',
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
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(path.join(__dirname, 'index-b.html'));

  startMotionLoop();
  log(`Created Architecture B fullscreen overlay successfully (${bounds.width}x${bounds.height})`);
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

// ----------------- MOTION LOOP -----------------
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
    currentPos.x += cfg.speed * cfg.direction;
    if (cfg.direction > 0 && currentPos.x >= 1800) {
      cfg.direction = -1;
    } else if (cfg.direction < 0 && currentPos.x <= 50) {
      cfg.direction = 1;
    }
  }

  // Clamping within workArea
  clampToScreen();

  if (mode === 'arch-a') {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.setPosition(Math.round(currentPos.x), Math.round(currentPos.y));
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

function clampToScreen() {
  const currentDisplay = screen.getDisplayNearestPoint({ x: currentPos.x, y: currentPos.y });
  const wa = currentDisplay.workArea;

  if (currentPos.x < wa.x) currentPos.x = wa.x;
  if (currentPos.y < wa.y) currentPos.y = wa.y;
  if (currentPos.x + petSize.width > wa.x + wa.width) {
    currentPos.x = wa.x + wa.width - petSize.width;
  }
  if (currentPos.y + petSize.height > wa.y + wa.height) {
    currentPos.y = wa.y + wa.height - petSize.height;
  }
}

function updateCardArchAPosition() {
  if (!cardWindow || cardWindow.isDestroyed()) return;

  const currentDisplay = screen.getDisplayNearestPoint({ x: currentPos.x, y: currentPos.y });
  const wa = currentDisplay.workArea;

  let cx = currentPos.x + petSize.width + 10;
  let cy = currentPos.y;
  let orient = 'right';

  // Adaptive Edge Flip (E1)
  if (cx + cardSize.width > wa.x + wa.width) {
    cx = currentPos.x - cardSize.width - 10;
    orient = 'left';
  }
  if (cy + cardSize.height > wa.y + wa.height) {
    cy = wa.y + wa.height - cardSize.height - 10;
  }
  if (cx < wa.x) cx = wa.x + 10;
  if (cy < wa.y) cy = wa.y + 10;

  cardOrientation = orient;
  cardWindow.setPosition(Math.round(cx), Math.round(cy));
  cardWindow.webContents.send('card-update', { orientation: orient });
}

// ----------------- IPC -----------------
ipcMain.on('pet-metrics', (_, data) => {
  if (data && data.fps) recordFps(data.fps);
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('pet-clicked', () => {
  log('Pet clicked by user');
  cardVisible = !cardVisible;
  if (mode === 'arch-a') {
    if (cardWindow && !cardWindow.isDestroyed()) {
      if (cardVisible) {
        updateCardArchAPosition();
        cardWindow.showInactive();
      } else {
        cardWindow.hide();
      }
    }
  }
});

ipcMain.on('card-dismiss', () => {
  log('Card dismissed by Esc / click outside');
  cardVisible = false;
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.hide();
  }
});

// ----------------- HTTP CONTROL SERVER -----------------
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;
  const q = Object.fromEntries(parsedUrl.searchParams.entries());

  res.setHeader('Content-Type', 'application/json');

  if (pathname === '/ping') {
    return res.end(JSON.stringify({ status: 'ok', mode, pid: process.pid }));
  }

  if (pathname === '/mode') {
    const target = q.arch || 'a';
    if (target === 'b' || target === 'arch-b') {
      createArchB();
    } else {
      createArchA();
    }
    return res.end(JSON.stringify({ status: 'ok', mode }));
  }

  if (pathname === '/motion') {
    if (q.type) motionConfig.type = q.type;
    if (q.speed) motionConfig.speed = parseFloat(q.speed);
    if (q.startX) motionConfig.startX = parseInt(q.startX);
    if (q.endX) motionConfig.endX = parseInt(q.endX);
    log(`Motion updated: ${JSON.stringify(motionConfig)}`);
    return res.end(JSON.stringify({ status: 'ok', motionConfig }));
  }

  if (pathname === '/metrics') {
    const mem = process.memoryUsage();
    return res.end(JSON.stringify({
      mode,
      metrics,
      position: currentPos,
      cardVisible,
      cardOrientation,
      memory: {
        rss_mb: (mem.rss / (1024 * 1024)).toFixed(2),
        heap_used_mb: (mem.heapUsed / (1024 * 1024)).toFixed(2),
        external_mb: (mem.external / (1024 * 1024)).toFixed(2)
      }
    }));
  }

  if (pathname === '/card') {
    const action = q.action || 'toggle';
    if (action === 'show') cardVisible = true;
    else if (action === 'hide') cardVisible = false;
    else cardVisible = !cardVisible;

    if (mode === 'arch-a' && cardWindow && !cardWindow.isDestroyed()) {
      if (cardVisible) {
        updateCardArchAPosition();
        cardWindow.showInactive();
      } else {
        cardWindow.hide();
      }
    }
    return res.end(JSON.stringify({ status: 'ok', cardVisible, cardOrientation }));
  }

  if (pathname === '/state') {
    const status = parseInt(q.status || '0');
    const loco = q.locomotion || 'standing';
    if (mode === 'arch-a' && petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send('state-update', { workStatus: status, locomotion: loco });
    } else if (mode === 'arch-b' && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('state-update', { workStatus: status, locomotion: loco });
    }
    return res.end(JSON.stringify({ status: 'ok', workStatus: status, locomotion: loco }));
  }

  if (pathname === '/evade') {
    const tx = parseFloat(q.x || currentPos.x);
    const ty = parseFloat(q.y || currentPos.y);
    const buf = parseFloat(q.buffer || 150);

    const dx = currentPos.x + 100 - tx;
    const dy = currentPos.y + 100 - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let evaded = false;
    if (dist < buf) {
      evaded = true;
      const moveDist = buf - dist + 40;
      const angle = Math.atan2(dy, dx);
      currentPos.x += Math.cos(angle) * moveDist;
      currentPos.y += Math.sin(angle) * moveDist;
      clampToScreen();
      stepMotion();
    }
    return res.end(JSON.stringify({ evaded, distance: dist, newPos: currentPos }));
  }

  if (pathname === '/restore_focus') {
    const targetPid = parseInt(q.pid || '0');
    let output = '';
    try {
      const helperPath = path.join(__dirname, '../bin/liveness_helper');
      output = execSync(`${helperPath} restore_focus ${targetPid}`).toString();
    } catch(e) {
      output = JSON.stringify({ error: e.message });
    }
    return res.end(output);
  }

  if (pathname === '/quit') {
    res.end(JSON.stringify({ status: 'quitting' }));
    setTimeout(() => {
      app.quit();
    }, 100);
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not_found' }));
});

app.whenReady().then(() => {
  log('App ready. Starting HTTP server on port ' + PORT);
  server.listen(PORT, '127.0.0.1', () => {
    log(`HTTP server listening on http://127.0.0.1:${PORT}`);
    createArchA();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
