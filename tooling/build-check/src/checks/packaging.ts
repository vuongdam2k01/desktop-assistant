import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type * as AsarModule from '@electron/asar';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar') as typeof AsarModule;
export function checkStaticPackaging(repoRoot: string): void {
  const configPath = path.resolve(repoRoot, 'apps/desktop/electron-builder.yml');
  if (!fs.existsSync(configPath)) {
    throw new Error(`NATIVE_PACKAGING_VIOLATION: apps/desktop/electron-builder.yml not found at ${configPath}`);
  }

  const rawContent = fs.readFileSync(configPath, 'utf8');

  // Static checks
  // 1. asar: true
  if (!/^\s*asar:\s*true\b/m.test(rawContent)) {
    throw new Error(`NATIVE_PACKAGING_VIOLATION: electron-builder.yml must have "asar: true"`);
  }

  // 2. asarUnpack: ['**/*.node']
  const asarUnpackRegex = /asarUnpack:\s*(?:\[\s*['"]\*\*\/\*\.node['"]\s*\]|(?:\n\s*-\s*['"]\*\*\/\*\.node['"]))/;
  if (!asarUnpackRegex.test(rawContent)) {
    throw new Error(
      `NATIVE_PACKAGING_VIOLATION: electron-builder.yml must specify asarUnpack including "**/*.node"`
    );
  }

  // 3. npmRebuild: false
  if (!/^\s*npmRebuild:\s*false\b/m.test(rawContent)) {
    throw new Error(`NATIVE_PACKAGING_VIOLATION: electron-builder.yml must have "npmRebuild: false"`);
  }

  // 4. mac.x64ArchFiles: '*.node'
  const macX64Regex = /x64ArchFiles:\s*['"]\*\.node['"]/;
  if (!macX64Regex.test(rawContent)) {
    throw new Error(
      `NATIVE_PACKAGING_VIOLATION: electron-builder.yml must have mac.x64ArchFiles set to "*.node"`
    );
  }

  // 5. extraResources: assets/pet.riv
  if (!rawContent.includes('assets/pet.riv')) {
    throw new Error(
      `NATIVE_PACKAGING_VIOLATION: electron-builder.yml must specify extraResources mapping to "assets/pet.riv"`
    );
  }
}

function findAppAsar(artifactDir: string): string | null {
  function search(dir: string, depth: number): string | null {
    if (depth > 6) return null;
    if (!fs.existsSync(dir)) return null;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === 'app.asar') {
        return full;
      }
      if (entry.isDirectory()) {
        const found = search(full, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  return search(artifactDir, 0);
}

function findPhysicalNodeFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findPhysicalNodeFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.node')) {
      results.push(full);
    }
  }
  return results;
}

export function checkArtifactPackaging(artifactPath: string): void {
  const resolvedArtifact = path.resolve(artifactPath);
  if (!fs.existsSync(resolvedArtifact)) {
    throw new Error(`NATIVE_PACKAGING_VIOLATION: Artifact directory not found at ${resolvedArtifact}`);
  }

  const appAsarPath = findAppAsar(resolvedArtifact);
  if (!appAsarPath) {
    throw new Error(
      `NATIVE_PACKAGING_VIOLATION: app.asar not found within artifact directory ${resolvedArtifact}`
    );
  }

  const asarUnpackedDir = appAsarPath + '.unpacked';

  // List all entries in app.asar
  const asarEntries = asar.listPackage(appAsarPath, { isPack: false });
  const archivedNodeFiles: string[] = [];

  for (const entry of asarEntries) {
    const normalized = entry.replace(/\\/g, '/');
    if (normalized.endsWith('.node')) {
      archivedNodeFiles.push(normalized);
    }
  }

  // Verify that every archived .node file has its physical file in app.asar.unpacked
  for (const nodeFile of archivedNodeFiles) {
    // Strip leading slash if present
    const relPath = nodeFile.startsWith('/') ? nodeFile.slice(1) : nodeFile;
    const physicalPath = path.join(asarUnpackedDir, relPath);

    if (!fs.existsSync(physicalPath)) {
      throw new Error(
        `NATIVE_PACKAGING_VIOLATION: Native addon "${nodeFile}" exists in app.asar but is missing from unpacked directory: ${physicalPath}`
      );
    }
  }

  // Require at least one physical .node file in unpacked resources
  const physicalNodeFiles = findPhysicalNodeFiles(asarUnpackedDir);
  if (physicalNodeFiles.length === 0) {
    throw new Error(
      `NATIVE_PACKAGING_VIOLATION: No physical .node file found in unpacked directory: ${asarUnpackedDir}`
    );
  }

  // Verify pet.riv and local Rive WASM file when packaging desktop app
  const isDesktopApp = asarEntries.some(entry => {
    const normalized = entry.replace(/\\/g, '/');
    return normalized.includes('renderer-pet');
  });

  if (isDesktopApp) {
    const resourcesDir = path.dirname(appAsarPath);
    const petRivPath = path.join(resourcesDir, 'assets', 'pet.riv');
    if (!fs.existsSync(petRivPath)) {
      throw new Error(
        `NATIVE_PACKAGING_VIOLATION: Packed pet.riv asset missing from resources directory: ${petRivPath}`
      );
    }

    const hasRiveWasm = asarEntries.some(entry => {
      const normalized = entry.replace(/\\/g, '/');
      return normalized.includes('/assets/rive-') && normalized.endsWith('.wasm');
    });
    if (!hasRiveWasm) {
      throw new Error(
        `NATIVE_PACKAGING_VIOLATION: Rive WASM file missing from app.asar entries`
      );
    }
  }
}

export function checkPackaging(repoRoot: string, artifactPath?: string): void {
  checkStaticPackaging(repoRoot);
  if (artifactPath) {
    checkArtifactPackaging(artifactPath);
  }
}
