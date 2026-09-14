import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { addInvitation } from '../../src/cli/allowlist.js';
import type { IdentityVerifier, IdentityPayload } from '../../src/auth/identity-verifier.js';
import type { AccountDataLifecycle, ProviderRevocationItem } from '../../src/account/account-data-lifecycle.js';
import type { ProviderHttpClient } from '../../src/oauth/provider-http-client.js';

class MockLifecycle implements AccountDataLifecycle {
  shouldFailDestroy = false;
  authorisationsToRevoke: ProviderRevocationItem[] = [];

  async visitProviderAuthorisations(
    _accountId: string,
    visitor: (item: ProviderRevocationItem) => Promise<void>
  ): Promise<void> {
    for (const item of this.authorisationsToRevoke) {
      await visitor(item);
    }
  }

  async destroyReplicatedAccount(_accountId: string): Promise<void> {
    if (this.shouldFailDestroy) {
      throw new Error('F22 replication service unreachable');
    }
  }
}

class DynamicMockVerifier implements IdentityVerifier {
  private readonly map = new Map<string, IdentityPayload>();

  set(idToken: string, payload: IdentityPayload): void {
    this.map.set(idToken, payload);
  }

  async verifyIdToken(idToken: string): Promise<IdentityPayload> {
    const p = this.map.get(idToken);
    if (!p) throw new Error('Unregistered mock token');
    return p;
  }
}

describe('Account Deletion and Lifecycle Integration', () => {
  let app: FastifyInstance;
  let mockLifecycle: MockLifecycle;
  let mockVerifier: DynamicMockVerifier;
  let revokedUrls: string[] = [];
  const config = loadConfig();

  beforeAll(async () => {
    mockLifecycle = new MockLifecycle();
    mockVerifier = new DynamicMockVerifier();

    const mockHttp: ProviderHttpClient = {
      request: async req => {
        revokedUrls.push(req.url);
        return {
          status: 200,
          headers: {},
          data: { status: 'revoked' },
        };
      },
    };

    app = await buildApp({
      config,
      dependencies: {
        identityVerifier: mockVerifier,
        accountDataLifecycle: mockLifecycle,
        providerHttpClient: mockHttp,
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('fails closed with 503 and retains PostgreSQL records if destroyReplicatedAccount fails', async () => {
    const email = `fail_close_${Date.now()}@example.com`;
    await addInvitation({ email });
    const idToken = 'tok-fail-close-' + crypto.randomUUID();
    mockVerifier.set(idToken, {
      sub: 'google-sub-fc-' + Date.now(),
      email,
      emailVerified: true,
    });

    const signinRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-fail-close' },
    });
    expect(signinRes.statusCode).toBe(200);
    const tokens = signinRes.json();

    // Configure lifecycle to fail
    mockLifecycle.shouldFailDestroy = true;

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    expect(delRes.statusCode).toBe(503);
    expect(delRes.json().code).toBe('SERVICE_UNAVAILABLE');

    // Account, device, and session records MUST still exist in PostgreSQL
    const accCheck = await app.pgPool.query('SELECT * FROM account WHERE id = $1', [tokens.account.id]);
    expect(accCheck.rows).toHaveLength(1);

    const sessCheck = await app.pgPool.query('SELECT * FROM session WHERE account_id = $1', [tokens.account.id]);
    expect(sessCheck.rows).toHaveLength(1);

    // Reset failure flag
    mockLifecycle.shouldFailDestroy = false;
  });

  it('executes provider revocations, deletes account, and invalidates all devices', async () => {
    const email = `full_del_${Date.now()}@example.com`;
    await addInvitation({ email });
    const idToken = 'tok-del-' + crypto.randomUUID();
    mockVerifier.set(idToken, {
      sub: 'google-sub-del-' + Date.now(),
      email,
      emailVerified: true,
    });

    // Device 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-1' },
    });
    expect(res1.statusCode).toBe(200);
    const tokens1 = res1.json();
    const accountId = tokens1.account.id;

    // Device 2
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-2' },
    });
    expect(res2.statusCode).toBe(200);
    const tokens2 = res2.json();

    // Stage authorizations in lifecycle: one with revocation endpoint (google), one without (notion)
    mockLifecycle.authorisationsToRevoke = [
      { providerId: 'google', revocationToken: 'google-refresh-token' },
      { providerId: 'notion', revocationToken: 'notion-access-token' },
    ];

    revokedUrls = [];

    // Delete account from device 1
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: { Authorization: `Bearer ${tokens1.accessToken}` },
    });

    expect(delRes.statusCode).toBe(200);
    const body = delRes.json();
    expect(body.accountDeleted).toBe(true);
    expect(body.devicesRemoved).toBe(2);
    expect(body.sessionsRevoked).toBe(2);

    expect(body.providerWithdrawals).toEqual([
      { providerId: 'google', outcome: 'withdrawn' },
      { providerId: 'notion', outcome: 'no-revocation-endpoint' },
    ]);

    expect(revokedUrls).toContain('https://oauth2.googleapis.com/revoke');

    // Verify account, devices, and sessions are gone from PostgreSQL
    const accRes = await app.pgPool.query('SELECT * FROM account WHERE id = $1', [accountId]);
    expect(accRes.rows).toHaveLength(0);

    const devRes = await app.pgPool.query('SELECT * FROM device WHERE account_id = $1', [accountId]);
    expect(devRes.rows).toHaveLength(0);

    const sessRes = await app.pgPool.query('SELECT * FROM session WHERE account_id = $1', [accountId]);
    expect(sessRes.rows).toHaveLength(0);

    // Both device access tokens now return 410 ACCOUNT_DELETED
    const authCheck1 = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:4567/cb',
      headers: { Authorization: `Bearer ${tokens1.accessToken}` },
    });
    expect(authCheck1.statusCode).toBe(410);
    expect(authCheck1.json().code).toBe('ACCOUNT_DELETED');

    const authCheck2 = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:4567/cb',
      headers: { Authorization: `Bearer ${tokens2.accessToken}` },
    });
    expect(authCheck2.statusCode).toBe(410);
    expect(authCheck2.json().code).toBe('ACCOUNT_DELETED');

    // Both device refresh tokens also return 410 ACCOUNT_DELETED
    const refCheck1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: tokens1.refreshToken },
    });
    expect(refCheck1.statusCode).toBe(410);
    expect(refCheck1.json().code).toBe('ACCOUNT_DELETED');

    const refCheck2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: tokens2.refreshToken },
    });
    expect(refCheck2.statusCode).toBe(410);
    expect(refCheck2.json().code).toBe('ACCOUNT_DELETED');
  });
});
