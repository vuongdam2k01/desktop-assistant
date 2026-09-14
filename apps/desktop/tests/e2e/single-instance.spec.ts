import { test, expect, _electron, type ElectronApplication } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolvePetWindow } from '../helpers/pet-window.js';

const require = createRequire(import.meta.url);

const SECOND_INSTANCE_BUDGET_MS = 10_000;
const ALREADY_RUNNING_NOTICE = 'Another DesktopAssistant instance already owns this profile';

/**
 * The profile directory holds the local database that is the authoritative working
 * copy on this device. Two processes must never open it at once, so an instance
 * that does not own the profile has to stop before any module registers, not merely
 * ask the application to quit while boot carries on around it.
 */
test.describe('Profile ownership', () => {
  let tmpUserData: string;
  let activeAssetPath: string;
  let firstInstance: ElectronApplication;

  test.beforeEach(async () => {
    tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'da-profile-owner-'));
    activeAssetPath = path.join(tmpUserData, 'active-pet.riv');
    fs.copyFileSync(path.resolve('renderer-pet/assets/pet.riv'), activeAssetPath);

    firstInstance = await _electron.launch({
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

    const petPage = await resolvePetWindow(firstInstance);
    await petPage.waitForSelector('#pet-stage[data-render-status="ready"]', { timeout: 15_000 });
  });

  test.afterEach(async () => {
    if (firstInstance) {
      await firstInstance.close().catch(() => {});
    }
    if (fs.existsSync(tmpUserData)) {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    }
  });

  test('a second instance on the same profile stops before any module registers', async () => {
    const electronPath = require('electron') as string;

    const second = spawn(electronPath, ['--no-sandbox', 'dist/main/index.cjs'], {
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        CI: '1',
        DESKTOP_ASSISTANT_SOFTWARE_RENDERING: '1',
        DESKTOP_ASSISTANT_E2E: '1',
        DESKTOP_ASSISTANT_TEST_PET_ASSET_PATH: activeAssetPath,
        DESKTOP_ASSISTANT_USER_DATA: tmpUserData,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    second.stdout.on('data', chunk => {
      output += String(chunk);
    });
    second.stderr.on('data', chunk => {
      output += String(chunk);
    });

    const exited = await new Promise<boolean>(resolve => {
      const timer = setTimeout(() => {
        second.kill('SIGKILL');
        resolve(false);
      }, SECOND_INSTANCE_BUDGET_MS);
      second.on('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
    });

    expect(exited, `second instance did not exit within ${SECOND_INSTANCE_BUDGET_MS}ms`).toBe(true);
    expect(output).toContain(ALREADY_RUNNING_NOTICE);
    expect(
      output,
      `second instance carried on booting instead of standing down:\n${output}`
    ).not.toContain('Fatal boot error');
  });
});
