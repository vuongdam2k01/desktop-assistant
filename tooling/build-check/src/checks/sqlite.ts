import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export function checkSqliteBinding(repoRoot: string): void {
  const desktopPkgPath = path.resolve(repoRoot, 'apps/desktop/package.json');
  if (!fs.existsSync(desktopPkgPath)) {
    throw new Error(`SQLITE_BINDING_VIOLATION: apps/desktop/package.json not found at ${desktopPkgPath}`);
  }

  const desktopPkgRaw = fs.readFileSync(desktopPkgPath, 'utf8');
  let desktopPkg: unknown;
  try {
    desktopPkg = JSON.parse(desktopPkgRaw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`SQLITE_BINDING_VIOLATION: Failed to parse apps/desktop/package.json: ${msg}`, { cause: err });
  }

  const pkgObj = (desktopPkg ?? {}) as Record<string, unknown>;
  const deps = (pkgObj.dependencies ?? {}) as Record<string, unknown>;

  const sqliteVer = deps['better-sqlite3'];
  if (sqliteVer !== '13.0.3') {
    throw new Error(
      `SQLITE_BINDING_VIOLATION: Expected better-sqlite3 to be pinned to exact "13.0.3", got "${String(sqliteVer)}"`
    );
  }

  // Check pnpm-lock.yaml for versions below major 13 or different versions
  const lockPath = path.resolve(repoRoot, 'pnpm-lock.yaml');
  if (fs.existsSync(lockPath)) {
    const lockContent = fs.readFileSync(lockPath, 'utf8');
    // Match better-sqlite3 package, excluding @types/better-sqlite3
    const sqliteMatches = [...lockContent.matchAll(/(?:^|[^@/a-zA-Z0-9_-])better-sqlite3(?:@|\/)([0-9a-zA-Z.-]+)/g)];
    for (const m of sqliteMatches) {
      const ver = m[1];
      if (!ver) continue;
      const major = parseInt(ver.split('.')[0] ?? '0', 10);
      if (major < 13) {
        throw new Error(
          `SQLITE_BINDING_VIOLATION: Found better-sqlite3 version below major 13 in pnpm-lock.yaml: ${ver}`
        );
      }
      if (ver !== '13.0.3') {
        throw new Error(
          `SQLITE_BINDING_VIOLATION: Found non-pinned better-sqlite3 version in pnpm-lock.yaml: ${ver}`
        );
      }
    }
  }

  // Find installed better-sqlite3 in node_modules (check local apps/desktop or monorepo virtual store)
  function findBetterSqliteDir(): string | null {
    const directPath = path.resolve(repoRoot, 'apps/desktop/node_modules/better-sqlite3');
    if (fs.existsSync(path.join(directPath, 'package.json'))) return directPath;

    const rootPath = path.resolve(repoRoot, 'node_modules/better-sqlite3');
    if (fs.existsSync(path.join(rootPath, 'package.json'))) return rootPath;

    const pnpmDir = path.resolve(repoRoot, 'node_modules/.pnpm');
    if (fs.existsSync(pnpmDir)) {
      for (const entry of fs.readdirSync(pnpmDir)) {
        if (entry.startsWith('better-sqlite3@13.0.3')) {
          const candidate = path.join(pnpmDir, entry, 'node_modules/better-sqlite3');
          if (fs.existsSync(path.join(candidate, 'package.json'))) {
            return candidate;
          }
        }
      }
    }
    return null;
  }

  const installedDir = findBetterSqliteDir();
  if (!installedDir) {
    throw new Error(
      `SQLITE_BINDING_VIOLATION: better-sqlite3@13.0.3 is not installed in node_modules.`
    );
  }

  const prebuildsDir = path.join(installedDir, 'prebuilds');
  if (!fs.existsSync(prebuildsDir)) {
    throw new Error(
      `SQLITE_BINDING_VIOLATION: Missing prebuilds directory in installed better-sqlite3 at ${prebuildsDir}`
    );
  }

  // Determine current platform/arch prebuild file
  const platform = process.platform;
  const arch = process.arch;
  const expectedPrebuildFile = `${platform}-${arch}.node`;
  const fullPrebuildPath = path.join(prebuildsDir, expectedPrebuildFile);

  if (!fs.existsSync(fullPrebuildPath)) {
    throw new Error(
      `SQLITE_BINDING_VIOLATION: Missing prebuilt native binding for current platform ${platform}-${arch} at ${fullPrebuildPath}`
    );
  }
}
