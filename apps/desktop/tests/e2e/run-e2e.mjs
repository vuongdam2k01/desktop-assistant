#!/usr/bin/env node
/* global window */
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWindowByUrlMarker } from '../helpers/window-locator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.platform !== 'win32' && process.platform !== 'darwin') {
  console.log('NATIVE_TARGET_SKIPPED: linux');
  process.exit(0);
}

console.log(`[e2e:window-integration] Running on ${process.platform}...`);

// 1. Compile test harnesses using tsup
console.log('[e2e:window-integration] Compiling test Electron entry points...');
const compileRes = spawnSync(
  'pnpm',
  [
    'exec',
    'tsup',
    path.join(__dirname, 'fake-editor.ts'),
    path.join(__dirname, 'product-harness.ts'),
    '--format',
    'cjs',
    '--out-dir',
    path.join(__dirname, '../../dist-e2e'),
    '--target',
    'node22',
    // electron is a devDependency, which tsup does not externalise on its own. Bundled,
    // `require('electron')` reaches the npm shim instead of the module Electron provides,
    // and the harness sits there trying to download a binary until the launch times out.
    '--external',
    'electron',
  ],
  {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '../..'),
  }
);

if (compileRes.status !== 0) {
  console.error('[e2e:window-integration] Failed to compile test entry points');
  process.exit(compileRes.status ?? 1);
}

// 2. Import Playwright
const { _electron: electron } = await import('playwright-core');

const distE2eDir = path.resolve(__dirname, '../../dist-e2e');
const fakeEditorCjs = path.join(distE2eDir, 'fake-editor.cjs');
const productHarnessCjs = path.join(distE2eDir, 'product-harness.cjs');

/**
 * Both harnesses expose their control surface through `ipcMain.handle`, which only a
 * renderer can reach. Driving them from a page that runs with node integration is the
 * only transport that actually reaches those handlers; an `ElectronApplication.evaluate`
 * runs in the main process, where `window` does not exist.
 */
function makeHarnessInvoker(page) {
  return async (channel, arg) =>
    page.evaluate(
      ([ch, a]) => window.require('electron').ipcRenderer.invoke(ch, a),
      [channel, arg]
    );
}

/** Surfaces a harness's own output, which otherwise never reaches this log. */
function relayOutput(label, app) {
  const proc = app.process();
  proc.stdout?.on('data', chunk => process.stdout.write(`[${label}] ${chunk}`));
  proc.stderr?.on('data', chunk => process.stdout.write(`[${label}] ${chunk}`));
}

console.log('[e2e:window-integration] Launching Electron processes...');
const fakeEditorApp = await electron.launch({ args: [fakeEditorCjs] });
relayOutput('fake-editor', fakeEditorApp);
const productApp = await electron.launch({ args: [productHarnessCjs] });
relayOutput('product-harness', productApp);

