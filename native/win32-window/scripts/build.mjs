import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

if (process.platform !== 'win32') {
  console.error('win32-window: can only be built on win32');
  process.exit(1);
}

console.log('[win32-window:build] Compiling release Rust addon via cargo...');
const res = spawnSync('cargo', ['build', '--release'], { stdio: 'inherit', shell: true });
if (res.status !== 0) {
  console.error('[win32-window:build] cargo build failed');
  process.exit(res.status ?? 1);
}

mkdirSync('dist', { recursive: true });
const dllSource = path.join('target', 'release', 'desktop_window_win32.dll');
if (!existsSync(dllSource)) {
  console.error(`[win32-window:build] Built DLL not found at ${dllSource}`);
  process.exit(1);
}

const archNode = path.join('dist', `win32-window-${process.arch}.node`);
const defaultNode = path.join('dist', 'win32-window.node');

copyFileSync(dllSource, archNode);
copyFileSync(dllSource, defaultNode);

if (!existsSync(archNode)) {
  console.error(`[win32-window:build] Target artifact verification failed for ${archNode}`);
  process.exit(1);
}

console.log(`[win32-window:build] Successfully built and verified ${archNode}`);
