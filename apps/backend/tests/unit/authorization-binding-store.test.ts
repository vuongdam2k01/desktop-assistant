import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Redis } from 'ioredis';
import { AuthorizationBindingStore } from '../../src/oauth/authorization-binding-store.js';

describe('AuthorizationBindingStore', () => {
  let redis: Redis;
  let store: AuthorizationBindingStore;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:63790');
    await redis.ping();
    store = new AuthorizationBindingStore(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('generates a 256-bit base64url binding and consumes it atomically', async () => {
    const { binding, expiresInSeconds } = await store.createBinding({
      providerId: 'notion',
      sessionId: 'sess-123',
      redirectUri: 'http://127.0.0.1:4567/callback',
      codeVerifier: 'secret-verifier-123',
    });

    expect(binding).toBeDefined();
    expect(binding.length).toBeGreaterThanOrEqual(40);
    expect(expiresInSeconds).toBe(600);

    // First consumption succeeds
    const consumed = await store.consumeBinding({
      binding,
      providerId: 'notion',
      sessionId: 'sess-123',
      redirectUri: 'http://127.0.0.1:4567/callback',
    });
    expect(consumed.codeVerifier).toBe('secret-verifier-123');

    // Second consumption fails with BINDING_CONSUMED
    await expect(
      store.consumeBinding({
        binding,
        providerId: 'notion',
        sessionId: 'sess-123',
        redirectUri: 'http://127.0.0.1:4567/callback',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BINDING_CONSUMED',
    });
  });

  it('rejects attempt with wrong session without consuming the victim binding', async () => {
    const { binding } = await store.createBinding({
      providerId: 'google',
      sessionId: 'victim-session',
      redirectUri: 'http://127.0.0.1:4567/callback',
    });

    // Attacker session attempts consumption -> BINDING_UNKNOWN
    await expect(
      store.consumeBinding({
        binding,
        providerId: 'google',
        sessionId: 'attacker-session',
        redirectUri: 'http://127.0.0.1:4567/callback',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BINDING_UNKNOWN',
    });

    // Victim session still succeeds because binding was not consumed
    const consumed = await store.consumeBinding({
      binding,
      providerId: 'google',
      sessionId: 'victim-session',
      redirectUri: 'http://127.0.0.1:4567/callback',
    });
    expect(consumed).toBeDefined();
  });

  it('consumes and returns REDIRECT_MISMATCH when redirectUri does not match', async () => {
    const { binding } = await store.createBinding({
      providerId: 'notion',
      sessionId: 'sess-mismatch',
      redirectUri: 'http://127.0.0.1:4567/callback',
    });

    // Attempt with different redirectUri
    await expect(
      store.consumeBinding({
        binding,
        providerId: 'notion',
        sessionId: 'sess-mismatch',
        redirectUri: 'http://127.0.0.1:9999/other-callback',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'REDIRECT_MISMATCH',
    });

    // Subsequent attempt is already consumed
    await expect(
      store.consumeBinding({
        binding,
        providerId: 'notion',
        sessionId: 'sess-mismatch',
        redirectUri: 'http://127.0.0.1:4567/callback',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BINDING_CONSUMED',
    });
  });

  it('rejects unknown binding with BINDING_UNKNOWN', async () => {
    await expect(
      store.consumeBinding({
        binding: 'completely-non-existent-binding',
        providerId: 'google',
        sessionId: 'sess-1',
        redirectUri: 'http://127.0.0.1:4567/callback',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BINDING_UNKNOWN',
    });
  });
});
