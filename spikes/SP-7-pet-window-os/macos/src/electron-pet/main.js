const { app, BrowserWindow, screen, ipcMain, Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const logFile = path.join(__dirname, '../../evidence/electron-startup.log');
function log(msg) {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(`[LOG] ${msg}`);
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED REJECTION: ${reason}`);
});

let petWindow = null;
let cardWindow = null;
let fullscreenWindow = null;
let tray = null;
let petClicks = 0;
let cardClicks = 0;
let currentMode = 'panel'; // 'normal' | 'panel' | 'nonfocusable'
let dockHidden = false;

const HTTP_PORT = 18923;

function createWindows(options = {}) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  // 1. Pet Window
  const petWidth = 140;
  const petHeight = 140;
  const initialX = workArea.x + workArea.width - petWidth - 20;
  const initialY = workArea.y + workArea.height - petHeight - 20;

  petWindow = new BrowserWindow({
    title: 'SP7-Pet-Window-macOS',
    width: petWidth,
    height: petHeight,
    x: initialX,
    y: initialY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    type: 'panel',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadFile(path.join(__dirname, 'index.html'));

  createCardWindow(options);
  createTray();
}

function createCardWindow(options = {}) {
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.destroy();
  }

  const cardWidth = 340;
  const cardHeight = 220;
  const mode = options.mode || currentMode;
  const focusable = options.focusable !== undefined ? options.focusable : (mode !== 'nonfocusable');
  const winType = (mode === 'panel') ? 'panel' : 'normal';

  log(`Creating CardWindow: mode=${mode}, type=${winType}, focusable=${focusable}`);

  cardWindow = new BrowserWindow({
    title: 'SP7-Dialogue-Card-macOS',
    width: cardWidth,
    height: cardHeight,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    focusable: focusable,
    type: winType,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  cardWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  cardWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  cardWindow.loadFile(path.join(__dirname, 'card.html'));
}

function createTray() {
  if (tray) return;
  try {
    const iconB64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA6SURBVDhPY/wPBAwUACYGKsBAM4D5PyoGA8r/p2EYgDFgYGBg+M9AIqAZgK5+mH5kDAiM0zAMwDg0AADW/yL5tYdD7QAAAABJRU5ErkJggg==';
    let icon = nativeImage.createFromDataURL(iconB64);
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'SP-7 Desktop Assistant Pet (macOS)', enabled: false },
      { type: 'separator' },
      {
        label: 'Ẩn / Hiện Pet',
        click: () => {
          if (petWindow.isVisible()) {
            petWindow.hide();
            if (cardWindow && cardWindow.isVisible()) cardWindow.hide();
          } else {
            petWindow.showInactive();
          }
        }
      },
      {
        label: 'Gửi thông báo test (Q6)',
        click: () => {
          triggerNotification('Desktop Assistant Pet', 'Pet đang ẩn ở menu bar. Bấm để khôi phục.');
        }
      },
      { type: 'separator' },
      {
        label: 'Thoát',
        click: () => {
          app.quit();
        }
      }
    ]);
    tray.setToolTip('Desktop Assistant Pet (macOS)');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (petWindow.isVisible()) {
        petWindow.hide();
        if (cardWindow && cardWindow.isVisible()) cardWindow.hide();
      } else {
        petWindow.showInactive();
      }
    });
    log('Tray icon created successfully on macOS menu bar');
  } catch (err) {
    log(`Tray creation error: ${err.stack || err}`);
  }
}

function triggerNotification(title, body) {
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: title || 'Desktop Assistant',
      body: body || 'Notification from SP-7 Pet Window macOS',
      silent: false
    });
    notif.on('click', () => {
      log('Notification clicked by user');
      if (petWindow && !petWindow.isVisible()) {
        petWindow.showInactive();
      }
    });
    notif.show();
    log(`Notification displayed: "${title}" - "${body}"`);
    return true;
  } else {
    log('Notification not supported on this environment');
    return false;
  }
}

function calculateCardPosition(petBounds, cardWidth = 340, cardHeight = 220) {
  const currentDisplay = screen.getDisplayNearestPoint({ x: petBounds.x, y: petBounds.y });
  const wa = currentDisplay.workArea;

  let cardX, cardY;
  const spaceRight = (wa.x + wa.width) - (petBounds.x + petBounds.width);
  const spaceLeft = petBounds.x - wa.x;

  if (spaceRight >= cardWidth + 10) {
    cardX = petBounds.x + petBounds.width + 10;
  } else if (spaceLeft >= cardWidth + 10) {
    cardX = petBounds.x - cardWidth - 10;
  } else {
    cardX = Math.max(wa.x + 10, Math.min(petBounds.x, wa.x + wa.width - cardWidth - 10));
  }

  const spaceBottom = (wa.y + wa.height) - (petBounds.y + petBounds.height);
  const spaceTop = petBounds.y - wa.y;

  if (spaceBottom >= cardHeight) {
    cardY = Math.max(wa.y + 10, petBounds.y);
  } else if (spaceTop >= cardHeight) {
    cardY = petBounds.y + petBounds.height - cardHeight;
  } else {
    cardY = Math.max(wa.y + 10, Math.min(petBounds.y, wa.y + wa.height - cardHeight - 10));
  }

  cardX = Math.max(wa.x, Math.min(cardX, wa.x + wa.width - cardWidth));
  cardY = Math.max(wa.y, Math.min(cardY, wa.y + wa.height - cardHeight));

  return { x: Math.round(cardX), y: Math.round(cardY), width: cardWidth, height: cardHeight };
}

// IPC Handlers
ipcMain.on('set-ignore-mouse-events', (event, ignore, forward) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, { forward: !!forward });
  }
});

ipcMain.on('pet-clicked', () => {
  petClicks++;
  log(`[IPC] Pet clicked! Total: ${petClicks}`);
});

ipcMain.on('card-clicked', () => {
  cardClicks++;
  log(`[IPC] Card clicked! Total: ${cardClicks}`);
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.focus();
  }
});

// Embedded HTTP Control Server
function startHttpControlServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
    res.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/health') {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', pid: process.pid, platform: process.platform }));
    }

    if (url.pathname === '/popup-card') {
      const petBounds = petWindow.getBounds();
      const cardPos = calculateCardPosition(petBounds);
      cardWindow.setBounds(cardPos);

      cardWindow.showInactive();
      cardWindow.setAlwaysOnTop(true, 'screen-saver', 1);

      res.writeHead(200);
      return res.end(JSON.stringify({
        status: 'ok',
        cardVisible: cardWindow.isVisible(),
        cardFocused: cardWindow.isFocused(),
        petFocused: petWindow.isFocused(),
        cardBounds: cardWindow.getBounds()
      }));
    }

    if (url.pathname === '/hide-card') {
      if (cardWindow && !cardWindow.isDestroyed()) {
        cardWindow.hide();
      }
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', cardVisible: cardWindow.isVisible() }));
    }

    if (url.pathname === '/status') {
      res.writeHead(200);
      return res.end(JSON.stringify({
        petVisible: petWindow ? petWindow.isVisible() : false,
        petFocused: petWindow ? petWindow.isFocused() : false,
        petBounds: petWindow ? petWindow.getBounds() : null,
        cardVisible: cardWindow ? cardWindow.isVisible() : false,
        cardFocused: cardWindow ? cardWindow.isFocused() : false,
        cardBounds: cardWindow ? cardWindow.getBounds() : null,
        petClicks,
        cardClicks,
        currentMode,
        dockHidden
      }));
    }

    if (url.pathname === '/move-pet') {
      const x = parseInt(url.searchParams.get('x'));
      const y = parseInt(url.searchParams.get('y'));
      petWindow.setPosition(x, y);
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', petBounds: petWindow.getBounds() }));
    }

    if (url.pathname === '/set-mode') {
      const mode = url.searchParams.get('mode') || 'panel';
      const dock = url.searchParams.get('dock');
      currentMode = mode;
      if (dock === 'hide') {
        app.dock.hide();
        dockHidden = true;
      } else if (dock === 'show') {
        app.dock.show();
        dockHidden = false;
      }
      createCardWindow({ mode });
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', currentMode, dockHidden }));
    }

    if (url.pathname === '/workarea') {
      const primaryDisplay = screen.getPrimaryDisplay();
      const allDisplays = screen.getAllDisplays();
      res.writeHead(200);
      return res.end(JSON.stringify({
        primary: {
          id: primaryDisplay.id,
          bounds: primaryDisplay.bounds,
          workArea: primaryDisplay.workArea,
          scaleFactor: primaryDisplay.scaleFactor
        },
        allDisplays: allDisplays.map(d => ({
          id: d.id,
          bounds: d.bounds,
          workArea: d.workArea,
          scaleFactor: d.scaleFactor
        }))
      }));
    }

    if (url.pathname === '/corners') {
      const display = screen.getPrimaryDisplay();
      const wa = display.workArea;
      const petW = 140, petH = 140;
      const cardW = 340, cardH = 220;

      const corners = [
        { name: 'top-left', x: wa.x, y: wa.y },
        { name: 'top-right', x: wa.x + wa.width - petW, y: wa.y },
        { name: 'bottom-left', x: wa.x, y: wa.y + wa.height - petH },
        { name: 'bottom-right', x: wa.x + wa.width - petW, y: wa.y + wa.height - petH }
      ];

      const results = corners.map(c => {
        petWindow.setPosition(c.x, c.y);
        const cardPos = calculateCardPosition({ x: c.x, y: c.y, width: petW, height: petH }, cardW, cardH);
        const inside = (
          cardPos.x >= wa.x &&
          cardPos.y >= wa.y &&
          (cardPos.x + cardPos.width) <= (wa.x + wa.width) &&
          (cardPos.y + cardPos.height) <= (wa.y + wa.height)
        );
        return {
          corner: c.name,
          pet: { x: c.x, y: c.y, w: petW, h: petH },
          card: cardPos,
          insideWorkArea: inside
        };
      });

      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', workArea: wa, corners: results }));
    }

    if (url.pathname === '/notify') {
      const title = url.searchParams.get('title') || 'Desktop Assistant';
      const body = url.searchParams.get('body') || 'Thông báo thử nghiệm (Q6)';
      const success = triggerNotification(title, body);
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', sent: success }));
    }

    if (url.pathname === '/reset-clicks') {
      petClicks = 0;
      cardClicks = 0;
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', petClicks, cardClicks }));
    }

    if (url.pathname === '/open-fullscreen-test') {
      const mode = url.searchParams.get('mode') || 'simple'; // 'simple' or 'native'
      if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
        fullscreenWindow.destroy();
      }
      
      const primaryDisplay = screen.getPrimaryDisplay();
      const bounds = primaryDisplay.bounds;

      fullscreenWindow = new BrowserWindow({
        title: 'FULLSCREEN TEST APP (macOS)',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        frame: false,
        backgroundColor: '#0f172a',
        webPreferences: { nodeIntegration: false }
      });
      
      fullscreenWindow.loadFile(path.join(__dirname, 'fullscreen.html'));
      if (mode === 'native') {
        fullscreenWindow.setFullScreen(true);
      } else {
        fullscreenWindow.setSimpleFullScreen(true);
      }
      fullscreenWindow.show();

      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', mode, fullscreen: true }));
    }

    if (url.pathname === '/close-fullscreen-test') {
      if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
        fullscreenWindow.destroy();
        fullscreenWindow = null;
      }
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', fullscreen: false }));
    }

    if (url.pathname === '/quit') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok' }));
      setTimeout(() => app.quit(), 300);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(HTTP_PORT, '127.0.0.1', () => {
    log(`HTTP Control Server listening on http://127.0.0.1:${HTTP_PORT}`);
  });
}

app.whenReady().then(() => {
  log(`App ready on macOS. Electron: ${process.versions.electron}, Node: ${process.versions.node}, arch: ${process.arch}`);
  createWindows();
  startHttpControlServer();
});

app.on('window-all-closed', () => {
  // Stay running as tray/pet companion
});
