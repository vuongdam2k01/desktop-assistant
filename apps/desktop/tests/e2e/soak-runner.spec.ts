import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';

const READY_LINE = '[SOAK] Pet window ready and rendering.';
const STARTUP_BUDGET_MS = 60_000;

/**
 * The soak runner has to reach the pet window before it can sample anything.
 * The application opens a hidden card window before the pet window, so a runner
 * that takes whichever window the application reports first never reaches the
 * pet stage and the whole run dies on its first wait.
 */
test.describe('Soak runner startup', () => {
  test.setTimeout(STARTUP_BUDGET_MS + 30_000);

  test('reaches the pet window and enters the sampling loop', async () => {
    const scriptPath = path.resolve('scripts/run-soak.mjs');

    const child = spawn(process.execPath, [scriptPath, '--duration=1'], {
      cwd: path.resolve('.'),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });

    const reached = await new Promise<boolean>(resolve => {
      const deadline = setTimeout(() => resolve(false), STARTUP_BUDGET_MS);
      const poll = setInterval(() => {
        if (stdout.includes(READY_LINE)) {
          clearTimeout(deadline);
          clearInterval(poll);
          resolve(true);
        }
      }, 250);
      child.on('exit', () => {
        clearTimeout(deadline);
        clearInterval(poll);
        resolve(stdout.includes(READY_LINE));
      });
    });

    child.kill('SIGTERM');

    expect(reached, `soak runner never reached the pet window.\n${stdout}\n${stderr}`).toBe(true);
  });
});
