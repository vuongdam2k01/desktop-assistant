const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execSync } = require('node:child_process');
const assert = require('node:assert');

console.log('======================================================================');
console.log('🔒 Q4: APFS FILE LOCKING, WAL BEHAVIOR & MULTI-PROCESS CONCURRENCY');
console.log('======================================================================');

const projectDir = path.join(__dirname, '..');
const evidenceDir = path.join(projectDir, 'evidence');
const dbPath = path.join(evidenceDir, 'q4_locking_test.db');
const walPath = `${dbPath}-wal`;
const shmPath = `${dbPath}-shm`;

// Clean up
[dbPath, walPath, shmPath].forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });

console.log('\n--- 1. FileVault & APFS Filesystem Inspection ---');
const diskInfo = execSync('diskutil info / | grep -E "File System|FileVault|Type"', { encoding: 'utf8' });
console.log(diskInfo.trim());

console.log('\n--- 2. WAL, SHM File Lifecycle on APFS ---');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.exec('CREATE TABLE test_items (id INTEGER PRIMARY KEY, val TEXT);');
db.prepare('INSERT INTO test_items (val) VALUES (?)').run('Initial Item');

console.log('Files present while DB is OPEN and has uncheckpointed data:');
console.log(`  - DB  exists: ${fs.existsSync(dbPath)} (${fs.statSync(dbPath).size} bytes)`);
console.log(`  - WAL exists: ${fs.existsSync(walPath)} (${fs.existsSync(walPath) ? fs.statSync(walPath).size : 0} bytes)`);
console.log(`  - SHM exists: ${fs.existsSync(shmPath)} (${fs.existsSync(shmPath) ? fs.statSync(shmPath).size : 0} bytes)`);

assert(fs.existsSync(walPath), 'WAL file must exist on APFS');
assert(fs.existsSync(shmPath), 'SHM index file must exist on APFS');

// Clean close
db.close();
console.log('\nFiles present after clean db.close() (passive checkpoint):');
console.log(`  - DB  exists: ${fs.existsSync(dbPath)}`);
console.log(`  - WAL exists: ${fs.existsSync(walPath)} (size: ${fs.existsSync(walPath) ? fs.statSync(walPath).size : 0} bytes)`);
console.log(`  - SHM exists: ${fs.existsSync(shmPath)} (size: ${fs.existsSync(shmPath) ? fs.statSync(shmPath).size : 0} bytes)`);

console.log('\n--- 3. Multi-Process Concurrency Test (1 Writer + 2 Concurrent Readers) ---');

// Spawn Worker Writer
const writerScript = `
const Database = require('better-sqlite3');
const db = new Database('${dbPath}', { timeout: 5000 });
db.pragma('journal_mode = WAL');
const insertStmt = db.prepare('INSERT INTO test_items (val) VALUES (?)');

let count = 0;
const interval = setInterval(() => {
  insertStmt.run('item_' + (++count));
  if (count >= 50) {
    clearInterval(interval);
    db.close();
    console.log('WRITER_COMPLETED_50_INSERTS');
    process.exit(0);
  }
}, 20);
`;

// Spawn Worker Reader
const readerScript = (id) => `
const Database = require('better-sqlite3');
const db = new Database('${dbPath}', { readonly: true, timeout: 5000 });
db.pragma('journal_mode = WAL');
const query = db.prepare('SELECT count(*) as count FROM test_items');

let reads = 0;
const interval = setInterval(() => {
  const row = query.get();
  reads++;
  if (reads >= 25) {
    clearInterval(interval);
    db.close();
    console.log('READER_${id}_READS:', reads, 'LAST_COUNT:', row.count);
    process.exit(0);
  }
}, 30);
`;

const spawnOpts = { cwd: projectDir, stdio: 'inherit' };
const procWriter = spawn('node', ['-e', writerScript], spawnOpts);
const procReader1 = spawn('node', ['-e', readerScript(1)], spawnOpts);
const procReader2 = spawn('node', ['-e', readerScript(2)], spawnOpts);

Promise.all([
  new Promise((res) => procWriter.on('exit', code => res({ name: 'writer', code }))),
  new Promise((res) => procReader1.on('exit', code => res({ name: 'reader1', code }))),
  new Promise((res) => procReader2.on('exit', code => res({ name: 'reader2', code })))
]).then(results => {
  console.log('\nConcurrency execution results:');
  results.forEach(r => console.log(`  - Process ${r.name} exited with code ${r.code}`));
  results.forEach(r => assert.strictEqual(r.code, 0, `${r.name} must exit successfully`));
  console.log('✔ Concurrent Writer and Readers executed seamlessly without lock contention on APFS!');

  console.log('\n--- 4. Multi-Writer Mutual Exclusion Test (SQLITE_BUSY on conflicting write) ---');
  const w1 = new Database(dbPath, { timeout: 0 }); // 0ms timeout to immediately fail on busy
  const w2 = new Database(dbPath, { timeout: 0 });

  w1.exec('BEGIN IMMEDIATE');
  console.log('Writer 1 acquired BEGIN IMMEDIATE lock.');

  let busyErrorCaught = false;
  try {
    w2.exec('BEGIN IMMEDIATE');
  } catch (err) {
    busyErrorCaught = true;
    console.log(`Writer 2 blocked with expected error: [${err.code}] ${err.message}`);
    assert.strictEqual(err.code, 'SQLITE_BUSY', 'Conflicting writer must receive SQLITE_BUSY');
  }
  assert(busyErrorCaught, 'Second writer must be blocked');

  w1.exec('COMMIT');
  console.log('Writer 1 committed.');

  w2.exec('BEGIN IMMEDIATE');
  console.log('Writer 2 acquired BEGIN IMMEDIATE successfully after Writer 1 released lock.');
  w2.exec('COMMIT');

  w1.close();
  w2.close();
  console.log('✔ Multi-Writer mutual exclusion verified: SQLITE_BUSY safely prevents double-write corruption.');

  console.log('\n=== Q4 APFS LOCKING & WAL TEST COMPLETE: PASS ===\n');
  process.exit(0);
}).catch(err => {
  console.error('Q4 Test Error:', err);
  process.exit(1);
});
