import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type * as AsarModule from '@electron/asar';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar') as typeof AsarModule;

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const cliPath = path.resolve(import.meta.dirname, '../dist/cli.js');

function runCli(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
  });
  return {
    exitCode: res.status ?? 1,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

describe('Build-check valid repository state', () => {
  it('passes all 4 checks on current valid repository', () => {
    const res = runCli(['all', '--repo-root', repoRoot]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('BUILD_CHECK_PASSED: all checks passed.');
  });
});

describe('HARNESS_PIN_VIOLATION negative tests', () => {
  it('fails with HARNESS_PIN_VIOLATION when harness package is mispinned', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-harness-neg-'));
    try {
      const desktopDir = path.join(tmp, 'apps/desktop');
      fs.mkdirSync(desktopDir, { recursive: true });
      fs.writeFileSync(
        path.join(desktopDir, 'package.json'),
        JSON.stringify({
          dependencies: {
            '@earendil-works/pi-agent-core': '0.84.0', // wrong version
            '@earendil-works/pi-ai': '0.85.1',
          },
        })
      );

      const res = runCli(['harness', '--repo-root', tmp]);
      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toContain('HARNESS_PIN_VIOLATION');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('fails with HARNESS_PIN_VIOLATION when forbidden @oh-my-pi/ resolution is present', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-omp-neg-'));
    try {
      const desktopDir = path.join(tmp, 'apps/desktop');
      fs.mkdirSync(desktopDir, { recursive: true });
      fs.writeFileSync(
        path.join(desktopDir, 'package.json'),
        JSON.stringify({
          dependencies: {
            '@earendil-works/pi-agent-core': '0.85.1',
            '@earendil-works/pi-ai': '0.85.1',
            '@oh-my-pi/forbidden': '1.0.0',
          },
        })
      );

      const res = runCli(['harness', '--repo-root', tmp]);
      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toContain('HARNESS_PIN_VIOLATION');
      expect(res.stderr).toContain('Forbidden @oh-my-pi/* reference found');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('SQLITE_BINDING_VIOLATION negative tests', () => {
  it('fails with SQLITE_BINDING_VIOLATION when better-sqlite3 is mispinned', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-sqlite-neg-'));
    try {
      const desktopDir = path.join(tmp, 'apps/desktop');
      fs.mkdirSync(desktopDir, { recursive: true });
      fs.writeFileSync(
        path.join(desktopDir, 'package.json'),
        JSON.stringify({
          dependencies: {
            'better-sqlite3': '12.0.0', // wrong major version
          },
        })
      );

      const res = runCli(['sqlite', '--repo-root', tmp]);
      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toContain('SQLITE_BINDING_VIOLATION');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('NATIVE_PACKAGING_VIOLATION tests', () => {
  it('fails static check when asar is false or asarUnpack is missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-pkg-neg-'));
    try {
      const desktopDir = path.join(tmp, 'apps/desktop');
      fs.mkdirSync(desktopDir, { recursive: true });
      fs.writeFileSync(
        path.join(desktopDir, 'electron-builder.yml'),
        `asar: false\nasarUnpack:\n  - '**/*.node'\nnpmRebuild: false\nmac:\n  x64ArchFiles: '*.node'\n`
      );

      const res = runCli(['packaging', '--repo-root', tmp]);
      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toContain('NATIVE_PACKAGING_VIOLATION');
      expect(res.stderr).toContain('must have "asar: true"');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('fails artifact check when native addon inside asar has no unpacked file', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-asar-neg-'));
    try {
      const srcDir = path.join(tmp, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'test-addon.node'), 'FAKE_BINARY');

      const asarPath = path.join(tmp, 'app.asar');
      await asar.createPackage(srcDir, asarPath);

      // We do NOT create app.asar.unpacked/test-addon.node
      const res = runCli(['packaging', '--repo-root', repoRoot, '--artifact', tmp]);
      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toContain('NATIVE_PACKAGING_VIOLATION');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('passes artifact check when native addon is physically present in unpacked directory', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-asar-pos-'));
    try {
      const srcDir = path.join(tmp, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'addon.node'), 'FAKE_BINARY');

      const asarPath = path.join(tmp, 'app.asar');
      await asar.createPackage(srcDir, asarPath);

      // Create physical unpacked file
      const unpackedDir = path.join(tmp, 'app.asar.unpacked');
      fs.mkdirSync(unpackedDir, { recursive: true });
      fs.writeFileSync(path.join(unpackedDir, 'addon.node'), 'PHYSICAL_BINARY');

      const res = runCli(['packaging', '--repo-root', repoRoot, '--artifact', tmp]);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain('BUILD_CHECK_PASSED');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('BOM_VIOLATION negative tests', () => {
  it('fails with BOM_VIOLATION when a configuration file starts with UTF-8 BOM', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'da-bom-neg-'));
    try {
      const bomBuffer = Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]); // BOM + "{}"
      fs.writeFileSync(path.join(tmp, 'package.json'), bomBuffer);

      const res = runCli(['bom', '--repo-root', tmp]);
      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toContain('BOM_VIOLATION');
      expect(res.stderr).toContain('package.json');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
