import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { createRequire } from 'node:module';

if (process.platform !== 'win32') {
  console.error('win32-window test can only run on win32');
  process.exit(1);
}

console.log('[win32-window:test] Running Rust unit tests via cargo test...');
const testRes = spawnSync('cargo', ['test'], { stdio: 'inherit', shell: true });
if (testRes.status !== 0) {
  console.error('[win32-window:test] cargo test failed');
  process.exit(testRes.status ?? 1);
}

const require = createRequire(import.meta.url);
const addon = require('../loader.cjs');

console.log('[win32-window:test] Verifying capabilities...');
const caps = addon.capabilities();
assert.deepStrictEqual(caps, {
  presentWithoutActivating: 'native',
  setPointerPassthrough: 'native',
  setVisibleEverywhere: 'framework',
  restoreFocusTo: 'unavailable',
  setDockPresence: 'framework',
  setExcludedFromCapture: 'framework',
});

console.log('[win32-window:test] Verifying handle validation and error codes...');
// 1. Empty buffer -> INVALID_HWND
assert.throws(
  () => addon.apply_no_activate_topmost(Buffer.alloc(0)),
  /INVALID_HWND/
);

// 2. Buffer of wrong length -> INVALID_HWND
assert.throws(
  () => addon.apply_no_activate_topmost(Buffer.alloc(4)),
  /INVALID_HWND/
);

// 3. Null pointer -> INVALID_HWND
assert.throws(
  () => addon.apply_no_activate_topmost(Buffer.alloc(8)),
  /INVALID_HWND/
);

// 4. Arbitrary pointer / foreign HWND -> INVALID_HWND or FOREIGN_HWND
assert.throws(
  () => addon.apply_no_activate_topmost(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])),
  /INVALID_HWND|FOREIGN_HWND/
);

console.log('[win32-window:test] All win32-window native tests passed.');
