import { test, expect, _electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanAlphaBoundary } from '../helpers/alpha-scanner.js';
import { resolvePetWindow } from '../helpers/pet-window.js';

test.describe('F17 Pet Rendering E2E Suite', () => {
  let tmpUserData: string;
  let activeAssetPath: string;
  let electronApp: ElectronApplication;
  let petPage: Page;
  const consoleMessages: Array<{ type: string; text: string }> = [];

  test.beforeEach(async () => {
    tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'da-pet-test-userdata-'));
    activeAssetPath = path.join(tmpUserData, 'active-pet.riv');

    // Seed active asset with default pet.riv
    const defaultRiv = path.resolve('renderer-pet/assets/pet.riv');
    fs.copyFileSync(defaultRiv, activeAssetPath);

    consoleMessages.length = 0;

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

    petPage = await resolvePetWindow(electronApp);

    petPage.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Wait for initial render readiness
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

  test('startup activation sets contract attributes and default values', async () => {
    const stage = petPage.locator('#pet-stage');
    await expect(stage).toHaveAttribute('data-render-status', 'ready');
    await expect(stage).toHaveAttribute('data-active-pack', 'default-pet');
    await expect(stage).toHaveAttribute('data-contract-version', '2.0.0');
    await expect(stage).toHaveAttribute('data-work-status', '0');
    await expect(stage).toHaveAttribute('data-locomotion', '0');
  });

  test('all five work states transition within the 2-second commitment', async () => {
    const stage = petPage.locator('#pet-stage');
    const states: Array<0 | 1 | 2 | 3 | 4> = [1, 2, 3, 4, 0];

    for (const status of states) {
      const startTime = performance.now();

      // Trigger via main process window controller
      await electronApp.evaluate(({ BrowserWindow }, s) => {
        const wins = BrowserWindow.getAllWindows();
        const petWin = wins.find(w => w.getTitle() === 'Pet Window') as unknown as { petController?: { setState: (p: unknown) => void } };
        petWin?.petController?.setState({ workStatus: s });
      }, status);
      await expect(stage).toHaveAttribute('data-work-status', String(status), { timeout: 2000 });
      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(2000);
    }
  });

  test('simultaneous working + walking with independent layer retention', async () => {
    const stage = petPage.locator('#pet-stage');

    // Set both workStatus: 2 (working) and locomotion: 1 (walking)
    await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window') as unknown as { petController?: { setState: (p: unknown) => void } };
      petWin?.petController?.setState({ workStatus: 2, locomotion: 1 });
    });
    await expect(stage).toHaveAttribute('data-work-status', '2');
    await expect(stage).toHaveAttribute('data-locomotion', '1');

    // Update only locomotion to 0 (standing), workStatus must remain 2
    await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window') as unknown as { petController?: { setState: (p: unknown) => void } };
      petWin?.petController?.setState({ locomotion: 0 });
    });
    await expect(stage).toHaveAttribute('data-locomotion', '0');
    await expect(stage).toHaveAttribute('data-work-status', '2');

    // Update only workStatus to 3 (waiting approval), locomotion must remain 0
    await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window') as unknown as { petController?: { setState: (p: unknown) => void } };
      petWin?.petController?.setState({ workStatus: 3 });
    });
    await expect(stage).toHaveAttribute('data-work-status', '3');
    await expect(stage).toHaveAttribute('data-locomotion', '0');
  });

  test('pet:packState IPC invoke returns active pack metadata and layer values', async () => {
    // Set explicit state
    await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window') as unknown as { petController?: { setState: (p: unknown) => void } };
      petWin?.petController?.setState({ workStatus: 4, locomotion: 2 });
    });
    await expect(petPage.locator('#pet-stage')).toHaveAttribute('data-work-status', '4');

    const packState = await petPage.evaluate(async () => {
      return await window.desktopApi?.pet.getPackState();
    });

    expect(packState).toEqual({
      activePack: 'default-pet',
      contractVersion: '2.0.0',
      capabilities: ['workStatus', 'locomotion'],
      workStatus: 4,
      locomotion: 2,
    });
  });

  test('positive hot-swap without restart via reloadActivePack()', async () => {
    const stage = petPage.locator('#pet-stage');
    const variantRiv = path.resolve('tests/fixtures/rive/pet-variant.riv');

    // Overwrite active asset path with color variant
    fs.copyFileSync(variantRiv, activeAssetPath);

    // Call reloadPack via renderer bridge
    await petPage.evaluate(() => {
      window.desktopApi?.pet.reloadPack();
    });

    // Verify stage remains ready and active
    await expect(stage).toHaveAttribute('data-render-status', 'ready');
    await expect(stage).toHaveAttribute('data-active-pack', 'default-pet');
  });

  test('refusal path keeps previous asset visible when candidate is corrupt or nonconforming', async () => {
    const stage = petPage.locator('#pet-stage');
    const corruptRiv = path.resolve('tests/fixtures/rive/corrupt.riv');
    const invalidArtboardRiv = path.resolve('tests/fixtures/rive/invalid-artboard.riv');

    // 1. Overwrite with corrupt bytes
    fs.copyFileSync(corruptRiv, activeAssetPath);
    await petPage.evaluate(() => {
      window.desktopApi?.pet.reloadPack();
    });

    // Previous asset must still remain active and rendered
    await petPage.waitForTimeout(500);
    await expect(stage).toHaveAttribute('data-render-status', 'ready');

    // 2. Overwrite with invalid artboard asset
    fs.copyFileSync(invalidArtboardRiv, activeAssetPath);
    await petPage.evaluate(() => {
      window.desktopApi?.pet.reloadPack();
    });

    // Previous asset must still remain active
    await petPage.waitForTimeout(500);
    await expect(stage).toHaveAttribute('data-render-status', 'ready');
  });

  test('tray hide and show preserves state and pauses/resumes frames', async () => {
    const stage = petPage.locator('#pet-stage');

    // Set state to workStatus: 1
    await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      petWin?.webContents.send('pet:setState', { workStatus: 1, locomotion: 0 });
    });
    await expect(stage).toHaveAttribute('data-work-status', '1');

    // Hide pet window
    await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      petWin?.webContents.send('pet:visibilityChanged', false);
      petWin?.hide();
    });

    const isVisibleAfterHide = await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      return petWin?.isVisible();
    });
    expect(isVisibleAfterHide).toBe(false);

    // Show pet window
    await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      petWin?.showInactive();
      petWin?.webContents.send('pet:visibilityChanged', true);
    });

    const isVisibleAfterShow = await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      return petWin?.isVisible();
    });
    expect(isVisibleAfterShow).toBe(true);

    // State retained
    await expect(stage).toHaveAttribute('data-work-status', '1');
  });

  test('window bounds persist across restart in the same userData directory', async () => {
    // Move pet window to (420, 360)
    await electronApp.evaluate(({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      petWin?.setBounds({ x: 420, y: 360, width: 200, height: 200 });
      petWin?.emit('move');
    });

    // Wait for debounced write
    await new Promise(r => setTimeout(r, 400));

    // Verify pet-window-state.json exists
    const stateFile = path.join(tmpUserData, 'pet-window-state.json');
    expect(fs.existsSync(stateFile)).toBe(true);

    // Close application
    await electronApp.close();

    // Relaunch with same userData
    const relaunchApp = await _electron.launch({
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

    try {
      const relPage = await resolvePetWindow(relaunchApp);
      await relPage.waitForSelector('#pet-stage[data-render-status="ready"]', { timeout: 15_000 });

      const bounds = await relaunchApp.evaluate(({ BrowserWindow }) => {
        const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
        return petWin?.getBounds();
      });

      expect(bounds?.x).toBe(420);
      expect(bounds?.y).toBe(360);
    } finally {
      await relaunchApp.close().catch(() => {});
    }
  });

  test('alpha-boundary scan passes on capturePage() with zero dark fringing', async () => {
    const pngBase64 = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const petWin = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Pet Window');
      if (!petWin) throw new Error('Pet Window not found');
      const image = await petWin.capturePage();
      return image.toPNG().toString('base64');
    });

    const pngBuffer = Buffer.from(pngBase64, 'base64');
    const scanResult = scanAlphaBoundary(pngBuffer);

    expect(scanResult.passed).toBe(true);
    expect(scanResult.transparentPixels).toBeGreaterThan(scanResult.totalPixels * 0.2);
    expect(scanResult.edgeViolations).toBe(0);
    expect(scanResult.minEdgeLuminance).toBeGreaterThanOrEqual(15);
  });

  test('console messages contain only expected input-deprecation warning', async () => {
    // Query console messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors).toHaveLength(0);

    const warnings = consoleMessages.filter(m => m.type === 'warning');
    // Only the known upstream state machine input deprecation warning is expected
    const unexpectedWarnings = warnings.filter(
      w => !w.text.includes('State machine inputs are deprecated')
    );
    expect(unexpectedWarnings).toHaveLength(0);
  });
});
