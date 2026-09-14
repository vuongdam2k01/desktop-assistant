const { app, BrowserWindow, screen, ipcMain, Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const http = require('http');

const fs = require('fs');
const logFile = path.join(__dirname, '../../evidence/electron-startup.log');
function log(msg) {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
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

const HTTP_PORT = 18923;

function createWindows() {

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  // 1. Pet Window
  const petWidth = 140;
  const petHeight = 140;
  const initialX = workArea.x + workArea.width - petWidth - 20;
  const initialY = workArea.y + workArea.height - petHeight - 20;

  petWindow = new BrowserWindow({
    title: 'SP7-Pet-Window',
    width: petWidth,
    height: petHeight,
    x: initialX,
    y: initialY,
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
  petWindow.loadFile(path.join(__dirname, 'index.html'));

  // 2. Dialogue Card Window
  const cardWidth = 340;
  const cardHeight = 220;

  cardWindow = new BrowserWindow({
    title: 'SP7-Dialogue-Card',
    width: cardWidth,
    height: cardHeight,
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
  cardWindow.loadFile(path.join(__dirname, 'card.html'));

  // 3. Tray Icon
  try {
    const iconB64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA6SURBVDhPY/wPBAwUACYGKsBAM4D5PyoGA8r/p2EYgDFgYGBg+M9AIqAZgK5+mH5kDAiM0zAMwDg0AADW/yL5tYdD7QAAAABJRU5ErkJggg==';
    let icon = nativeImage.createFromDataURL(iconB64);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'SP-7 Desktop Assistant Pet', enabled: false },
      { type: 'separator' },
      {
        label: 'Ẩn / Hiện Pet',
        click: () => {
          if (petWindow.isVisible()) {
            petWindow.hide();
            if (cardWindow.isVisible()) cardWindow.hide();
          } else {
            petWindow.show();
          }
        }
      },
      { label: 'Chế độ Do Not Disturb (DND)', type: 'checkbox', checked: false },
      { type: 'separator' },
      {
        label: 'Thoát',
        click: () => {
          app.quit();
        }
      }
    ]);
    tray.setToolTip('Desktop Assistant Pet (SP-7)');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (petWindow.isVisible()) {
        petWindow.hide();
        if (cardWindow.isVisible()) cardWindow.hide();
      } else {
        petWindow.show();
      }
    });
    log('Tray icon created successfully');
  } catch (trayErr) {
    log(`Tray creation error: ${trayErr.stack || trayErr}`);
  }

}

// Calculate smart positioning for dialogue card relative to pet
function calculateCardPosition(petBounds, cardWidth = 340, cardHeight = 220) {
  const currentDisplay = screen.getDisplayNearestPoint({ x: petBounds.x, y: petBounds.y });
  const wa = currentDisplay.workArea;

  let cardX, cardY;

  // Horizontal decision: if enough space to the left, open left; else open right
  const spaceRight = (wa.x + wa.width) - (petBounds.x + petBounds.width);
  const spaceLeft = petBounds.x - wa.x;

  if (spaceRight >= cardWidth + 10) {
    cardX = petBounds.x + petBounds.width + 10;
  } else if (spaceLeft >= cardWidth + 10) {
    cardX = petBounds.x - cardWidth - 10;
  } else {
    // If neither fits beside, clamp horizontally
    cardX = Math.max(wa.x + 10, Math.min(petBounds.x, wa.x + wa.width - cardWidth - 10));
  }

  // Vertical decision: if enough space above, align or open above; else open below
  const spaceBottom = (wa.y + wa.height) - (petBounds.y + petBounds.height);
  const spaceTop = petBounds.y - wa.y;

  if (spaceBottom >= cardHeight) {
    cardY = Math.max(wa.y + 10, petBounds.y);
  } else if (spaceTop >= cardHeight) {
    cardY = petBounds.y + petBounds.height - cardHeight;
  } else {
    cardY = Math.max(wa.y + 10, Math.min(petBounds.y, wa.y + wa.height - cardHeight - 10));
  }

  // Final clamp to ensure 100% inside workArea (E1)
  cardX = Math.max(wa.x, Math.min(cardX, wa.x + wa.width - cardWidth));
  cardY = Math.max(wa.y, Math.min(cardY, wa.y + wa.height - cardHeight));

  return { x: Math.round(cardX), y: Math.round(cardY), width: cardWidth, height: cardHeight };
}

// IPC Handlers
ipcMain.on('set-ignore-mouse-events', (event, ignore, forward) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, { forward: forward });
  }
});

ipcMain.on('pet-clicked', () => {
  petClicks++;
  console.log(`[IPC] Pet clicked! Total: ${petClicks}`);
});

ipcMain.on('card-clicked', () => {
  cardClicks++;
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.focus();
  }
  console.log(`[IPC] Card clicked! Total: ${cardClicks}`);
});

