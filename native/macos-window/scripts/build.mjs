import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

if (process.platform !== 'darwin') {
  console.error('macos-window: can only be built on darwin');
  process.exit(1);
}

console.log('[macos-window:build] Compiling Objective-C++ addon via local node-gyp...');
const res = spawnSync('pnpm', ['exec', 'node-gyp', 'rebuild'], {
  stdio: 'inherit',
  shell: true,
});
if (res.status !== 0) {
  console.error('[macos-window:build] node-gyp rebuild failed');
  process.exit(res.status ?? 1);
}

mkdirSync('dist', { recursive: true });
const nodeSource = path.join('build', 'Release', 'macos_window.node');
if (!existsSync(nodeSource)) {
  console.error(`[macos-window:build] Built addon not found at ${nodeSource}`);
  process.exit(1);
}

const archNode = path.join('dist', `macos-window-${process.arch}.node`);
const defaultNode = path.join('dist', 'macos-window.node');

copyFileSync(nodeSource, archNode);
copyFileSync(nodeSource, defaultNode);

if (!existsSync(archNode)) {
  console.error(`[macos-window:build] Target artifact verification failed for ${archNode}`);
  process.exit(1);
}

console.log(`[macos-window:build] Successfully built and verified ${archNode}`);
