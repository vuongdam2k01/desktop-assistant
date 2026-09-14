// main.js - SP-16/mac Code Signing & Auto-Update Spike
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Đường dẫn file log bằng chứng macOS
const evidenceDir = path.resolve(__dirname, '../../evidence');
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}
const logPath = path.join(evidenceDir, 'updater-app.log');

function log(msg) {
  const time = new Date().toISOString();
  const ver = app.getVersion();
  const pid = process.pid;
  const line = `[${time}] [PID:${pid}] [v${ver}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(logPath, line + '\n');
  } catch (e) {
    console.error('Lỗi ghi log:', e);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-log', line);
  }
}

let mainWindow = null;
let activeJob = null; // Kiểm chứng Q6 (FR-APP-06 Job Conflict)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 680,
    height: 540,
    title: `Desktop Assistant macOS Spike - v${app.getVersion()}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    log(`Cửa sổ hiển thị hoàn tất. Phiên bản: ${app.getVersion()}`);
    mainWindow.webContents.send('version-info', {
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      execPath: process.execPath,
      pid: process.pid
    });

    // Tự động kiểm tra cập nhật sau 2 giây nếu app đã đóng gói
    setTimeout(() => {
      log('Kích hoạt kiểm tra cập nhật tự động...');
      checkForUpdates();
    }, 2000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  // Cấu hình feed URL trỏ vào HTTP server cục bộ
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'http://127.0.0.1:8089/updates'
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false; // Kiểm soát chủ động theo FR-APP-06

  autoUpdater.on('checking-for-update', () => {
    log('Đang kiểm tra bản cập nhật từ http://127.0.0.1:8089/updates/latest-mac.yml ...');
  });

  autoUpdater.on('update-available', (info) => {
    log(`Phát hiện bản mới khả dụng: v${info.version} (ngày phát hành: ${info.releaseDate})`);
  });

  autoUpdater.on('update-not-available', (info) => {
    log(`Không có bản mới. Bản hiện tại v${app.getVersion()} là mới nhất.`);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const p = Math.round(progressObj.percent);
    const speed = Math.round(progressObj.bytesPerSecond / 1024);
    log(`Tiến trình tải: ${p}% (${speed} KB/s)`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-progress', p);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log(`Tải thành công bản cập nhật v${info.version}!`);
    log(`File installer: ${info.downloadedFile || 'zip bundle'}`);

    // Kiểm tra xung đột với job đang chạy (Q6 / FR-APP-06)
    if (activeJob) {
      log(`CẢNH BÁO: Đang có job '${activeJob.name}' chạy. Chưa khởi động lại ngay (FR-APP-06).`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-ready-job-conflict', {
          version: info.version,
          job: activeJob
        });
      }
    } else {
      log('Không có job đang chạy. Tiến hành quitAndInstall() sau 2.0s...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ready-to-restart', info.version);
      }
      setTimeout(() => {
        log('Thực thi autoUpdater.quitAndInstall(true, true)...');
        autoUpdater.quitAndInstall(true, true);
      }, 2000);
    }
  });

  autoUpdater.on('error', (err) => {
    const errMsg = err == null ? 'unknown' : (err.stack || err).toString();
    log(`LỖI AUTO-UPDATER: ${errMsg}`);
  });
}

function checkForUpdates() {
  if (!app.isPackaged) {
    log('CẢNH BÁO: App đang chạy ở chế độ unpacked/dev. autoUpdater trên macOS yêu cầu app đã đóng gói và ký mã để xác thực qua Squirrel.Mac.');
  }
  autoUpdater.checkForUpdates().catch(err => {
    log(`Lỗi khi gọi checkForUpdates: ${err.message}`);
  });
}

// IPC Handlers
ipcMain.on('check-update-manual', () => {
  log('Người dùng bấm nút kiểm tra cập nhật thủ công.');
  checkForUpdates();
});

ipcMain.on('start-job', (event, jobName) => {
  activeJob = { name: jobName, startedAt: new Date().toISOString() };
  log(`Bắt đầu job mô phỏng: ${jobName}`);
});

ipcMain.on('stop-job', () => {
  log(`Kết thúc job mô phỏng: ${activeJob ? activeJob.name : 'none'}`);
  activeJob = null;
});

ipcMain.on('confirm-restart', () => {
  log('Người dùng xác nhận khởi động lại để cập nhật.');
  activeJob = null;
  autoUpdater.quitAndInstall(true, true);
});

// Khởi chạy ứng dụng
app.whenReady().then(() => {
  log(`=== ỨNG DỤNG KHỞI ĐỘNG (macOS) ===`);
  log(`Phiên bản: ${app.getVersion()}`);
  log(`PID: ${process.pid}`);
  log(`ExecPath: ${process.execPath}`);
  log(`isPackaged: ${app.isPackaged}`);

  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
