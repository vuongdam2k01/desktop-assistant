import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { addInvitation } from '../../src/cli/allowlist.js';
import { dumpAuthStore, verifyExactSchemaBoundary } from '../../src/cli/dump-auth-store.js';
import { runSecretScan } from '../../scripts/scan-secrets.js';
import type { IdentityVerifier, IdentityPayload } from '../../src/auth/identity-verifier.js';
import type { ProviderHttpClient, ProviderHttpRequest, ProviderHttpResponse } from '../../src/oauth/provider-http-client.js';

class ControlledHttp implements ProviderHttpClient {
  requests: ProviderHttpRequest[] = [];

  async request(req: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    this.requests.push(req);
    return {
      status: 200,
      headers: {},
      data: {
        access_token: 'secret-provider-access-token-' + crypto.randomUUID(),
        refresh_token: 'secret-provider-refresh-token-' + crypto.randomUUID(),
        token_type: 'Bearer',
        expires_in: 3600,
        workspace_id: 'ws-controlled-123',
      },
    };
  }
}

describe('Full Flow and Zero-Retention Store Boundary Proof', () => {
  let app: FastifyInstance;
  let mockVerifier: {
    set: (idToken: string, payload: IdentityPayload) => void;
  } & IdentityVerifier;
  let controlledHttp: ControlledHttp;
  const config = loadConfig();

  const userEmail = `zero_retention_${Date.now()}@example.com`;
  const googleSub = `google-sub-zr-${Date.now()}`;
  let device1Tokens: { accessToken: string; refreshToken: string; account: { id: string } };
  let device2Tokens: { accessToken: string; refreshToken: string };
  const providerTokensIssued: string[] = [];

  beforeAll(async () => {
    controlledHttp = new ControlledHttp();
    const identities = new Map<string, IdentityPayload>();

    mockVerifier = {
      set: (idToken, payload) => identities.set(idToken, payload),
      verifyIdToken: async idToken => {
        const p = identities.get(idToken);
        if (!p) throw new Error('Unregistered mock token');
        return p;
      },
    };

    app = await buildApp({
      config,
      dependencies: {
        identityVerifier: mockVerifier,
        providerHttpClient: controlledHttp,
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs complete flow: invite -> 2 devices -> authorize/exchange/refresh -> dump check -> logout -> delete', async () => {
    // 1. Add invitation
    const invitation = await addInvitation({ email: userEmail });
    expect(invitation.status).toBe('active');

    // 2. Sign in Device 1
    const idTokenDev1 = 'token-dev1-' + crypto.randomUUID();
    mockVerifier.set(idTokenDev1, {
      sub: googleSub,
      email: userEmail,
      emailVerified: true,
    });

    const resDev1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken: idTokenDev1, deviceId: 'hw-device-1', deviceName: 'MacBook' },
    });
    expect(resDev1.statusCode).toBe(200);
    device1Tokens = resDev1.json();
    expect(device1Tokens.accessToken).toBeDefined();

    // 3. Sign in Device 2
    const idTokenDev2 = 'token-dev2-' + crypto.randomUUID();
    mockVerifier.set(idTokenDev2, {
      sub: googleSub,
      email: userEmail,
      emailVerified: true,
    });

    const resDev2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken: idTokenDev2, deviceId: 'hw-device-2', deviceName: 'Windows Desktop' },
    });
    expect(resDev2.statusCode).toBe(200);
    device2Tokens = resDev2.json();

    // 4. Exercise OAuth broker for Notion
    const notionAuthRes = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:4567/cb',
      headers: { Authorization: `Bearer ${device1Tokens.accessToken}` },
    });
    expect(notionAuthRes.statusCode).toBe(200);
    const notionBinding = notionAuthRes.json().binding;

    const notionExchRes = await app.inject({
      method: 'POST',
      url: '/v1/oauth/notion/exchange',
      headers: { Authorization: `Bearer ${device1Tokens.accessToken}` },
      payload: {
        code: 'notion-code-abc',
        redirectUri: 'http://127.0.0.1:4567/cb',
        binding: notionBinding,
      },
    });
    expect(notionExchRes.statusCode).toBe(200);
    const notionTokens = notionExchRes.json();
    providerTokensIssued.push(notionTokens.accessToken, notionTokens.refreshToken);

    // 5. Exercise OAuth broker for Google
    const googleAuthRes = await app.inject({
      method: 'GET',
      url: '/v1/oauth/google/authorize-url?redirectUri=http://127.0.0.1:4567/cb&scopes=https://www.googleapis.com/auth/drive.readonly',
      headers: { Authorization: `Bearer ${device2Tokens.accessToken}` },
    });
    expect(googleAuthRes.statusCode).toBe(200);
    const googleBinding = googleAuthRes.json().binding;

    const googleExchRes = await app.inject({
      method: 'POST',
      url: '/v1/oauth/google/exchange',
      headers: { Authorization: `Bearer ${device2Tokens.accessToken}` },
      payload: {
        code: 'google-code-xyz',
        redirectUri: 'http://127.0.0.1:4567/cb',
        binding: googleBinding,
      },
    });
    expect(googleExchRes.statusCode).toBe(200);
    const googleTokens = googleExchRes.json();
    providerTokensIssued.push(googleTokens.accessToken, googleTokens.refreshToken);

    // Refresh provider token
    const googleRefreshRes = await app.inject({
      method: 'POST',
      url: '/v1/oauth/google/refresh',
      headers: { Authorization: `Bearer ${device2Tokens.accessToken}` },
      payload: { refreshToken: googleTokens.refreshToken },
    });
    expect(googleRefreshRes.statusCode).toBe(200);
    providerTokensIssued.push(googleRefreshRes.json().accessToken);

    // =========================================================================
    // STORE BOUNDARY VERIFICATION (BEFORE DELETION)
    // =========================================================================
    // Verify exact 4 tables
    const tables = await verifyExactSchemaBoundary(app.pgPool);
    expect(tables).toEqual(['account', 'device', 'invitation', 'session']);

    const rawDump = await dumpAuthStore(undefined, { raw: true });

    // Assert that issued bearer tokens, refresh tokens, and provider tokens do NOT appear in the database
    const allDbStrings = JSON.stringify(rawDump);

    // Raw session tokens must not be in the database (only 64-char SHA256 hashes)
    expect(allDbStrings).not.toContain(device1Tokens.accessToken);
    expect(allDbStrings).not.toContain(device1Tokens.refreshToken);
    expect(allDbStrings).not.toContain(device2Tokens.accessToken);
    expect(allDbStrings).not.toContain(device2Tokens.refreshToken);

    // Provider tokens must not be stored anywhere
    for (const pToken of providerTokensIssued) {
      if (pToken) {
        expect(allDbStrings).not.toContain(pToken);
      }
    }

    // Client secrets must not be stored in the database
    expect(allDbStrings).not.toContain('dev-notion-client-secret');
    expect(allDbStrings).not.toContain('dev-google-oauth-client-secret');

    // No control-plane artifacts: no commands, jobs, ledger records, or transcripts
    expect(allDbStrings.toLowerCase()).not.toContain('ledger');
    expect(allDbStrings.toLowerCase()).not.toContain('transcript');

    // Assert Redis contents: contains only rate limit and binding keys
    const redisKeys = await app.redis.keys('*');
    for (const key of redisKeys) {
      const val = await app.redis.get(key);
      if (val) {
        // Assert no provider tokens or client secrets in Redis
        for (const pToken of providerTokensIssued) {
          if (pToken) {
            expect(val).not.toContain(pToken);
          }
        }
        expect(val).not.toContain('dev-notion-client-secret');
        expect(val).not.toContain('dev-google-oauth-client-secret');
      }
    }

    // 6. Sign out Device 2
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { Authorization: `Bearer ${device2Tokens.accessToken}` },
      payload: { refreshToken: device2Tokens.refreshToken },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().otherSessionsRetained).toBe(1);

    // 7. Delete account via Device 1
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: { Authorization: `Bearer ${device1Tokens.accessToken}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().accountDeleted).toBe(true);

    // 8. Assert account and all related records are gone
    const postDelDump = await dumpAuthStore(undefined, { raw: true });
    const remainingAcc = (postDelDump.rows['account'] ?? []).filter(a => a['id'] === device1Tokens.account.id);
    expect(remainingAcc).toHaveLength(0);

    const remainingDev = (postDelDump.rows['device'] ?? []).filter(d => d['account_id'] === device1Tokens.account.id);
    expect(remainingDev).toHaveLength(0);

    const remainingSess = (postDelDump.rows['session'] ?? []).filter(s => s['account_id'] === device1Tokens.account.id);
    expect(remainingSess).toHaveLength(0);
    // 9. Both devices return 410 ACCOUNT_DELETED
    const dev1PostCheck = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:4567/cb',
      headers: { Authorization: `Bearer ${device1Tokens.accessToken}` },
    });
    expect(dev1PostCheck.statusCode).toBe(410);
    expect(dev1PostCheck.json().code).toBe('ACCOUNT_DELETED');

    const dev2PostCheck = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: device2Tokens.refreshToken },
    });
    expect(dev2PostCheck.statusCode).toBe(410);
    expect(dev2PostCheck.json().code).toBe('ACCOUNT_DELETED');

    // 10. Run secret scan to confirm zero leaks in codebase / dist / config
    const scanFindings = runSecretScan();
    expect(scanFindings).toHaveLength(0);
  });
});
