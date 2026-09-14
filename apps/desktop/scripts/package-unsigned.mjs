import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function runStep(name, cmd, args, env = {}) {
  console.log(`[package:unsigned] ${name}...`);
  // `shell: true` is required on Windows, where pnpm is a .CMD that cannot be
  // spawned directly.
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) {
    console.error(`[package:unsigned] ${name} failed with code ${res.status}`);
    process.exit(res.status ?? 1);
  }
}

// 1. Build desktop assets
runStep('Build Desktop Assets', 'node', ['scripts/build.mjs']);

// 2. Package unsigned directory
runStep(
  'Electron Builder Packaging',
  'pnpm',
  ['exec', 'electron-builder', '--dir', '--config', 'electron-builder.yml'],
  { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
);

// 3. Locate unpacked release directory
const releaseDir = path.resolve('release');
if (!fs.existsSync(releaseDir)) {
  console.error(`[package:unsigned] Release directory not found at ${releaseDir}`);
  process.exit(1);
}

const unpackedCandidates = fs
  .readdirSync(releaseDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && (d.name.endsWith('-unpacked') || d.name === 'mac' || d.name === 'mac-arm64'))
  .map(d => path.join(releaseDir, d.name));

if (unpackedCandidates.length === 0) {
  console.error(`[package:unsigned] No unpacked release directory found in ${releaseDir}`);
  process.exit(1);
}

const repoRoot = path.resolve('../..');
const unpackedDir = unpackedCandidates[0];
console.log(`[package:unsigned] Found unpacked directory at: ${unpackedDir}`);
// 4. Artifact-mode packaging check
runStep('Artifact-mode Packaging Check', 'pnpm', [
  'exec',
  'build-check',
  'packaging',
  '--repo-root',
  repoRoot,
  '--artifact',
  unpackedDir,
]);

// 5. Electron-as-Node SQLite smoke test
console.log('[package:unsigned] Running Electron-as-Node SQLite smoke test...');

function findElectronExecutable(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // On macOS, look inside .app/Contents/MacOS/
  for (const e of entries) {
    if (e.isDirectory() && e.name.endsWith('.app')) {
      const macBinDir = path.join(dir, e.name, 'Contents/MacOS');
      if (fs.existsSync(macBinDir)) {
        const binFiles = fs.readdirSync(macBinDir);
        if (binFiles.length > 0) {
          return path.join(macBinDir, binFiles[0]);
        }
      }
    }
  }

  // On Windows / Linux
  for (const e of entries) {
    if (e.isFile()) {
      if (process.platform === 'win32' && e.name.endsWith('.exe')) {
        return path.join(dir, e.name);
      }
      if (
        process.platform === 'linux' &&
        (e.name === 'DesktopAssistant' || e.name === '@desktop-assistantdesktop' || !e.name.includes('.'))
      ) {
        if (!e.name.includes('sandbox') && !e.name.includes('crashpad') && !e.name.endsWith('.sh')) {
          return path.join(dir, e.name);
        }
      }
    }
  }
  return null;
}

const electronExe = findElectronExecutable(unpackedDir);
if (!electronExe) {
  console.error(`[package:unsigned] Could not find Electron executable in ${unpackedDir}`);
  process.exit(1);
}

function findAsar(dir, depth = 0) {
  if (depth > 6) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isFile() && e.name === 'app.asar') return full;
    if (e.isDirectory()) {
      const found = findAsar(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const asarPath = findAsar(unpackedDir);
if (!asarPath) {
  console.error(`[package:unsigned] Could not find app.asar in ${unpackedDir}`);
  process.exit(1);
}
function findFileRecursive(dir, targetName, maxDepth = 10) {
  if (maxDepth <= 0 || !fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isFile() && e.name === targetName) {
      return full;
    }
    if (e.isDirectory()) {
      const found = findFileRecursive(full, targetName, maxDepth - 1);
      if (found) return found;
    }
  }
  return null;
}

const asarUnpackedDir = path.join(path.dirname(asarPath), 'app.asar.unpacked');
if (process.platform === 'win32') {
  const expectedBinary = `win32-window-${process.arch}.node`;
  const foundPath = findFileRecursive(asarUnpackedDir, expectedBinary);
  if (!foundPath) {
    console.error(`[package:unsigned] Required native binary ${expectedBinary} not found beneath ${asarUnpackedDir}`);
    process.exit(1);
  }
  console.log(`[package:unsigned] Verified physical unpacked binary: ${foundPath}`);
} else if (process.platform === 'darwin') {
  const expectedBinary = `macos-window-${process.arch}.node`;
  const foundPath = findFileRecursive(asarUnpackedDir, expectedBinary);
  if (!foundPath) {
    console.error(`[package:unsigned] Required native binary ${expectedBinary} not found beneath ${asarUnpackedDir}`);
    process.exit(1);
  }
  console.log(`[package:unsigned] Verified physical unpacked binary: ${foundPath}`);
}


const smokeScript = `
const path = require("node:path");
const asarPath = ${JSON.stringify(asarPath)};
const sqlitePath = path.join(asarPath, "node_modules/better-sqlite3");
const Database = require(sqlitePath);
const db = new Database(":memory:");
const row = db.prepare("SELECT 1 AS ready").get();
if (row && row.ready === 1) {
  console.log("SQLITE_NATIVE_READY");
}
db.close();

if (process.platform === "win32") {
  const win32ModulePath = path.join(asarPath, "node_modules/@desktop-assistant/win32-window");
  const win32 = require(win32ModulePath);
  const caps = win32.capabilities();
  if (caps.presentWithoutActivating === "native" && caps.setPointerPassthrough === "native") {
    console.log("WIN32_WINDOW_NATIVE_READY");
  } else {
    console.error("Win32 capabilities mismatch in packaged app:", caps);
  }
} else if (process.platform === "darwin") {
  const macosModulePath = path.join(asarPath, "node_modules/@desktop-assistant/macos-window");
  const macos = require(macosModulePath);
  const caps = macos.capabilities();
  if (caps.setPointerPassthrough === "native" && caps.restoreFocusTo === "native") {
    console.log("MACOS_WINDOW_NATIVE_READY");
  } else {
    console.error("macOS capabilities mismatch in packaged app:", caps);
  }
}

const credStorePath = path.join(asarPath, "node_modules/@desktop-assistant/credential-store");
const credModule = require(credStorePath);
if (typeof credModule.CredentialStore === "function") {
  console.log("CREDENTIAL_STORE_PACKAGE_READY");
}
`;
const smokeRes = spawnSync(electronExe, ['-e', smokeScript], {
  encoding: 'utf8',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
});

console.log(smokeRes.stdout);
if (smokeRes.stderr) console.error(smokeRes.stderr);

if (smokeRes.status !== 0) {
  console.error(`[package:unsigned] Electron-as-Node smoke test exited with code ${smokeRes.status}`);
  process.exit(smokeRes.status ?? 1);
}

if (!smokeRes.stdout.includes('SQLITE_NATIVE_READY')) {
  console.error('[package:unsigned] Smoke test failed: SQLITE_NATIVE_READY marker not found in output');
  process.exit(1);
}

if (process.platform === 'win32' && !smokeRes.stdout.includes('WIN32_WINDOW_NATIVE_READY')) {
  console.error('[package:unsigned] Smoke test failed: WIN32_WINDOW_NATIVE_READY marker not found in output');
  process.exit(1);
}

if (process.platform === 'darwin' && !smokeRes.stdout.includes('MACOS_WINDOW_NATIVE_READY')) {
  console.error('[package:unsigned] Smoke test failed: MACOS_WINDOW_NATIVE_READY marker not found in output');
  process.exit(1);
}

if (!smokeRes.stdout.includes('CREDENTIAL_STORE_PACKAGE_READY')) {
  console.error('[package:unsigned] Smoke test failed: CREDENTIAL_STORE_PACKAGE_READY marker not found in output');
  process.exit(1);
}

console.log('[package:unsigned] SUCCESS: Unsigned package created and verified.');
