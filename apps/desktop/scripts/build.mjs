import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function runStep(name, cmd, args) {
  console.log(`[desktop:build] ${name}...`);
  // `shell: true` is required on Windows, where pnpm is a .CMD that cannot be
  // spawned directly.
  const res = spawnSync('pnpm', ['exec', cmd, ...args], { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error(`[desktop:build] ${name} failed with code ${res.status}`);
    process.exit(res.status ?? 1);
  }
}

// 1. Build main
runStep(
  'Build Main Process',
  'tsup',
  [
    'main/index.ts',
    '--format', 'cjs',
    '--out-dir', 'dist/main',
    '--external', 'electron',
    '--external', 'better-sqlite3',
    '--external', '@desktop-assistant/win32-window',
    '--external', '@desktop-assistant/macos-window',
    '--external', '@desktop-assistant/credential-store',
    '--target', 'node22'
  ]
);

// 2. Build preload
runStep(
  'Build Preload Script',
  'tsup',
  [
    'preload/index.ts',
    '--format', 'cjs',
    '--out-dir', 'dist/preload',
    '--external', 'electron',
    '--target', 'node22'
  ]
);

// 3. Build Pet Renderer
runStep('Build Pet Renderer', 'vite', ['build', '--config', 'vite.pet.config.ts']);

// 4. Build App Renderer
runStep('Build App Renderer', 'vite', ['build', '--config', 'vite.app.config.ts']);

// 5. Verify and bundle assets
console.log('[desktop:build] Verifying Pet assets and WASM bundle...');
const petRivSource = path.resolve('renderer-pet/assets/pet.riv');
if (!fs.existsSync(petRivSource)) {
  console.error(`[desktop:build] FATAL: Missing pet.riv asset at ${petRivSource}`);
  process.exit(1);
}

const petAssetsDist = path.resolve('dist/renderer-pet/assets');
if (!fs.existsSync(petAssetsDist)) {
  fs.mkdirSync(petAssetsDist, { recursive: true });
}
fs.copyFileSync(petRivSource, path.join(petAssetsDist, 'pet.riv'));

const petDistFiles = fs.readdirSync(petAssetsDist);
const hasWasm = petDistFiles.some(f => f.startsWith('rive-') && f.endsWith('.wasm'));
if (!hasWasm) {
  console.error(`[desktop:build] FATAL: Missing local Rive WASM file in ${petAssetsDist}`);
  process.exit(1);
}

console.log('[desktop:build] All desktop build steps completed successfully.');
