import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { SessionTokenService, hashRefreshToken } from '../../src/auth/session-token-service.js';
import { BackendError } from '../../src/http/errors.js';

class MockSecretResolver {
  constructor(private readonly secrets: Record<string, string>) {}
  async resolveSecret(ref: string): Promise<string | undefined> {
    return this.secrets[ref];
  }
}

describe('SessionTokenService', () => {
  const validKey1 = crypto.randomBytes(32).toString('hex'); // 256-bit key
  const validKey2 = crypto.randomBytes(32).toString('hex'); // 256-bit key

  const keyRingJson = JSON.stringify({
    currentKid: 'k1',
    keys: {
      k1: validKey1,
    },
  });

  const rotatedKeyRingJson = JSON.stringify({
    currentKid: 'k2',
    keys: {
      k1: validKey1,
      k2: validKey2,
    },
  });

  it('issues and verifies access and refresh tokens with correct claims and kid header', async () => {
    const resolver = new MockSecretResolver({ JWT_KEY_RING: keyRingJson });
    const service = new SessionTokenService({
      secretResolver: resolver,
      keyRingSecretRef: 'JWT_KEY_RING',
      issuer: 'test-issuer',
      audience: 'test-audience',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 2592000,
    });

    const tokens = await service.issueTokens({
      accountId: 'acc-123',
      deviceId: 'dev-456',
      sessionId: 'sess-789',
    });

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(tokens.expiresInSeconds).toBe(900);

    const accessClaims = await service.verifyToken(tokens.accessToken, 'access');
    expect(accessClaims.accountId).toBe('acc-123');
    expect(accessClaims.deviceId).toBe('dev-456');
    expect(accessClaims.sessionId).toBe('sess-789');

    const refreshClaims = await service.verifyToken(tokens.refreshToken, 'refresh');
    expect(refreshClaims.accountId).toBe('acc-123');
    expect(refreshClaims.deviceId).toBe('dev-456');
    expect(refreshClaims.sessionId).toBe('sess-789');
  });

  it('rejects access token presented when expecting refresh token', async () => {
    const resolver = new MockSecretResolver({ JWT_KEY_RING: keyRingJson });
    const service = new SessionTokenService({
      secretResolver: resolver,
      keyRingSecretRef: 'JWT_KEY_RING',
      issuer: 'test-issuer',
      audience: 'test-audience',
    });

    const tokens = await service.issueTokens({
      accountId: 'acc-1',
      deviceId: 'dev-1',
      sessionId: 'sess-1',
    });

    await expect(service.verifyToken(tokens.accessToken, 'refresh')).rejects.toThrow(BackendError);
  });

  it('supports two-phase key rotation: tokens signed with old key verify under rotated key ring', async () => {
    const resolver = new MockSecretResolver({ JWT_KEY_RING: keyRingJson });
    const service1 = new SessionTokenService({
      secretResolver: resolver,
      keyRingSecretRef: 'JWT_KEY_RING',
      issuer: 'test-issuer',
      audience: 'test-audience',
    });

    const tokensBeforeRotation = await service1.issueTokens({
      accountId: 'acc-rot',
      deviceId: 'dev-rot',
      sessionId: 'sess-rot',
    });

    // Update secret with rotated key ring (currentKid switched to k2, k1 retained)
    const rotatedResolver = new MockSecretResolver({ JWT_KEY_RING: rotatedKeyRingJson });
    const service2 = new SessionTokenService({
      secretResolver: rotatedResolver,
      keyRingSecretRef: 'JWT_KEY_RING',
      issuer: 'test-issuer',
      audience: 'test-audience',
    });

    // Token signed with k1 still verifies
    const claims = await service2.verifyToken(tokensBeforeRotation.accessToken, 'access');
    expect(claims.accountId).toBe('acc-rot');

    // New tokens are signed with k2
    const tokensAfterRotation = await service2.issueTokens({
      accountId: 'acc-new',
      deviceId: 'dev-new',
      sessionId: 'sess-new',
    });
    const newClaims = await service2.verifyToken(tokensAfterRotation.accessToken, 'access');
    expect(newClaims.accountId).toBe('acc-new');
  });

  it('rejects keys shorter than 256 bits (32 bytes)', async () => {
    const shortKeyRing = JSON.stringify({
      currentKid: 'short',
      keys: {
        short: 'too-short-key',
      },
    });
    const resolver = new MockSecretResolver({ JWT_KEY_RING: shortKeyRing });
    const service = new SessionTokenService({
      secretResolver: resolver,
      keyRingSecretRef: 'JWT_KEY_RING',
      issuer: 'test-issuer',
      audience: 'test-audience',
    });

    await expect(
      service.issueTokens({ accountId: 'a', deviceId: 'd', sessionId: 's' })
    ).rejects.toThrow(/must be at least 256 bits/);
  });

  it('hashRefreshToken produces consistent SHA-256 hash', () => {
    const token = 'sample-refresh-token';
    const hash1 = hashRefreshToken(token);
    const hash2 = hashRefreshToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });
});
