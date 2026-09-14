import { _electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePetWindow } from './pet-window.js';

export interface SoakSample {
  timestampMs: number;
  elapsedMinutes: number;
  epochType: 'active' | 'idle';
  mainRssMb: number;
  rendererRssMb: number;
  isPaused: boolean;
  fps: number;
}

export interface SoakReport {
  durationMinutes: number;
  sampleCount: number;
  samples: SoakSample[];
  hourlyMemoryMediansMb: number[];
  strictlyIncreasingMemory: boolean;
  passed: boolean;
  error?: string;
}

export function computeMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midVal = sorted[mid] ?? 0;
  const midPrev = sorted[mid - 1] ?? 0;
  return sorted.length % 2 !== 0 ? midVal : (midPrev + midVal) / 2;
}

export async function runPetSoak(options: {
  durationMinutes: number;
  sampleIntervalMs?: number;
  appPath?: string;
  userDataDir: string;
  outputJsonPath: string;
}): Promise<SoakReport> {
  const durationMs = options.durationMinutes * 60 * 1000;
  const sampleIntervalMs = options.sampleIntervalMs ?? 5 * 60 * 1000; // 5 min default
  const samples: SoakSample[] = [];

  const mainPath = options.appPath ?? path.resolve('dist/main/index.cjs');

  const electronApp: ElectronApplication = await _electron.launch({
    args: [mainPath],
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      CI: '1',
      DESKTOP_ASSISTANT_SOFTWARE_RENDERING: '1',
    },
  });

  let petPage: Page;
  try {
    petPage = await resolvePetWindow(electronApp);
    await petPage.waitForSelector('#pet-stage[data-render-status="ready"]', { timeout: 15_000 });
  } catch (err) {
    await electronApp.close();
    throw new Error(`Soak startup failed: ${err}`, { cause: err });
  }

  const startTime = Date.now();
  let lastSampleTime = 0;
  let epochCounter = 0;
  let currentEpoch: 'active' | 'idle' = 'active';
  let epochSwitchTime = startTime;

  try {
    while (Date.now() - startTime < durationMs) {
      const now = Date.now();
      const elapsedMinutes = (now - startTime) / 60_000;

      // Switch epoch every 2 minutes (alternate active / idle)
      if (now - epochSwitchTime > 120_000) {
        currentEpoch = currentEpoch === 'active' ? 'idle' : 'active';
        epochSwitchTime = now;
      }

      if (currentEpoch === 'active') {
        // Active epoch: drive state every 10s to keep animation active and reset timer
        epochCounter++;
        const nextWork = (epochCounter % 5) as 0 | 1 | 2 | 3 | 4;
        const nextLoco = (epochCounter % 4) as 0 | 1 | 2 | 3;
        await petPage.evaluate(
          ({ work, loco }) => {
            // drive state through window event or directly on element
            const stage = document.getElementById('pet-stage');
            if (stage) {
              stage.setAttribute('data-work-status', String(work));
              stage.setAttribute('data-locomotion', String(loco));
            }
          },
          { work: nextWork, loco: nextLoco }
        );
      }

      // Sample memory and frame status
      if (now - lastSampleTime >= sampleIntervalMs || samples.length === 0) {
        lastSampleTime = now;

        const mainMetrics = await electronApp.evaluate(async ({ app }) => {
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

        samples.push({
          timestampMs: now,
          elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
          epochType: currentEpoch,
          mainRssMb: Math.round((mainMetrics.mainRss / 1024) * 10) / 10,
          rendererRssMb: Math.round((mainMetrics.rendererRss / 1024) * 10) / 10,
          isPaused: currentEpoch === 'idle' && rendererData.fps === 0,
          fps: rendererData.fps,
        });
      }

      // Sleep 5 seconds before next iteration
      await new Promise(r => setTimeout(r, 5000));
    }
  } finally {
    await electronApp.close().catch(() => {});
  }

  // Analyze hourly medians for post-warmup hours (hour 1 onwards)
  const hourlyBuckets: number[][] = [];
  for (const sample of samples) {
    const hour = Math.floor(sample.elapsedMinutes / 60);
    if (!hourlyBuckets[hour]) hourlyBuckets[hour] = [];
    hourlyBuckets[hour].push(sample.mainRssMb + sample.rendererRssMb);
  }

  const hourlyMemoryMediansMb = hourlyBuckets.map(b => computeMedian(b));

  // Check for strictly increasing post-warmup memory (starting from hour index 1)
  let strictlyIncreasingMemory = false;
  if (hourlyMemoryMediansMb.length >= 3) {
    strictlyIncreasingMemory = true;
    for (let i = 2; i < hourlyMemoryMediansMb.length; i++) {
      const curr = hourlyMemoryMediansMb[i] ?? 0;
      const prev = hourlyMemoryMediansMb[i - 1] ?? 0;
      if (curr <= prev) {
        strictlyIncreasingMemory = false;
        break;
      }
    }
  }

  const passed = !strictlyIncreasingMemory && samples.length > 0;

  const report: SoakReport = {
    durationMinutes: options.durationMinutes,
    sampleCount: samples.length,
    samples,
    hourlyMemoryMediansMb,
    strictlyIncreasingMemory,
    passed,
  };

  const outputDir = path.dirname(options.outputJsonPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(options.outputJsonPath, JSON.stringify(report, null, 2), 'utf8');

  return report;
}
