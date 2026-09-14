#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const command = process.argv[2];
if (!command || !['build', 'test'].includes(command)) {
  console.error('Usage: node tooling/native-target.mjs <build|test>');
  process.exit(1);
}

const platform = process.platform;

if (platform === 'linux') {
  console.log(`NATIVE_TARGET_SKIPPED: linux`);
  process.exit(0);
}

if (platform === 'win32') {
  const scriptName = command === 'build' ? 'native:build' : 'native:test';
  const res = spawnSync('pnpm', ['--filter', '@desktop-assistant/win32-window', scriptName], {
    stdio: 'inherit',
    shell: true,
  });
  process.exit(res.status ?? 1);
}

if (platform === 'darwin') {
  const scriptName = command === 'build' ? 'native:build' : 'native:test';
  const res = spawnSync('pnpm', ['--filter', '@desktop-assistant/macos-window', scriptName], {
    stdio: 'inherit',
    shell: true,
  });
  process.exit(res.status ?? 1);
}

console.error(`Unsupported platform for native target: ${platform}`);
process.exit(1);
