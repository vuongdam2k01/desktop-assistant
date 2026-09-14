import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProviderRegistry } from '../../src/oauth/provider-registry.js';
import { BackendError } from '../../src/http/errors.js';

class MockSecretResolver {
  constructor(private readonly secrets: Record<string, string>) {}
  async resolveSecret(ref: string): Promise<string | undefined> {
    return this.secrets[ref];
  }
}

describe('ProviderRegistry', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads valid descriptor and offers it when secrets resolve', async () => {
    const descriptor = {
      providerId: 'custom-provider',
      version: '0.1.0',
      name: 'Custom Provider',
      authorizeEndpoint: 'https://auth.example.com/oauth',
      tokenEndpoint: 'https://auth.example.com/token',
      clientIdRef: 'CUSTOM_CLIENT_ID',
      clientSecretRef: 'CUSTOM_CLIENT_SECRET',
      tokenAuthMethod: 'credentials-in-body',
      usesProofKey: true,
      defaultScopes: ['api'],
    };

    fs.writeFileSync(path.join(tempDir, 'custom.json'), JSON.stringify(descriptor));

    const resolver = new MockSecretResolver({
      CUSTOM_CLIENT_ID: 'cid-123',
      CUSTOM_CLIENT_SECRET: 'csec-456',
    });

    const registry = new ProviderRegistry(tempDir, resolver);
    await registry.load();

    expect(registry.hasProvider('custom-provider')).toBe(true);
    const loaded = registry.getProvider('custom-provider');
    expect(loaded.name).toBe('Custom Provider');

    const creds = await registry.resolveCredentials(loaded);
    expect(creds.clientId).toBe('cid-123');
    expect(creds.clientSecret).toBe('csec-456');
  });

  it('withholds provider when client secret cannot be resolved', async () => {
    const descriptor = {
      providerId: 'unconfigured-provider',
      version: '0.1.0',
      name: 'Unconfigured Provider',
      authorizeEndpoint: 'https://auth.example.com/oauth',
      tokenEndpoint: 'https://auth.example.com/token',
      clientIdRef: 'MISSING_CLIENT_ID',
      clientSecretRef: 'MISSING_CLIENT_SECRET',
      tokenAuthMethod: 'credentials-in-header',
      usesProofKey: false,
      defaultScopes: [],
    };

    fs.writeFileSync(path.join(tempDir, 'unconfigured.json'), JSON.stringify(descriptor));

    const resolver = new MockSecretResolver({}); // Missing secrets
    const registry = new ProviderRegistry(tempDir, resolver);
    await registry.load();

    expect(registry.hasProvider('unconfigured-provider')).toBe(false);
    expect(() => registry.getProvider('unconfigured-provider')).toThrow(BackendError);
  });

  it('aborts startup if duplicate providerId is found in descriptors', async () => {
    const d1 = {
      providerId: 'duplicate-provider',
      version: '0.1.0',
      name: 'P1',
      authorizeEndpoint: 'https://auth.example.com/oauth',
      tokenEndpoint: 'https://auth.example.com/token',
      clientIdRef: 'ID_1',
      clientSecretRef: 'SEC_1',
      tokenAuthMethod: 'credentials-in-body',
      usesProofKey: false,
      defaultScopes: [],
    };
    const d2 = { ...d1, name: 'P2' };

    fs.writeFileSync(path.join(tempDir, 'p1.json'), JSON.stringify(d1));
    fs.writeFileSync(path.join(tempDir, 'p2.json'), JSON.stringify(d2));

    const resolver = new MockSecretResolver({ ID_1: 'a', SEC_1: 'b' });
    const registry = new ProviderRegistry(tempDir, resolver);

    await expect(registry.load()).rejects.toThrow(/Duplicate providerId "duplicate-provider"/);
  });
});
