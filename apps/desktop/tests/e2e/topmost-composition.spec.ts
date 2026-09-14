import { test, expect, _electron, type ElectronApplication } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  captureComposedScreen,
  analyzeComposedRegion,
  startBackgroundWindow,
  waitForBackgroundWindow,
} from '../helpers/topmost-helper.js';
import { resolvePetWindow } from '../helpers/pet-window.js';

test.describe('Topmost OS Composition Verification', () => {
  let tmpUserData: string;
  let activeAssetPath: string;
  let electronApp: ElectronApplication;

  test.beforeEach(async () => {
    tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'da-topmost-userdata-'));
    activeAssetPath = path.join(tmpUserData, 'active-pet.riv');
    fs.copyFileSync(path.resolve('renderer-pet/assets/pet.riv'), activeAssetPath);

    electronApp = await _electron.launch({
      args: ['dist/main/index.cjs'],
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        CI: '1',
        DESKTOP_ASSISTANT_SOFTWARE_RENDERING: '1',
        DESKTOP_ASSISTANT_E2E: '1',
        DESKTOP_ASSISTANT_TEST_PET_ASSET_PATH: activeAssetPath,
        DESKTOP_ASSISTANT_USER_DATA: tmpUserData,
      },
    });

    const petPage = await resolvePetWindow(electronApp);
    await petPage.waitForSelector('#pet-stage[data-render-status="ready"]', { timeout: 15_000 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
    }
    if (fs.existsSync(tmpUserData)) {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    }
  });

  /**
   * Capture exclusion has to be lifted through whichever mechanism applied it. The Windows
   * integration calls Electron's own setContentProtection, so this reverses it there and on
   * the Linux fallback, where it is a no-op in both directions.
   *
   * macOS applies the exclusion through the native module, and Electron's setter does not
   * undo it: a run showed the pet absent from the screen grab with every pixel of its
   * rectangle reading as background while the magenta window behind it was captured
   * normally. Reaching the native module from here is not possible either — it validates
   * that a handle belongs to the calling process, so only the application's own code can
   * lift what it set. That is why this check does not run on macOS.
   */
  async function setPetContentProtection(enabled: boolean): Promise<void> {
    await electronApp.evaluate(({ BrowserWindow }, on) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      petWin?.setContentProtection(on);
    }, enabled);
  }

  // The pet is withheld from what other applications capture, and an operating-system screen
  // grab is one of those. Only the application itself can suspend that on macOS, so the
  // stacking order cannot be observed at this layer there. Measured, not assumed: the pet
  // came back at zero pixels while the window behind it captured normally.
  test.skip(
    process.platform === 'darwin',
    'the pet cannot be captured by the operating system on macOS and only the application can lift that'
  );

  test('pet renders above background fullscreen window and reveals background through transparent padding', async () => {
    const petBounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      return petWin?.getBounds() ?? { x: 100, y: 100, width: 200, height: 200 };
    });

    const bgWin = startBackgroundWindow();
    const screenshotPath = path.join(tmpUserData, 'composed-desktop.png');

    // The pet is withheld from other applications' capture streams, which is exactly
    // what an operating-system screen grab is. Lift it for the duration of the grab,
    // otherwise this check measures the capture exclusion instead of the stacking order.
    await setPetContentProtection(false);

    try {
      await waitForBackgroundWindow(screenshotPath);

      const composedBuffer = captureComposedScreen(screenshotPath);
      expect(composedBuffer.length).toBeGreaterThan(0);

      const analysis = analyzeComposedRegion(composedBuffer, petBounds);
      console.log('TOPMOST ANALYSIS:', analysis);
      expect(analysis.hasPetBody).toBe(true);
      expect(analysis.hasBackgroundThroughTransparentPadding).toBe(true);
    } finally {
      bgWin.stop();
      await setPetContentProtection(true);
    }
  });
});