// Embedded HTTP Control Server for PowerShell test automation
function startHttpControlServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
    res.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/health') {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', pid: process.pid }));
    }

    if (url.pathname === '/popup-card') {
      const petBounds = petWindow.getBounds();
      const cardPos = calculateCardPosition(petBounds);
      cardWindow.setBounds(cardPos);

      // CRITICAL: showInactive() shows the window without stealing focus (FR-INT-04)
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
      cardWindow.hide();
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
        cardClicks
      }));
    }

    if (url.pathname === '/move-pet') {
      const x = parseInt(url.searchParams.get('x'));
      const y = parseInt(url.searchParams.get('y'));
      petWindow.setPosition(x, y);
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', petBounds: petWindow.getBounds() }));
    }

    if (url.pathname === '/displays') {
      res.writeHead(200);
      return res.end(JSON.stringify({
        displays: screen.getAllDisplays(),
        primary: screen.getPrimaryDisplay()
      }));
    }

    if (url.pathname === '/test-corner') {
      const corner = url.searchParams.get('corner') || 'bottom-right';
      const primaryDisplay = screen.getPrimaryDisplay();
      const wa = primaryDisplay.workArea;
      const petW = 140;
      const petH = 140;

      let targetX, targetY;
      switch (corner) {
        case 'top-left':
          targetX = wa.x;
          targetY = wa.y;
          break;
        case 'top-right':
          targetX = wa.x + wa.width - petW;
          targetY = wa.y;
          break;
        case 'bottom-left':
          targetX = wa.x;
          targetY = wa.y + wa.height - petH;
          break;
        case 'bottom-right':
        default:
          targetX = wa.x + wa.width - petW;
          targetY = wa.y + wa.height - petH;
          break;
      }

      petWindow.setPosition(targetX, targetY);
      const petBounds = petWindow.getBounds();
      const cardPos = calculateCardPosition(petBounds);
      cardWindow.setBounds(cardPos);
      cardWindow.showInactive();
      cardWindow.setAlwaysOnTop(true, 'screen-saver', 1);

      res.writeHead(200);
      return res.end(JSON.stringify({
        corner,
        workArea: wa,
        petBounds,
        cardBounds: cardWindow.getBounds()
      }));
    }

    if (url.pathname === '/test-fullscreen') {
      const action = url.searchParams.get('action') || 'show';
      if (action === 'show') {
        if (!fullscreenWindow || fullscreenWindow.isDestroyed()) {
          fullscreenWindow = new BrowserWindow({
            fullscreen: true,
            frame: false,
            alwaysOnTop: false,
            webPreferences: { nodeIntegration: false, contextIsolation: true }
          });
          fullscreenWindow.loadFile(path.join(__dirname, 'fullscreen.html'));
        } else {
          fullscreenWindow.show();
        }
        fullscreenWindow.focus();
        res.writeHead(200);
        return res.end(JSON.stringify({ status: 'ok', fullscreen: true }));
      } else {
        if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
          fullscreenWindow.close();
          fullscreenWindow = null;
        }
        res.writeHead(200);
        return res.end(JSON.stringify({ status: 'ok', fullscreen: false }));
      }
    }

    if (url.pathname === '/test-tray-notification') {
      // FR-INT-14 / E3: When pet is hidden, blocking card pushes OS notification
      petWindow.hide();
      cardWindow.hide();

      const notif = new Notification({
        title: 'Desktop Assistant — Phê duyệt (FR-INT-14)',
        body: 'Agent yêu cầu xóa 5 task Notion trong database Tasks (Click để mở lại pet)',
        icon: path.join(__dirname, 'icon.png')
      });

      notif.on('click', () => {
        petWindow.show();
        const pos = calculateCardPosition(petWindow.getBounds());
        cardWindow.setBounds(pos);
        cardWindow.show();
        cardWindow.focus();
      });

      notif.show();

      res.writeHead(200);
      return res.end(JSON.stringify({
        status: 'ok',
        petVisible: petWindow.isVisible(),
        notified: true
      }));
    }

    if (url.pathname === '/restore-pet') {
      petWindow.show();
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', petVisible: petWindow.isVisible() }));
    }

    if (url.pathname === '/reset-clicks') {
      petClicks = 0;
      cardClicks = 0;
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'ok', petClicks, cardClicks }));
    }

    if (url.pathname === '/clicks') {
      res.writeHead(200);
      return res.end(JSON.stringify({ petClicks, cardClicks }));
    }

    if (url.pathname === '/quit') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'quitting' }));
      setTimeout(() => {
        app.quit();
      }, 500);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(HTTP_PORT, '127.0.0.1', () => {
    log(`SP-7 HTTP Control Server listening on http://127.0.0.1:${HTTP_PORT}`);
    console.log(`SP-7 HTTP Control Server listening on http://127.0.0.1:${HTTP_PORT}`);
  });
}

app.whenReady().then(() => {
  log('app.whenReady reached');
  try {
    createWindows();
    log('createWindows finished');
    startHttpControlServer();
    log('startHttpControlServer finished');
  } catch (err) {
    log(`Error in whenReady: ${err.stack || err}`);
  }
});

app.on('window-all-closed', () => {
  log('window-all-closed fired');
  // Keep alive in background until explicitly quit
});

