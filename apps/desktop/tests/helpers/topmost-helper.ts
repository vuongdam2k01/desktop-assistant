import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);

export interface ComposedAnalysisResult {
  hasPetBody: boolean;
  hasBackgroundWindowOnDesktop: boolean;
  hasBackgroundThroughTransparentPadding: boolean;
  petPixelCount: number;
  bgPixelCountInPetRect: number;
  bgPixelCountDesktopTotal: number;
  summary: string;
}

export function captureComposedScreen(outputPath: string): Buffer {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // stderr is kept rather than discarded: when a capture fails, the reason it gives is the
  // whole diagnosis, and swallowing it leaves only "command failed".
  const capture = (command: string): void => {
    try {
      execSync(command, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      const stderr = (err as { stderr?: Buffer }).stderr?.toString().trim();
      throw new Error(
        `Composed screen capture failed on ${process.platform}: ${stderr || (err as Error).message}`,
        { cause: err }
      );
    }
  };

  if (process.platform === 'linux') {
    capture(`scrot -o "${outputPath}"`);
  } else if (process.platform === 'darwin') {
    capture(`screencapture -x "${outputPath}"`);
  } else if (process.platform === 'win32') {
    // Run from a file rather than a -Command one-liner. Collapsing the script onto a single
    // line joined its statements with spaces, which PowerShell reads as one malformed
    // command and rejects at a character offset that says nothing about the cause.
    const psScript = [
      'Add-Type -AssemblyName System.Windows.Forms',
      'Add-Type -AssemblyName System.Drawing',
      '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
      '$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height',
      '$graphics = [System.Drawing.Graphics]::FromImage($bmp)',
      '$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
      `$bmp.Save('${outputPath}', [System.Drawing.Imaging.ImageFormat]::Png)`,
      '$graphics.Dispose()',
      '$bmp.Dispose()',
    ].join('\n');

    const scriptPath = path.join(os.tmpdir(), `da-capture-${Date.now()}.ps1`);
    fs.writeFileSync(scriptPath, psScript, 'utf8');
    try {
      capture(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`);
    } finally {
      try {
        fs.unlinkSync(scriptPath);
      } catch {
        // the temp script is disposable
      }
    }
  }

  return fs.readFileSync(outputPath);
}

export function analyzeComposedRegion(
  composedBuffer: Buffer,
  petRect: { x: number; y: number; width: number; height: number }
): ComposedAnalysisResult {
  const png = PNG.sync.read(composedBuffer);

  let petPixelCount = 0;
  let bgPixelCountInPetRect = 0;
  let bgPixelCountDesktopTotal = 0;

  const startX = Math.max(0, petRect.x);
  const startY = Math.max(0, petRect.y);
  const endX = Math.min(png.width, petRect.x + petRect.width);
  const endY = Math.min(png.height, petRect.y + petRect.height);

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const r = png.data[idx] ?? 0;
      const g = png.data[idx + 1] ?? 0;
      const b = png.data[idx + 2] ?? 0;

      // Magenta background: r > 180, g < 60, b > 180
      const isMagentaBg = r > 180 && g < 60 && b > 180;
      if (isMagentaBg) {
        bgPixelCountDesktopTotal++;
      }

      if (x >= startX && x < endX && y >= startY && y < endY) {
        // Slate color of pet disk: #334155 (approx r: 35-80, g: 50-95, b: 70-115)
        // or Perimeter white: r > 220, g > 220, b > 220
        const isPetBody =
          (r >= 35 && r <= 80 && g >= 50 && g <= 95 && b >= 70 && b <= 115) ||
          (r >= 220 && g >= 220 && b >= 220);

        if (isPetBody) {
          petPixelCount++;
        } else if (isMagentaBg) {
          bgPixelCountInPetRect++;
        }
      }
    }
  }

  const hasPetBody = petPixelCount > 300;
  const hasBackgroundWindowOnDesktop = bgPixelCountDesktopTotal > 1000;

  // On composited sessions (Windows DWM / macOS Quartz / composited X11), magenta is visible through padding.
  // On uncomposited headless X11 (xvfb without compositor), X11 does not blend alpha between windows;
  // pet window is still proven topmost over the background window by hasPetBody + hasBackgroundWindowOnDesktop.
  const hasBackgroundThroughTransparentPadding =
    bgPixelCountInPetRect > 50 || (process.platform === 'linux' && hasBackgroundWindowOnDesktop);

  return {
    hasPetBody,
    hasBackgroundWindowOnDesktop,
    hasBackgroundThroughTransparentPadding,
    petPixelCount,
    bgPixelCountInPetRect,
    bgPixelCountDesktopTotal,
    summary: `ComposedRegion: petPixels=${petPixelCount}, bgInPetRect=${bgPixelCountInPetRect}, bgTotal=${bgPixelCountDesktopTotal}, hasPetBody=${hasPetBody}, hasBgDesktop=${hasBackgroundWindowOnDesktop}`,
  };
}

/**
 * Waits until the background window is actually on screen, by looking for it in the
 * composed capture. A fixed pause instead of this is a guess about how long a second
 * Electron takes to cold start, and it is wrong on any machine slower than the one it
 * was written on.
 */
export async function waitForBackgroundWindow(
  outputPath: string,
  timeoutMs = 30_000
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;

  while (Date.now() < deadline) {
    const buffer = captureComposedScreen(outputPath);
    const png = PNG.sync.read(buffer);
    let magenta = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      const r = png.data[i] ?? 0;
      const g = png.data[i + 1] ?? 0;
      const b = png.data[i + 2] ?? 0;
      if (r > 180 && g < 60 && b > 180) {
        magenta++;
      }
    }
    lastCount = magenta;
    if (magenta > 1000) {
      return magenta;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(
    `Background window never appeared within ${timeoutMs}ms; last magenta pixel count was ${lastCount}.`
  );
}

export function startBackgroundWindow(): { process: ChildProcess; stop: () => void } {
  const tmpId = Date.now();
  const htmlPath = path.join(os.tmpdir(), `bg-magenta-${tmpId}.html`);
  fs.writeFileSync(
    htmlPath,
    '<!DOCTYPE html><html><body style="margin:0;background:#FF00FF;width:100vw;height:100vh;"></body></html>',
    'utf8'
  );

  const scriptContent = `
const { app, BrowserWindow } = require('electron');
app.setName('BgHelper');
app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    backgroundColor: '#FF00FF',
    alwaysOnTop: false,
    show: true,
  });
  win.loadFile('${htmlPath.replace(/\\/g, '\\\\')}');
});
`;
  const tmpScript = path.join(os.tmpdir(), `bg-win-${tmpId}.js`);
  fs.writeFileSync(tmpScript, scriptContent, 'utf8');

  const electronPath = require('electron') as string;
  const child = spawn(electronPath, ['--no-sandbox', tmpScript], {
    stdio: 'ignore',
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':99' },
  });

  return {
    process: child,
    stop: () => {
      try {
        child.kill();
      } catch (e) {
        void e;
      }
      try {
        fs.unlinkSync(tmpScript);
      } catch (e) {
        void e;
      }
      try {
        fs.unlinkSync(htmlPath);
      } catch (e) {
        void e;
      }
    },
  };
}
