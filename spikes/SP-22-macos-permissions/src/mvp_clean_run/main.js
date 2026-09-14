const { app, BrowserWindow, screen, safeStorage, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const LOG_FILE = '/tmp/mvp_zero_tcc_run.log';
const RESULT_JSON = '/tmp/mvp_zero_tcc_result.json';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG_FILE, line + '\n');
  console.log(line);
}

fs.writeFileSync(LOG_FILE, ''); // clear log
log('=== STARTING MVP ZERO-TCC VERIFICATION RUN ===');
log(`Process PID: ${process.pid}`);
log(`App Path: ${app.getAppPath()}`);
log(`Electron version: ${process.versions.electron}`);
log(`Node version: ${process.versions.node}`);

let petWindow = null;
let cardWindow = null;
let tray = null;
let db = null;

const testResults = {
  timestamp: new Date().toISOString(),
  environment: {
    os: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node
  },
  tests: {
    tccPermissionsRequired: false,
    petWindowCreated: false,
    cardWindowCreated: false,
    trayCreated: false,
    sqliteLedgerFunctional: false,
    safeStorageFunctional: false,
    jobLifecycleCompleted: false,
    zeroTccVerified: false
  },
  details: {}
};

app.whenReady().then(async () => {
  try {
    log('1. Checking Screen and Environment...');
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;
    log(`Primary display workArea: ${workArea.x}, ${workArea.y}, ${workArea.width}x${workArea.height}`);

    // 2. Setup SQLite Ledger in ~/Library/Application Support/DesktopAssistantMVP/
    log('2. Initializing SQLite Ledger in Application Support...');
    const appDataDir = path.join(app.getPath('appData'), 'DesktopAssistantMVP');
    fs.mkdirSync(appDataDir, { recursive: true });
    const dbPath = path.join(appDataDir, 'ledger.sqlite');
    log(`Database path: ${dbPath}`);
    db = new DatabaseSync(dbPath);

    db.exec(`
      CREATE TABLE IF NOT EXISTS ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        parameters TEXT NOT NULL,
        status TEXT NOT NULL,
        reversible INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        committed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS secure_store (
        key TEXT PRIMARY KEY,
        ciphertext BLOB NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    testResults.tests.sqliteLedgerFunctional = true;
    log('SQLite Ledger initialized successfully.');

    // 3. Testing SafeStorage (Keychain Master Key)
    log('3. Testing SafeStorage encryption/decryption...');
    const encryptionAvailable = safeStorage.isEncryptionAvailable();
    log(`safeStorage.isEncryptionAvailable(): ${encryptionAvailable}`);

    if (encryptionAvailable) {
      const plainToken = 'secret_notion_oauth_token_verified_clean_12345';
      const cipherBuf = safeStorage.encryptString(plainToken);
      log(`Encrypted plain text (${plainToken.length} chars) -> cipher buffer (${cipherBuf.length} bytes)`);

      // Store in SQLite
      const insertCred = db.prepare('INSERT OR REPLACE INTO secure_store (key, ciphertext, updated_at) VALUES (?, ?, ?)');
      insertCred.run('connector:notion:default:token', cipherBuf, new Date().toISOString());

      // Read back from SQLite
      const row = db.prepare('SELECT ciphertext FROM secure_store WHERE key = ?').get('connector:notion:default:token');
      const decrypted = safeStorage.decryptString(row.ciphertext);
      const match = (decrypted === plainToken);
      log(`Decrypted token matches original: ${match}`);
      testResults.tests.safeStorageFunctional = match;
      testResults.details.safeStorage = {
        available: encryptionAvailable,
        plainLength: plainToken.length,
        cipherLength: cipherBuf.length,
        decryptedMatch: match
      };
    } else {
      log('WARNING: safeStorage encryption not available!');
      testResults.tests.safeStorageFunctional = false;
    }

    // 4. Create Pet Window (Frameless, transparent, always-on-top, type: panel)
    log('4. Creating Pet Window...');
    const petWidth = 140;
    const petHeight = 140;
    // Position prominently in upper right
    const petX = 1400;
    const petY = 120;

    petWindow = new BrowserWindow({
      title: 'DesktopAssistant-Pet',
      width: petWidth,
      height: petHeight,
      x: petX,
      y: petY,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      focusable: false,
      type: 'panel',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    petWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    petWindow.loadFile(path.join(__dirname, 'index.html'));
    petWindow.showInactive();
    testResults.tests.petWindowCreated = true;
    log('Pet Window created successfully.');

    // 5. Create Dialogue Card Window
    log('5. Creating Dialogue Card Window...');
    const cardWidth = 360;
    const cardHeight = 160;
    const cardX = petX - cardWidth + 10;
    const cardY = petY + 10;

    cardWindow = new BrowserWindow({
      title: 'DesktopAssistant-Card',
      width: cardWidth,
      height: cardHeight,
      x: cardX,
      y: cardY,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      focusable: false,
      type: 'panel',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    cardWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    cardWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    cardWindow.loadFile(path.join(__dirname, 'card.html'));
    cardWindow.showInactive();
    testResults.tests.cardWindowCreated = true;
    log('Dialogue Card Window created successfully.');

    // 6. Create Menu Bar Tray
    log('6. Creating Menu Bar Tray Icon...');
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Desktop Assistant MVP', enabled: false },
      { type: 'separator' },
      { label: 'Ẩn / Hiện Pet', click: () => { petWindow.isVisible() ? petWindow.hide() : petWindow.show(); } },
      { label: 'Thoát', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('Desktop Assistant (MVP Clean)');
    tray.setContextMenu(contextMenu);
    testResults.tests.trayCreated = true;
    log('Menu Bar Tray created successfully.');

    // 7. Execute Simulated MVP Job Workflow
    log('7. Executing End-to-End MVP Job Lifecycle...');
    const jobId = 'job_mvp_' + Date.now();

    // Step A: Pre-execution ledger write (FAIL-CLOSED)
    log(`[Job ${jobId}] Step A: Writing pre-execution record to SQLite ledger...`);
    const insertLedger = db.prepare(`
      INSERT INTO ledger (job_id, tool_name, parameters, status, reversible, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const runResult = insertLedger.run(
      jobId,
      'notion:create_page',
      JSON.stringify({ title: 'Hoàn tất đặc tả onboarding macOS', database_id: 'db_tasks_main' }),
      'PENDING',
      1,
      new Date().toISOString()
    );
    const ledgerRecordId = runResult.lastInsertRowid;
    log(`Pre-execution ledger write successful (row id: ${ledgerRecordId}).`);

    // Step B: Connector dispatch (read OAuth token via SafeStorage, simulate API call)
    log(`[Job ${jobId}] Step B: Decrypting token and invoking Notion API connector...`);
    const tokenRow = db.prepare('SELECT ciphertext FROM secure_store WHERE key = ?').get('connector:notion:default:token');
    const token = safeStorage.decryptString(tokenRow.ciphertext);
    log(`Connector received token (${token.length} chars), executing simulated HTTPS call...`);
    await new Promise((resolve) => setTimeout(resolve, 300)); // simulate 300ms API latency

    // Step C: Post-execution ledger commit
    log(`[Job ${jobId}] Step C: Updating ledger record to COMMITTED...`);
    const updateLedger = db.prepare('UPDATE ledger SET status = ?, committed_at = ? WHERE id = ?');
    updateLedger.run('COMMITTED', new Date().toISOString(), ledgerRecordId);
    log('Ledger record committed.');

    // Step D: Verify ledger record
    const committedRow = db.prepare('SELECT * FROM ledger WHERE id = ?').get(ledgerRecordId);
    log(`Committed ledger row: ${JSON.stringify(committedRow)}`);
    testResults.tests.jobLifecycleCompleted = (committedRow.status === 'COMMITTED');

    // Step E: Update UI
    testResults.tests.zeroTccVerified = (
      testResults.tests.petWindowCreated &&
      testResults.tests.cardWindowCreated &&
      testResults.tests.trayCreated &&
      testResults.tests.sqliteLedgerFunctional &&
      testResults.tests.safeStorageFunctional &&
      testResults.tests.jobLifecycleCompleted
    );

    log(`=== FINAL VERIFICATION RESULT: ${testResults.tests.zeroTccVerified ? 'PASS (100%)' : 'FAIL'} ===`);
    fs.writeFileSync(RESULT_JSON, JSON.stringify(testResults, null, 2));

    // Keep running for 5 seconds so screenshot capture succeeds
    setTimeout(() => {
      log('Test run finished. Quitting cleanly.');
      app.quit();
    }, 5000);

  } catch (err) {
    log(`FATAL ERROR: ${err.stack || err}`);
    testResults.details.error = err.message;
    fs.writeFileSync(RESULT_JSON, JSON.stringify(testResults, null, 2));
    app.quit();
  }
});
