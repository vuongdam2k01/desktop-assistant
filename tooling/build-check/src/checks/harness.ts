import fs from 'node:fs';
import path from 'node:path';

export function checkHarnessPin(repoRoot: string): void {
  const desktopPkgPath = path.resolve(repoRoot, 'apps/desktop/package.json');
  if (!fs.existsSync(desktopPkgPath)) {
    throw new Error(`HARNESS_PIN_VIOLATION: apps/desktop/package.json not found at ${desktopPkgPath}`);
  }

  const desktopPkgRaw = fs.readFileSync(desktopPkgPath, 'utf8');
  let desktopPkg: unknown;
  try {
    desktopPkg = JSON.parse(desktopPkgRaw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`HARNESS_PIN_VIOLATION: Failed to parse apps/desktop/package.json: ${msg}`, { cause: err });
  }

  if (!desktopPkg || typeof desktopPkg !== 'object') {
    throw new Error(`HARNESS_PIN_VIOLATION: apps/desktop/package.json is not an object`);
  }

  const pkgObj = desktopPkg as Record<string, unknown>;
  const deps = (pkgObj.dependencies ?? {}) as Record<string, unknown>;

  const expectedPins: Record<string, string> = {
    '@earendil-works/pi-agent-core': '0.85.1',
    '@earendil-works/pi-ai': '0.85.1',
  };

  for (const [pkgName, expectedVer] of Object.entries(expectedPins)) {
    const actualVer = deps[pkgName];
    if (actualVer !== expectedVer) {
      throw new Error(
        `HARNESS_PIN_VIOLATION: Expected ${pkgName} to be pinned to exact "${expectedVer}" in apps/desktop/package.json, got "${String(actualVer)}"`
      );
    }
  }

  // Scan all package.json files and pnpm-lock.yaml for forbidden @oh-my-pi/
  function scanDirForPkgJsons(dir: string): string[] {
    let res: string[] = [];
    if (!fs.existsSync(dir)) return res;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        res = res.concat(scanDirForPkgJsons(full));
      } else if (entry.name === 'package.json') {
        res.push(full);
      }
    }
    return res;
  }

  const pkgJsonFiles = scanDirForPkgJsons(repoRoot);
  for (const pkgFile of pkgJsonFiles) {
    const content = fs.readFileSync(pkgFile, 'utf8');
    if (content.includes('@oh-my-pi/')) {
      throw new Error(
        `HARNESS_PIN_VIOLATION: Forbidden @oh-my-pi/* reference found in ${path.relative(repoRoot, pkgFile)}`
      );
    }
  }

  const lockPath = path.resolve(repoRoot, 'pnpm-lock.yaml');
  if (fs.existsSync(lockPath)) {
    const lockContent = fs.readFileSync(lockPath, 'utf8');
    if (lockContent.includes('@oh-my-pi/')) {
      throw new Error(
        `HARNESS_PIN_VIOLATION: Forbidden @oh-my-pi/* resolution found in pnpm-lock.yaml`
      );
    }

    // Verify resolved versions in pnpm-lock.yaml
    const coreMatches = [...lockContent.matchAll(/@earendil-works\/pi-agent-core(?:@|\/)([0-9a-zA-Z.-]+)/g)];
    for (const m of coreMatches) {
      if (m[1] && m[1] !== '0.85.1') {
        throw new Error(
          `HARNESS_PIN_VIOLATION: pnpm-lock.yaml resolved @earendil-works/pi-agent-core@${m[1]}, expected only 0.85.1`
        );
      }
    }

    const aiMatches = [...lockContent.matchAll(/@earendil-works\/pi-ai(?:@|\/)([0-9a-zA-Z.-]+)/g)];
    for (const m of aiMatches) {
      if (m[1] && m[1] !== '0.85.1') {
        throw new Error(
          `HARNESS_PIN_VIOLATION: pnpm-lock.yaml resolved @earendil-works/pi-ai@${m[1]}, expected only 0.85.1`
        );
      }
    }
  }
}
