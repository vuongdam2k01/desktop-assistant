const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');

function createDatabase(dbPath = ':memory:', options = {}) {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Configure SQLite WAL mode & pragmas
  db.pragma('journal_mode = WAL');
  const synchronous = options.synchronous || process.env.SQLITE_SYNCHRONOUS || 'NORMAL';
  db.pragma(`synchronous = ${synchronous}`);
  db.pragma('foreign_keys = ON');

  // macOS Fullfsync Control: F_FULLFSYNC syscall via PRAGMA
  const fullfsync = options.fullfsync !== undefined 
    ? options.fullfsync 
    : (process.env.SQLITE_FULLFSYNC === '1');

  if (fullfsync) {
    db.pragma('fullfsync = ON');
    db.pragma('checkpoint_fullfsync = ON');
  } else {
    db.pragma('fullfsync = OFF');
    db.pragma('checkpoint_fullfsync = OFF');
  }

  // Load and execute schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  return db;
}

module.exports = {
  createDatabase
};