try {
  const fakeEditorPage = await resolveWindowByUrlMarker(fakeEditorApp, 'editor');
  await fakeEditorPage.waitForLoadState('domcontentloaded');

  const petPage = await resolveWindowByUrlMarker(productApp, 'pet-target');
  await petPage.waitForLoadState('domcontentloaded');

  const invokeEditor = makeHarnessInvoker(fakeEditorPage);
  const invokeProduct = makeHarnessInvoker(petPage);

  // 3. Foreign handle rejection test
  console.log('[e2e:window-integration] Testing foreign handle rejection...');
  const fakeHandleBase64 = await invokeEditor('get-handle');
  assert(
    typeof fakeHandleBase64 === 'string' && fakeHandleBase64.length > 0,
    'FakeEditor must return its native window handle'
  );

  const foreignTestRes = await invokeProduct('test-foreign-handle', fakeHandleBase64);

  assert(
    foreignTestRes && foreignTestRes.ok === false,
    `Foreign handle must be rejected: ${JSON.stringify(foreignTestRes)}`
  );
  assert(
    /FOREIGN_HWND|FOREIGN_NS_VIEW|INVALID_HWND/.test(foreignTestRes.error),
    `Error must match FOREIGN_HWND or FOREIGN_NS_VIEW: ${foreignTestRes.error}`
  );
  console.log('✓ Foreign handle correctly rejected with:', foreignTestRes.error);

  // 4. Ten iterations of 200-character typing stream with auto-reveal
  console.log('[e2e:window-integration] Running 10 iterations of 200-character typing stream...');
  const text200 = '0123456789'.repeat(20);
  assert.strictEqual(text200.length, 200);

  const initialCardInfo = await invokeProduct('get-prewarmed-card-info');
  assert(
    initialCardInfo && typeof initialCardInfo.handle === 'string',
    `Pre-warmed card info must be readable: ${JSON.stringify(initialCardInfo)}`
  );

  const initialWinCount = await invokeProduct('get-window-count');
  assert(typeof initialWinCount === 'number' && initialWinCount > 0, 'Window count must be readable');

  for (let iter = 1; iter <= 10; iter++) {
    console.log(`[e2e:window-integration] Iteration ${iter}/10...`);
    // Focus editor textarea
    await fakeEditorPage.click('#editor');
    await fakeEditorPage.fill('#editor', '');

    // Type first 80 characters with 25ms delay
    await fakeEditorPage.type('#editor', text200.slice(0, 80), { delay: 25 });

    // Reveal prewarmed card during characters 80-100
    await invokeProduct('move-card', { x: 100, y: 100, width: 340, height: 220, visible: true });

    // Type characters 80..100
    await fakeEditorPage.type('#editor', text200.slice(80, 100), { delay: 25 });

    // Type remaining 100 characters
    await fakeEditorPage.type('#editor', text200.slice(100, 200), { delay: 25 });

    // Assert exact text in editor
    const textReceived = await fakeEditorPage.inputValue('#editor');
    assert.strictEqual(textReceived, text200, `Text mismatch on iteration ${iter}`);

    // Assert zero blur events
    const blurs = await fakeEditorPage.evaluate(() => window.__blurCount);
    assert.strictEqual(blurs, 0, `Unexpected blur event observed on iteration ${iter}`);

    // Assert editor isFocused
    const isEditorFocused = await invokeEditor('is-focused');
    assert(isEditorFocused, `FakeEditor must remain focused throughout iteration ${iter}`);

    // Assert unchanged card handle, webContentsId, and no new BrowserWindow
    const currentCardInfo = await invokeProduct('get-prewarmed-card-info');
    assert.strictEqual(currentCardInfo.handle, initialCardInfo.handle, 'Card handle must remain stable');
    assert.strictEqual(
      currentCardInfo.webContentsId,
      initialCardInfo.webContentsId,
      'Card webContentsId must remain stable'
    );

    const currentWinCount = await invokeProduct('get-window-count');
    assert.strictEqual(currentWinCount, initialWinCount, 'No new BrowserWindow must be created on reveal');

    // Dismiss card
    await invokeProduct('move-card', { x: 100, y: 100, width: 340, height: 220, visible: false });
  }
  console.log('✓ 10/10 typing iterations passed with 0 blur and 0 lost characters.');

  // 5. Hit testing verification via Playwright click
  console.log('[e2e:window-integration] Testing pixel hit testing on pet window...');
  await invokeProduct('enable-pet-pixel-hit-test');

  const initialClicks = await petPage.evaluate(() => window.__clickCount || 0);
  // Click pet center
  await petPage.click('#pet-target');
  const afterClicks = await petPage.evaluate(() => window.__clickCount || 0);
  assert(afterClicks > initialClicks, 'Click must be received by opaque pet center');
  console.log('✓ Hit testing successfully registered click on opaque pet center');

  // 6. Terminate fake editor and verify restoreFocusTo returns false
  console.log('[e2e:window-integration] Testing focus restoration on terminated process...');
  await fakeEditorApp.close();

  const restoreTerminated = await invokeProduct('restore-focus');

  assert.strictEqual(restoreTerminated, false, 'restorePreviousFocus must return false for terminated process');
  console.log('✓ restorePreviousFocus cleanly returned false for terminated process');

  console.log('[e2e:window-integration] All target-OS E2E scenarios completed successfully.');
} finally {
  await fakeEditorApp.close().catch(() => {});
  await productApp.close().catch(() => {});
}
