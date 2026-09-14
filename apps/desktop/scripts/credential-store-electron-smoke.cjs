const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { app, safeStorage } = require('electron');
const Database = require('better-sqlite3');
const {
  CredentialStore,
  ElectronSafeStorageCipherGateway,
  DEFAULT_CREDENTIAL_DESCRIPTORS,
} = require('@desktop-assistant/credential-store');
// 1. Inviolable application identity before readiness
app.setName('DesktopAssistant');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

// 2. On Linux, force basic password store before readiness to test fail-closed behavior
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('password-store', 'basic');
}

// 3. Isolated user-data directory
const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-cred-smoke-'));
app.setPath('userData', tempUserData);

async function runSmoke() {
  await app.whenReady();

  const dbPath = path.join(tempUserData, 'credentials.db');
  const gateway = new ElectronSafeStorageCipherGateway(safeStorage, process.platform);

  if (process.platform === 'linux') {
    // Linux fail-closed verification under forced basic_text
    const isAvailable = gateway.isAvailable();
    if (isAvailable) {
      throw new Error(`FAIL: gateway.isAvailable() should be false on Linux basic_text, got true`);
    }

    const store = new CredentialStore({
      databasePath: dbPath,
      cipherGateway: gateway,
    });
    for (const d of DEFAULT_CREDENTIAL_DESCRIPTORS) {
      store.registerClass(d);
    }
    await store.open();

    const canary = 'LINUX_CANARY_TEST_SECRET_DO_NOT_STORE_12345';
    let putThrew = false;
    try {
      await store.put('connector:notion:default:token', canary);
    } catch (err) {
      putThrew = true;
      if (err.code !== 'SECURE_STORAGE_UNAVAILABLE') {
        throw new Error(`Expected SECURE_STORAGE_UNAVAILABLE, got ${err.code} (${err.message})`, {
          cause: err,
        });
      }
    }

    if (!putThrew) {
      throw new Error('FAIL: store.put did not throw on unavailable secure storage');
    }

    // Verify zero credential rows exist in database
    const presence = await store.presence('connector:notion:default:token');
    if (presence.present) {
      throw new Error('FAIL: presence.present is true after failed write');
    }

    // Scan temporary directory for plaintext canary
    const scanDir = dir => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(full);
          if (content.includes(Buffer.from(canary))) {
            throw new Error(`FAIL: Canary found in plaintext file: ${full}`);
          }
        }
      }
    };
    scanDir(tempUserData);

    store.close();
    fs.rmSync(tempUserData, { recursive: true, force: true });
    console.log('CREDENTIAL_STORE_LINUX_FAIL_CLOSED_OK');
    app.exit(0);
    return;
  }

  // Windows & macOS OS secure storage integration
  if (process.platform === 'win32' || process.platform === 'darwin') {
    if (!gateway.isAvailable()) {
      throw new Error(`FAIL: gateway.isAvailable() is false on ${process.platform}`);
    }

    const store = new CredentialStore({
      databasePath: dbPath,
      cipherGateway: gateway,
    });
    for (const d of DEFAULT_CREDENTIAL_DESCRIPTORS) {
      store.registerClass(d);
    }
    await store.open();

    // 1. 3,073-byte round trip
    let largeCanary = '';
    for (let i = 0; i < 3073; i++) {
      largeCanary += String.fromCharCode(33 + (i % 93));
    }
    const key = 'connector:notion:default:token';
    await store.put(key, largeCanary, { workspaceName: 'ProductionSmoke' });

    const readBack = await store.get(key);
    if (readBack !== largeCanary) {
      throw new Error(`FAIL: 3,073-byte roundtrip mismatch (got length ${readBack.length})`);
    }

    // 2. Raw database canary scan
    const dbDirect = new Database(dbPath);
    dbDirect.pragma('wal_checkpoint(TRUNCATE)');
    dbDirect.close();

    const dbFiles = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
    for (const f of dbFiles) {
      if (fs.existsSync(f)) {
        const bytes = fs.readFileSync(f);
        if (bytes.includes(Buffer.from(largeCanary))) {
          throw new Error(`FAIL: Raw canary found in database file: ${f}`);
        }
      }
    }

    // 3. Tamper / truncate failure
    const tamperDb = new Database(dbPath);
    const row = tamperDb.prepare('SELECT ciphertext FROM credential_entry WHERE key = ?').get(key);
    const tampered = Buffer.from(row.ciphertext);
    tampered[tampered.length - 1] ^= 0xff;
    tamperDb.prepare('UPDATE credential_entry SET ciphertext = ? WHERE key = ?').run(tampered, key);
    tamperDb.close();

    let getThrew = false;
    try {
      await store.get(key);
    } catch (err) {
      getThrew = true;
      if (err.code !== 'CREDENTIAL_UNREADABLE') {
        throw new Error(`Expected CREDENTIAL_UNREADABLE on tamper, got ${err.code}`, {
          cause: err,
        });
      }
    }
    if (!getThrew) {
      throw new Error('FAIL: store.get did not throw on tampered ciphertext');
    }

    // 4. Overwrite and delete
    await store.eraseAll();
    if (fs.existsSync(dbPath)) {
      throw new Error(`FAIL: database file still exists after eraseAll: ${dbPath}`);
    }

    // 5. Ensure absence of per-credential item in OS vault
    if (process.platform === 'win32') {
      const res = spawnSync('cmdkey', ['/list'], { encoding: 'utf8' });
      if (res.stdout && res.stdout.includes(key)) {
        throw new Error(`FAIL: Per-credential key '${key}' found in Windows Credential Manager`);
      }
    } else if (process.platform === 'darwin') {
      const res = spawnSync('security', ['find-generic-password', '-s', key], { encoding: 'utf8' });
      if (res.status === 0) {
        throw new Error(`FAIL: Per-credential key '${key}' found in macOS Keychain`);
      }
    }

    fs.rmSync(tempUserData, { recursive: true, force: true });
    console.log('CREDENTIAL_STORE_OS_ROUNDTRIP_OK');
    app.exit(0);
    return;
  }

  throw new Error(`Unsupported platform for smoke: ${process.platform}`);
}

runSmoke().catch(err => {
  console.error('Fatal error in credential store smoke:', err);
  try {
    fs.rmSync(tempUserData, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error on fatal exit
  }
});
