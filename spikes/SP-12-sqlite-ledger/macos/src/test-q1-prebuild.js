const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Q1: PREBUILD & ABI COMPATIBILITY VERIFICATION (macOS) ===');
console.log('OS platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Node version:', process.version);

const projectDir = path.join(__dirname, '..');
const prebuildsDir = path.join(projectDir, 'node_modules/better-sqlite3/prebuilds');
const prebuildFiles = fs.readdirSync(prebuildsDir);
console.log('\nPrebuilds in better-sqlite3:');
prebuildFiles.forEach(f => {
  const stat = fs.statSync(path.join(prebuildsDir, f));
  console.log(`  - ${f} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
});

const expectedPrebuild = `darwin-${process.arch}.node`;
const prebuildExists = fs.existsSync(path.join(prebuildsDir, expectedPrebuild));
console.log(`\nDoes ${expectedPrebuild} exist?`, prebuildExists ? 'YES' : 'NO');

// Test require in Node
console.log('\nTesting require and query in Node.js host:');
const Database = require('better-sqlite3');
const memDb = new Database(':memory:');
const nodeRow = memDb.prepare('SELECT 42 as answer, sqlite_version() as sqlite_ver').get();
console.log('Node Host Query Result:', JSON.stringify(nodeRow));
memDb.close();

// Test require in Electron
console.log('\nTesting require and query in Electron runtime:');
const electronBin = path.join(projectDir, 'node_modules/.bin/electron');
const electronScript = `
const db = require('better-sqlite3')(':memory:');
console.log('ELECTRON_RESULT:', JSON.stringify(db.prepare('SELECT 42 as answer, sqlite_version() as sqlite_ver').get()));
console.log('ELECTRON_VERSIONS:', JSON.stringify({
  electron: process.versions.electron,
  modules: process.versions.modules,
  node: process.versions.node,
  arch: process.arch
}));
`;

const electronOutput = execSync(`ELECTRON_RUN_AS_NODE=1 "${electronBin}" -e "${electronScript.replace(/\n/g, ' ')}"`, {
  cwd: projectDir,
  encoding: 'utf8'
});
console.log(electronOutput.trim());

console.log('\n=== Q1 VERIFICATION COMPLETE: PASS ===');
