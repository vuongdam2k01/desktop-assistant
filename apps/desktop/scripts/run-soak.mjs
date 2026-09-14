/* global document */
import { _electron } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import {
  resolveWindowByUrlMarker,
  PET_RENDERER_URL_MARKER,
} from '../tests/helpers/window-locator.mjs';

function parseDurationMinutes() {
  const arg = process.argv.find(a => a.startsWith('--duration='));
  if (arg) {
    const val = parseInt(arg.split('=')[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 480; // 8 hours default
}

function computeMedian(numbers) {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const durationMinutes = parseDurationMinutes();
  const sampleIntervalMs = 5 * 60 * 1000; // 5 minutes
  console.log(`[SOAK] Starting pet rendering soak test for ${durationMinutes} minutes...`);

  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'da-soak-userdata-'));
  const activeAssetPath = path.join(tmpUserData, 'active-pet.riv');
  fs.copyFileSync(path.resolve('renderer-pet/assets/pet.riv'), activeAssetPath);

  const mainPath = path.resolve('dist/main/index.cjs');
  if (!fs.existsSync(mainPath)) {
    console.error(`[SOAK] dist/main/index.cjs missing at ${mainPath}. Run pnpm build first.`);
    process.exit(1);
  }

  const electronApp = await _electron.launch({
    args: [mainPath],
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

  let petPage;
  try {
    petPage = await resolveWindowByUrlMarker(electronApp, PET_RENDERER_URL_MARKER);
    await petPage.waitForSelector('#pet-stage[data-render-status="ready"]', { timeout: 15_000 });
  } catch (err) {
    await electronApp.close().catch(() => {});
    if (fs.existsSync(tmpUserData)) {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    }
    throw err;
  }
  console.log('[SOAK] Pet window ready and rendering. Entering epoch loop...');

  const startTime = Date.now();
  const durationMs = durationMinutes * 60 * 1000;
  const samples = [];

  let lastSampleTime = 0;
  let epochCounter = 0;
  let currentEpoch = 'active';
  let epochSwitchTime = startTime;

  try {
    while (Date.now() - startTime < durationMs) {
      const now = Date.now();
      const elapsedMinutes = (now - startTime) / 60_000;

      // Switch epoch every 2 minutes (alternate active / idle)
      if (now - epochSwitchTime > 120_000) {
        currentEpoch = currentEpoch === 'active' ? 'idle' : 'active';
        epochSwitchTime = now;
        console.log(`[SOAK] [${elapsedMinutes.toFixed(1)}m] Switched epoch to: ${currentEpoch}`);
      }

      if (currentEpoch === 'active') {
        epochCounter++;
        const nextWork = epochCounter % 5;
        const nextLoco = epochCounter % 4;

        await electronApp.evaluate(({ BrowserWindow }, { w, l }) => {
          const wins = BrowserWindow.getAllWindows();
          const petWin = wins.find(win => win.getTitle() === 'Pet Window');
          petWin?.petController?.setState({ workStatus: w, locomotion: l });
        }, { w: nextWork, l: nextLoco });
      }

      if (now - lastSampleTime >= sampleIntervalMs || samples.length === 0) {
        lastSampleTime = now;

        const mainMetrics = await electronApp.evaluate(({ app }) => {
          const metrics = app.getAppMetrics();
          const mainProcess = metrics.find(m => m.type === 'Browser');
          const rendererProcess = metrics.find(m => m.type === 'Tab');
          return {
            mainRss: mainProcess?.memory.workingSetSize ?? 0,
            rendererRss: rendererProcess?.memory.workingSetSize ?? 0,
          };
        });

        const rendererData = await petPage.evaluate(() => {
          const stage = document.getElementById('pet-stage');
          const fps = parseInt(stage?.getAttribute('data-fps') || '0', 10);
          return { fps };
        });

        const sample = {
          timestampMs: now,
          elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
          epochType: currentEpoch,
          mainRssMb: Math.round((mainMetrics.mainRss / 1024) * 10) / 10,
          rendererRssMb: Math.round((mainMetrics.rendererRss / 1024) * 10) / 10,
          fps: rendererData.fps,
        };
        samples.push(sample);
        console.log(`[SOAK] Sample ${samples.length}: ${JSON.stringify(sample)}`);
      }

      await new Promise(r => setTimeout(r, 5000));
    }
  } finally {
    await electronApp.close().catch(() => {});
    if (fs.existsSync(tmpUserData)) {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    }
  }

  // Calculate hourly medians
  const hourlyBuckets = [];
  for (const sample of samples) {
    const hour = Math.floor(sample.elapsedMinutes / 60);
    if (!hourlyBuckets[hour]) hourlyBuckets[hour] = [];
    hourlyBuckets[hour].push(sample.mainRssMb + sample.rendererRssMb);
  }

  const hourlyMemoryMediansMb = hourlyBuckets.map(b => computeMedian(b));
  let strictlyIncreasingMemory = false;
  if (hourlyMemoryMediansMb.length >= 3) {
    strictlyIncreasingMemory = true;
    for (let i = 2; i < hourlyMemoryMediansMb.length; i++) {
      if (hourlyMemoryMediansMb[i] <= hourlyMemoryMediansMb[i - 1]) {
        strictlyIncreasingMemory = false;
        break;
      }
    }
  }

  const passed = !strictlyIncreasingMemory && samples.length > 0;
  const report = {
    durationMinutes,
    sampleCount: samples.length,
    samples,
    hourlyMemoryMediansMb,
    strictlyIncreasingMemory,
    passed,
  };

  const outputDir = path.resolve('release');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const reportPath = path.join(outputDir, 'soak-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[SOAK] Soak run completed. Report written to ${reportPath}`);
  console.log(`[SOAK] Passed: ${passed}, Hourly Medians:`, hourlyMemoryMediansMb);

  if (!passed) {
    console.error('[SOAK] FAILED: Monotonically increasing memory observed across run.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[SOAK] Fatal error:', err);
  process.exit(1);
});
