import fs from 'node:fs';
import path from 'node:path';

function hasBom(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(3);
  const bytesRead = fs.readSync(fd, buf, 0, 3, 0);
  fs.closeSync(fd);

  if (bytesRead < 3) return false;
  return buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

function isConfigurationFile(filePath: string): boolean {
  const base = path.basename(filePath);

  // Manifests & lockfiles
  if (base.startsWith('package') && base.endsWith('.json')) return true;
  if (base === 'pnpm-lock.yaml' || base === 'pnpm-workspace.yaml') return true;
  if (base === 'turbo.json') return true;

  // TypeScript configs
  if (base.startsWith('tsconfig') && base.endsWith('.json')) return true;

  // Linters & formatters
  if (base.startsWith('eslint.config.') || base.startsWith('.prettier')) return true;
  if (base === '.gitignore' || base === '.npmrc' || base === '.nvmrc') return true;

  // Build & packaging configs
  if (base.startsWith('vite') && (base.endsWith('.ts') || base.endsWith('.js') || base.endsWith('.mjs'))) return true;
  if (base === 'electron-builder.yml' || base === 'electron-builder.yaml') return true;
  if (base === 'Cargo.toml' || base === 'build.rs') return true;
  if (base === 'binding.gyp') return true;

  // Docker & compose
  if (base === 'compose.yaml' || base === 'compose.yml' || base === 'docker-compose.yml') return true;
  if (base === '.env.example') return true;

  // GitHub workflows
  if (filePath.includes('.github' + path.sep + 'workflows') && (base.endsWith('.yml') || base.endsWith('.yaml'))) {
    return true;
  }

  return false;
}

export function checkBom(repoRoot: string): void {
  const violations: string[] = [];

  function scan(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');

      // Exclude non-F0 directories
      if (entry.isDirectory()) {
        if (
          relPath === 'node_modules' ||
          relPath.startsWith('node_modules/') ||
          relPath.includes('/node_modules/') ||
          relPath === '.git' ||
          relPath.startsWith('.git/') ||
          relPath === 'docs' ||
          relPath.startsWith('docs/') ||
          relPath === 'spikes' ||
          relPath.startsWith('spikes/') ||
          relPath === 'plugins' ||
          relPath.startsWith('plugins/') ||
          relPath === 'plans' ||
          relPath.startsWith('plans/') ||
          relPath.endsWith('/dist') ||
          relPath.includes('/dist/') ||
          relPath.endsWith('/build') ||
          relPath.includes('/build/') ||
          relPath.endsWith('/target') ||
          relPath.includes('/target/') ||
          relPath.endsWith('/release') ||
          relPath.includes('/release/') ||
          relPath.endsWith('/coverage') ||
          relPath.includes('/coverage/')
        ) {
          continue;
        }
        scan(fullPath);
      } else if (entry.isFile()) {
        if (isConfigurationFile(fullPath)) {
          if (hasBom(fullPath)) {
            violations.push(relPath);
          }
        }
      }
    }
  }

  scan(repoRoot);

  if (violations.length > 0) {
    throw new Error(
      `BOM_VIOLATION: UTF-8 BOM detected in ${violations.length} file(s):\n` +
        violations.map(v => `  - ${v}`).join('\n')
    );
  }
}
