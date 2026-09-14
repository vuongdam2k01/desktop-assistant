import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

describe('Public Endpoints and Update Distribution Integration', () => {
  let app: FastifyInstance;
  let tempFeedDir: string;
  const config = loadConfig();

  beforeAll(async () => {
    tempFeedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-feed-test-'));

    // Create test feed files:
    // 1. Flat Windows manifest
    fs.writeFileSync(
      path.join(tempFeedDir, 'latest.yml'),
      'version: 0.1.0\nfiles:\n  - url: DesktopAssistant-Setup-0.1.0.exe\n    sha512: mock-sha\n'
    );

    // 2. Nested macOS manifest per F24 layout
    const macDir = path.join(tempFeedDir, 'darwin', 'arm64');
    fs.mkdirSync(macDir, { recursive: true });
    fs.writeFileSync(
      path.join(macDir, 'latest.yml'),
      'version: 0.1.0\nfiles:\n  - url: DesktopAssistant-0.1.0-arm64.dmg\n'
    );

    // 3. Binary artifact (1024 bytes)
    const mockBinary = Buffer.alloc(1024, 0x42);
    fs.writeFileSync(path.join(tempFeedDir, 'DesktopAssistant-0.1.0-arm64.dmg'), mockBinary);

    const testConfig = {
      ...config,
      updateFeed: { rootDirectory: tempFeedDir },
      appVersion: {
        currentVersion: '0.1.0',
        minimumSupportedVersion: '0.0.9',
        mandatory: false,
        manifestUri: 'https://updates.example.invalid/updates/latest.yml',
        releaseNotesUri: 'https://example.invalid/notes/0.1.0',
      },
    };

    app = await buildApp({ config: testConfig });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tempFeedDir, { recursive: true, force: true });
  });

  it('GET /v1/health reports healthy and storeReachable: true with uptimeSeconds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('healthy');
    expect(body.storeReachable).toBe(true);
    expect(typeof body.uptimeSeconds).toBe('number');
  });

  it('GET /v1/app/version reports configured client semver and update metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/app/version',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.currentVersion).toBe('0.1.0');
    expect(body.minimumSupportedVersion).toBe('0.0.9');
    expect(body.mandatory).toBe(false);
    expect(body.manifestUri).toBe('https://updates.example.invalid/updates/latest.yml');
    expect(body.releaseNotesUri).toBe('https://example.invalid/notes/0.1.0');
  });

  it('proves peer-backend boundary: arbitrary job, agent, ledger, and command endpoints return 404', async () => {
    const forbiddenEndpoints = [
      '/v1/jobs',
      '/v1/agents',
      '/v1/ledger',
      '/v1/undo',
      '/v1/commands',
      '/v1/tasks',
    ];

    for (const ep of forbiddenEndpoints) {
      const res = await app.inject({
        method: 'GET',
        url: ep,
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('serves flat manifest with text/yaml content-type and revalidation headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/updates/latest.yml',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/yaml');
    expect(res.headers['cache-control']).toBe('no-cache, must-revalidate');
    expect(res.body).toContain('DesktopAssistant-Setup-0.1.0.exe');
  });

  it('serves nested OS/architecture manifest paths seamlessly', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/updates/darwin/arm64/latest.yml',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/yaml');
    expect(res.body).toContain('DesktopAssistant-0.1.0-arm64.dmg');
  });

  it('delivers full binary artifact with immutable cache headers and Accept-Ranges: bytes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/updates/DesktopAssistant-0.1.0-arm64.dmg',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.rawPayload.length).toBe(1024);
  });

  it('supports RFC 7233 resumable range request (206 Partial Content)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/updates/DesktopAssistant-0.1.0-arm64.dmg',
      headers: { Range: 'bytes=0-99' },
    });

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-99/1024');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.rawPayload.length).toBe(100);
  });

  it('returns 416 Range Not Satisfiable for range outside file size', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/updates/DesktopAssistant-0.1.0-arm64.dmg',
      headers: { Range: 'bytes=5000-6000' },
    });

    expect(res.statusCode).toBe(416);
  });

  it('returns 404 for non-existent release file', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/updates/non-existent-artifact.zip',
    });

    expect(res.statusCode).toBe(404);
  });
});
