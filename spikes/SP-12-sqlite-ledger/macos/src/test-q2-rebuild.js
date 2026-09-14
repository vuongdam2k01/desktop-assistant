const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Q2: COMPILATION TOOLCHAIN & @ELECTRON/REBUILD ON MACOS ===');

// 1. Toolchain Info
console.log('\n--- 1. Toolchain Inventory ---');
const xcodePath = execSync('xcode-select -p', { encoding: 'utf8' }).trim();
const clangVer = execSync('clang --version', { encoding: 'utf8' }).trim().split('\n')[0];
const pythonPath = execSync('which python3', { encoding: 'utf8' }).trim();
const pythonVer = execSync('python3 --version', { encoding: 'utf8' }).trim();
const nodeVer = process.version;
const nodeArch = process.arch;

console.log('Xcode CLT Path:', xcodePath);
console.log('Clang Version:', clangVer);
console.log('Python Path:', pythonPath);
console.log('Python Version:', pythonVer);
console.log('Node Version:', nodeVer);
console.log('Node Arch:', nodeArch);

const projectDir = path.join(__dirname, '..');
const sqliteModuleDir = path.join(projectDir, 'node_modules/better-sqlite3');

// 2. Measure build-from-source time
console.log('\n--- 2. Measuring Build-from-source (node-gyp / npm rebuild) ---');
const t0 = Date.now();
try {
  const rebuildOutput = execSync('npm rebuild better-sqlite3 --build-from-source', {
    cwd: projectDir,
    encoding: 'utf8'
  });
  const t1 = Date.now();
  const durationSec = ((t1 - t0) / 1000).toFixed(2);
  console.log(`Build-from-source COMPLETED in ${durationSec}s`);
  console.log('Output excerpt:\n' + rebuildOutput.slice(0, 500));
} catch (err) {
  console.error('Build-from-source FAILED:', err.message);
  if (err.stdout) console.log('Stdout:', err.stdout);
  if (err.stderr) console.error('Stderr:', err.stderr);
}

// 3. Test @electron/rebuild
console.log('\n--- 3. Testing @electron/rebuild for Electron 44.3.0 ---');
const tRebuild0 = Date.now();
try {
  const electronRebuildOutput = execSync('npx @electron/rebuild -v 44.3.0 -m . -w better-sqlite3', {
    cwd: projectDir,
    encoding: 'utf8'
  });
  const tRebuild1 = Date.now();
  const rebuildDurationSec = ((tRebuild1 - tRebuild0) / 1000).toFixed(2);
  console.log(`@electron/rebuild COMPLETED in ${rebuildDurationSec}s`);
  console.log('Rebuild output:\n' + electronRebuildOutput.trim());
} catch (err) {
  console.error('@electron/rebuild FAILED:', err.message);
  if (err.stdout) console.log('Stdout:', err.stdout);
  if (err.stderr) console.error('Stderr:', err.stderr);
}

// 4. Verify in Electron
console.log('\n--- 4. Verifying execution in Electron runtime after rebuild ---');
const electronBin = path.join(projectDir, 'node_modules/.bin/electron');
const electronScript = `
const db = require('better-sqlite3')(':memory:');
console.log('ELECTRON_POST_REBUILD_RESULT:', JSON.stringify(db.prepare('SELECT 100 as answer, sqlite_version() as ver').get()));
`;

try {
  const verifyOutput = execSync(`ELECTRON_RUN_AS_NODE=1 "${electronBin}" -e "${electronScript.replace(/\n/g, ' ')}"`, {
    cwd: projectDir,
    encoding: 'utf8'
  });
  console.log(verifyOutput.trim());
  console.log('\n=== Q2 VERIFICATION COMPLETE: PASS ===');
} catch (err) {
  console.error('Electron execution after rebuild FAILED:', err.message);
}
