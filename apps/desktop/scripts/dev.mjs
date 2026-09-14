import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import process from 'node:process';

function waitForUrl(urlStr, timeoutMs = 15000) {
  const parsedUrl = new URL(urlStr);
  const start = Date.now();

  return new Promise((resolve, reject) => {
    function tryConnect() {
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: 'GET',
          timeout: 1000,
        },
        res => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            retry();
          }
        }
      );

      req.on('error', () => {
        retry();
      });

      req.on('timeout', () => {
        req.destroy();
        retry();
      });

      req.end();
    }

    function retry() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for URL: ${urlStr}`));
      } else {
        setTimeout(tryConnect, 300);
      }
    }

    tryConnect();
  });
}

async function dev() {
  console.log('[desktop:dev] Building main and preload once before starting...');
  const buildMain = spawnSync(
    'pnpm',
    [
      'exec',
      'tsup',
      'main/index.ts',
      '--format',
      'cjs',
      '--out-dir',
      'dist/main',
      '--external',
      'electron',
      '--external',
      'better-sqlite3',
      '--external',
      '@desktop-assistant/win32-window',
      '--external',
      '@desktop-assistant/macos-window',
      '--external',
      '@desktop-assistant/credential-store',
      '--target',
      'node22',
    ],
    { stdio: 'inherit', shell: true }
  );
  if (buildMain.status !== 0) process.exit(buildMain.status ?? 1);

  const buildPreload = spawnSync(
    'pnpm',
    [
      'exec',
      'tsup',
      'preload/index.ts',
      '--format',
      'cjs',
      '--out-dir',
      'dist/preload',
      '--external',
      'electron',
      '--target',
      'node22',
    ],
    { stdio: 'inherit', shell: true }
  );
  if (buildPreload.status !== 0) process.exit(buildPreload.status ?? 1);

  console.log('[desktop:dev] Starting Vite dev servers...');
  const petVite = spawn('pnpm', ['exec', 'vite', '--config', 'vite.pet.config.ts'], {
    stdio: 'inherit',
  });
  const appVite = spawn('pnpm', ['exec', 'vite', '--config', 'vite.app.config.ts'], {
    stdio: 'inherit',
  });

  const children = [petVite, appVite];
  const cleanup = () => {
    for (const child of children) {
      try {
        child.kill();
      } catch (err) {
        console.warn('Failed to kill child process:', err);
      }
    }
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  console.log('[desktop:dev] Waiting for Vite dev servers on ports 5173 and 5174...');
  await Promise.all([waitForUrl('http://localhost:5173'), waitForUrl('http://localhost:5174')]);

  console.log('[desktop:dev] Starting Electron with DevTools port 9200...');
  const env = {
    ...process.env,
    VITE_DEV_SERVER_URL_PET: 'http://localhost:5173',
    VITE_DEV_SERVER_URL_APP: 'http://localhost:5174',
  };

  const electronProcess = spawn('pnpm', ['exec', 'electron', '.', '--remote-debugging-port=9200'], {
    stdio: 'inherit',
    env,
  });

  electronProcess.on('exit', code => {
    cleanup();
    process.exit(code ?? 0);
  });
}

dev().catch(err => {
  console.error('[desktop:dev] Failed:', err);
  process.exit(1);
});
