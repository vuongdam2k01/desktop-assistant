import { test, expect, _electron, type ElectronApplication } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolvePetWindow } from '../helpers/pet-window.js';
import {
  createPointerAlphaProvider,
  resolveBitmapDimensions,
} from '../../main/pet-window/pet-pointer-mask.js';

/**
 * The pointer mask is built from a real captured frame, and its unit tests can only use a
 * buffer this test file invented. This check feeds the mask logic an actual Electron
 * capture of the running pet, which is the part the unit tests cannot stand in for: that
 * the buffer's length is accounted for by the window's reported size, and that the alpha
 * channel really does describe the character against transparent padding.
 *
 * The native hit test itself needs Windows or macOS and is not exercised here.
 */
test.describe('Pointer mask from a real capture', () => {
  let tmpUserData: string;
  let electronApp: ElectronApplication;

  test.beforeEach(async () => {
    tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'da-pointer-mask-'));
    const activeAssetPath = path.join(tmpUserData, 'active-pet.riv');
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

  test('a live capture yields a mask that separates the character from its padding', async () => {
    const captured = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('renderer-pet'));
      if (!petWin) throw new Error('Pet Window not found');
      const image = await petWin.capturePage();
      const bitmap = image.toBitmap();
      const size = image.getSize();
      return {
        bitmapBase64: bitmap.toString('base64'),
        byteLength: bitmap.length,
        width: size.width,
        height: size.height,
      };
    });

    const dimensions = resolveBitmapDimensions(
      captured.byteLength,
      captured.width,
      captured.height
    );
    expect(
      dimensions,
      `a ${captured.byteLength}-byte capture of a ${captured.width}x${captured.height} window was not accounted for`
    ).not.toBeNull();

    const bitmap = Buffer.from(captured.bitmapBase64, 'base64');
    const provider = createPointerAlphaProvider(bitmap, dimensions!.width, dimensions!.height);

    let opaque = 0;
    let transparent = 0;
    for (let y = 0; y < provider.height; y++) {
      for (let x = 0; x < provider.width; x++) {
        const alpha = provider.getAlphaAt(x, y);
        if (alpha >= 10) {
          opaque++;
        } else {
          transparent++;
        }
      }
    }

    const total = provider.width * provider.height;
    expect(opaque).toBeGreaterThan(0);
    expect(transparent).toBeGreaterThan(total * 0.2);
    // The window's outermost corner is padding around the character in every pack.
    expect(provider.getAlphaAt(0, 0)).toBeLessThan(10);
  });
});
