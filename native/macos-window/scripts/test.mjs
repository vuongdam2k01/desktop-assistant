import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

if (process.platform !== 'darwin') {
  console.error('macos-window test can only run on darwin');
  process.exit(1);
}

const testExe = path.join('build', 'Release', 'test_macos_window');
if (!existsSync(testExe)) {
  console.error(`[macos-window:test] Native test executable not found at ${testExe}`);
  process.exit(1);
}

console.log('[macos-window:test] Running AppKit core native test executable...');
const testRes = spawnSync(testExe, [], { stdio: 'inherit' });
if (testRes.status !== 0) {
  console.error('[macos-window:test] test_macos_window failed');
  process.exit(testRes.status ?? 1);
}

const require = createRequire(import.meta.url);
const addon = require('../loader.cjs');

console.log('[macos-window:test] Verifying capabilities...');
const caps = addon.capabilities();
assert.deepStrictEqual(caps, {
  presentWithoutActivating: 'framework',
  setPointerPassthrough: 'native',
  setVisibleEverywhere: 'native',
  restoreFocusTo: 'native',
  setDockPresence: 'native',
  setExcludedFromCapture: 'native',
});

console.log('[macos-window:test] Verifying handle validation and error codes...');

// The addon reports failures through a machine-readable `code`; its message is prose and
// is not what a caller branches on. Asserting against the message made these checks pass
// or fail on wording rather than on behaviour.
function throwsWithCode(fn, ...codes) {
  assert.throws(fn, err => {
    assert.ok(
      codes.includes(err.code),
      `expected one of ${codes.join(', ')} but received ${err.code} (${err.message})`
    );
    return true;
  });
}

// 1. Empty buffer -> INVALID_NS_VIEW
throwsWithCode(() => addon.applyNoActivateTopmost(Buffer.alloc(0)), 'INVALID_NS_VIEW');

// 2. Wrong length buffer -> INVALID_NS_VIEW
throwsWithCode(() => addon.applyNoActivateTopmost(Buffer.alloc(4)), 'INVALID_NS_VIEW');

// 3. Null pointer buffer -> INVALID_NS_VIEW
throwsWithCode(() => addon.applyNoActivateTopmost(Buffer.alloc(8)), 'INVALID_NS_VIEW');

// 4. Foreign pointer buffer -> FOREIGN_NS_VIEW
throwsWithCode(
  () =>
    addon.applyNoActivateTopmost(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])),
  'FOREIGN_NS_VIEW'
);

// 5. Invalid activation policy -> INVALID_ACTIVATION_POLICY
throwsWithCode(() => addon.setActivationPolicy('invalid_policy'), 'INVALID_ACTIVATION_POLICY');

// 6. Invalid alpha mask or null view -> INVALID_ALPHA_MASK or INVALID_NS_VIEW
throwsWithCode(
  () => addon.enablePixelHitTest(Buffer.alloc(8), 0, 0, Buffer.alloc(0)),
  'INVALID_ALPHA_MASK',
  'INVALID_NS_VIEW'
);

console.log('[macos-window:test] All macos-window native tests passed.');
