import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { addInvitation, revokeInvitation } from '../../src/cli/allowlist.js';
import type { IdentityVerifier, IdentityPayload } from '../../src/auth/identity-verifier.js';

class MockIdentityVerifier implements IdentityVerifier {
  private identities = new Map<string, IdentityPayload>();

  setIdentity(idToken: string, payload: IdentityPayload) {
    this.identities.set(idToken, payload);
  }

  async verifyIdToken(idToken: string): Promise<IdentityPayload> {
    const p = this.identities.get(idToken);
    if (!p) {
      throw new Error('Invalid mock id token');
    }
    return p;
  }
}

describe('Auth and Session Lifecycle Integration', () => {
  let app: FastifyInstance;
  let mockVerifier: MockIdentityVerifier;
  const config = loadConfig();

  beforeAll(async () => {
    mockVerifier = new MockIdentityVerifier();
    app = await buildApp({
      config,
      dependencies: {
        identityVerifier: mockVerifier,
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects sign-in when email is not in the allowlist', async () => {
    const testToken = 'token-uninvited-' + crypto.randomUUID();
    mockVerifier.setIdentity(testToken, {
      sub: 'google-sub-uninvited',
      email: 'uninvited@example.com',
      emailVerified: true,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        idToken: testToken,
        deviceId: 'dev-uninvited',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('EMAIL_NOT_IN_ALLOWLIST');
  });

  it('admits user with valid invitation, consumes it, and creates account, device, and session', async () => {
    const email = `admitted_${Date.now()}@example.com`;
    await addInvitation({ email });

    const idToken = 'token-admitted-' + crypto.randomUUID();
    const googleSub = 'google-sub-' + crypto.randomUUID();
    mockVerifier.setIdentity(idToken, {
      sub: googleSub,
      email,
      emailVerified: true,
    });

    const signinRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        idToken,
        deviceId: 'device-1',
        deviceName: 'Work Laptop',
      },
    });

    expect(signinRes.statusCode).toBe(200);
    const tokens = signinRes.json();
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.tokenType).toBe('Bearer');
    expect(tokens.expiresInSeconds).toBe(900);
    expect(tokens.account.email).toBe(email);

    // Verify invitation is marked redeemed
    const invRes = await app.pgPool.query(
      'SELECT status, activated_account_id FROM invitation WHERE email = $1',
      [email]
    );
    expect(invRes.rows[0]?.status).toBe('redeemed');
    expect(invRes.rows[0]?.activated_account_id).toBe(tokens.account.id);

    // Verify device row was created
    const devRes = await app.pgPool.query(
      'SELECT device_id, device_name FROM device WHERE account_id = $1',
      [tokens.account.id]
    );
    expect(devRes.rows).toHaveLength(1);
    expect(devRes.rows[0]?.device_id).toBe('device-1');
    expect(devRes.rows[0]?.device_name).toBe('Work Laptop');

    // Verify session was created
    const sessRes = await app.pgPool.query(
      'SELECT device_id, revoked_at FROM session WHERE account_id = $1',
      [tokens.account.id]
    );
    expect(sessRes.rows).toHaveLength(1);
    expect(sessRes.rows[0]?.revoked_at).toBeNull();
  });

  it('enforces same-device idempotence: signing in twice produces one device enrolment and fresh session', async () => {
    const email = `idem_${Date.now()}@example.com`;
    await addInvitation({ email });

    const idToken = 'token-idem-' + crypto.randomUUID();
    const googleSub = 'google-sub-idem-' + crypto.randomUUID();
    mockVerifier.setIdentity(idToken, {
      sub: googleSub,
      email,
      emailVerified: true,
    });

    // First sign-in
    await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'unique-hw-id', deviceName: 'MacBook Pro' },
    });

    // Second sign-in from same device
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'unique-hw-id', deviceName: 'MacBook Pro Updated' },
    });

    expect(res2.statusCode).toBe(200);
    const body2 = res2.json();

    // Exactly one device row exists for this account
    const devRes = await app.pgPool.query(
      'SELECT * FROM device WHERE account_id = $1',
      [body2.account.id]
    );
    expect(devRes.rows).toHaveLength(1);
    expect(devRes.rows[0]?.device_name).toBe('MacBook Pro Updated');
  });

  it('supports two-device concurrency for the same account', async () => {
    const email = `multi_${Date.now()}@example.com`;
    await addInvitation({ email });

    const idToken = 'token-multi-' + crypto.randomUUID();
    const googleSub = 'google-sub-multi-' + crypto.randomUUID();
    mockVerifier.setIdentity(idToken, {
      sub: googleSub,
      email,
      emailVerified: true,
    });

    // Device 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-alpha' },
    });
    const tokens1 = res1.json();

    // Device 2
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-beta' },
    });
    const tokens2 = res2.json();

    expect(tokens1.account.id).toBe(tokens2.account.id);

    // Both devices have access
    const devRes = await app.pgPool.query(
      'SELECT device_id FROM device WHERE account_id = $1 ORDER BY device_id',
      [tokens1.account.id]
    );
    expect(devRes.rows.map(r => r.device_id)).toEqual(['dev-alpha', 'dev-beta']);

    // Logout from Device 1 leaves Device 2 active
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { Authorization: `Bearer ${tokens1.accessToken}` },
      payload: { refreshToken: tokens1.refreshToken },
    });

    expect(logoutRes.statusCode).toBe(200);
    const logoutBody = logoutRes.json();
    expect(logoutBody.sessionRevoked).toBe(true);
    expect(logoutBody.otherSessionsRetained).toBe(1);

    // Device 2 refresh still succeeds
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: tokens2.refreshToken },
    });
    expect(refreshRes.statusCode).toBe(200);
  });

  it('rotates refresh token atomically and rejects replay of prior refresh token', async () => {
    const email = `rotate_${Date.now()}@example.com`;
    await addInvitation({ email });

    const idToken = 'token-rotate-' + crypto.randomUUID();
    mockVerifier.setIdentity(idToken, {
      sub: 'google-sub-rot-' + crypto.randomUUID(),
      email,
      emailVerified: true,
    });

    const signinRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-rotate' },
    });
    const tokens = signinRes.json();
    const oldRefreshToken = tokens.refreshToken;

    // First refresh rotates token
    const refreshRes1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    });
    expect(refreshRes1.statusCode).toBe(200);
    const newTokens = refreshRes1.json();
    expect(newTokens.refreshToken).not.toBe(oldRefreshToken);

    // Replay of old refresh token fails
    const replayRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    });
    expect(replayRes.statusCode).toBe(401);
    expect(replayRes.json().code).toBe('TOKEN_INVALID');

    // New refresh token succeeds
    const refreshRes2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: newTokens.refreshToken },
    });
    expect(refreshRes2.statusCode).toBe(200);
  });

  it('revokes sessions when an invitation is revoked', async () => {
    const email = `revoke_inv_${Date.now()}@example.com`;
    await addInvitation({ email });

    const idToken = 'token-revoke-inv-' + crypto.randomUUID();
    mockVerifier.setIdentity(idToken, {
      sub: 'google-sub-revinv-' + crypto.randomUUID(),
      email,
      emailVerified: true,
    });

    const signinRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-revinv' },
    });
    const tokens = signinRes.json();

    // Revoke invitation via CLI function
    await revokeInvitation({ email });

    // Refresh fails with SESSION_REVOKED
    const refRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(refRes.statusCode).toBe(401);
    expect(refRes.json().code).toBe('SESSION_REVOKED');
  });

  // The guard rejects a request whose invitation has been revoked. That rejection is the
  // only thing standing between a withdrawn participant and a working session once a second
  // revocation path exists that forgets to revoke the sessions too.
  it('refuses an access token once the invitation behind it is revoked', async () => {
    const email = `revoke_guard_${Date.now()}@example.com`;
    await addInvitation({ email });

    const idToken = 'token-revoke-guard-' + crypto.randomUUID();
    mockVerifier.setIdentity(idToken, {
      sub: 'google-sub-revguard-' + crypto.randomUUID(),
      email,
      emailVerified: true,
    });

    const signinRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-revguard' },
    });
    const tokens = signinRes.json();

    // Revoke the invitation without touching the sessions, which is what any second
    // revocation path would do.
    await app.pgPool.query(
      `UPDATE invitation SET status = 'revoked', activated_account_id = NULL WHERE email = $1`,
      [email]
    );

    const guarded = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http%3A%2F%2F127.0.0.1%3A8765%2Fcb',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });

    expect(guarded.statusCode).toBe(401);
    expect(guarded.json().code).toBe('SESSION_REVOKED');
  });

  // A device revocation that the next sign-in undoes is not a revocation. The laptop is
  // lost, the operator revokes it, and whoever holds it signs in again and is re-enrolled.
  it('keeps a device revoked when the same device signs in again', async () => {
    const email = `revoke_device_${Date.now()}@example.com`;
    await addInvitation({ email });

    const idToken = 'token-revoke-device-' + crypto.randomUUID();
    const sub = 'google-sub-revdev-' + crypto.randomUUID();
    mockVerifier.setIdentity(idToken, { sub, email, emailVerified: true });

    const first = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken, deviceId: 'dev-lost-laptop' },
    });
    expect(first.statusCode).toBe(200);

    await app.pgPool.query(
      `UPDATE device SET revoked_at = NOW() WHERE device_id = $1`,
      ['dev-lost-laptop']
    );

    const secondToken = 'token-revoke-device-2-' + crypto.randomUUID();
    mockVerifier.setIdentity(secondToken, { sub, email, emailVerified: true });
    await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: { idToken: secondToken, deviceId: 'dev-lost-laptop' },
    });

    const after = await app.pgPool.query<{ revoked_at: Date | null }>(
      'SELECT revoked_at FROM device WHERE device_id = $1',
      ['dev-lost-laptop']
    );
    expect(after.rows[0]?.revoked_at).not.toBeNull();
  });

  it('enforces TLS: rejects plain HTTP when enforceTls is enabled', async () => {
    const tlsConfig = { ...config, enforceTls: true };
    const tlsApp = await buildApp({
      config: tlsConfig,
      dependencies: { identityVerifier: mockVerifier },
    });
    await tlsApp.ready();

    try {
      const res = await tlsApp.inject({
        method: 'GET',
        url: '/v1/health',
        headers: {
          // No x-forwarded-proto https
        },
      });

      expect(res.statusCode).toBe(426);
      expect(res.json().code).toBe('HTTPS_REQUIRED');
    } finally {
      await tlsApp.close();
    }
  });

  it('enforces distributed rate limiting before session guard on protected route', async () => {
    const lowRateConfig = {
      ...config,
      rateLimit: {
        ...config.rateLimit,
        broker: { max: 2, timeWindowMs: 60000 },
      },
    };

    const rateApp = await buildApp({
      config: lowRateConfig,
      dependencies: { identityVerifier: mockVerifier },
    });
    await rateApp.ready();

    try {
      // 2 calls within limit
      await rateApp.inject({
        method: 'GET',
        url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:3000/cb',
        headers: { Authorization: 'Bearer fake-token' },
      });
      await rateApp.inject({
        method: 'GET',
        url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:3000/cb',
        headers: { Authorization: 'Bearer fake-token' },
      });

      // 3rd call hits rate limit before session guard or DB check
      const res3 = await rateApp.inject({
        method: 'GET',
        url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:3000/cb',
        headers: { Authorization: 'Bearer fake-token' },
      });

      expect(res3.statusCode).toBe(429);
      expect(res3.json().code).toBe('RATE_LIMITED');
      expect(res3.headers['retry-after']).toBeDefined();
    } finally {
      await rateApp.close();
    }
  });
});
