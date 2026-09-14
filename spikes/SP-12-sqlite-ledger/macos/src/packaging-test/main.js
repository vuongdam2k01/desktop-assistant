const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const resultFile = process.env.TEST_RESULT_FILE || path.join(app.getPath('userData'), 'packaging-result.json');

app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(app.getPath('userData'), 'packaged-test.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('fullfsync = ON');
    db.exec('CREATE TABLE test_ledger (id INTEGER PRIMARY KEY, correlation_id TEXT, payload TEXT);');
    
    const insertStmt = db.prepare('INSERT INTO test_ledger (correlation_id, payload) VALUES (?, ?)');
    insertStmt.run('corr_packaged_mac_001', JSON.stringify({ action: 'packaged_native_check', timestamp: new Date().toISOString() }));

    const row = db.prepare('SELECT * FROM test_ledger WHERE correlation_id = ?').get('corr_packaged_mac_001');
    db.close();

    const result = {
      success: true,
      row,
      dbPath,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      modulesVersion: process.versions.modules,
      arch: process.arch,
      platform: process.platform,
      isAsar: __dirname.includes('app.asar')
    };

    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2), 'utf8');
    console.log('PACKAGED_TEST_SUCCESS:', JSON.stringify(result));
    app.exit(0);
  } catch (err) {
    console.error('PACKAGED_TEST_ERROR:', err);
    const result = {
      success: false,
      error: err.message,
      stack: err.stack,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      modulesVersion: process.versions.modules
    };
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2), 'utf8');
    app.exit(1);
  }
});
