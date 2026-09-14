import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { addInvitation } from '../../src/cli/allowlist.js';
import type { IdentityVerifier } from '../../src/auth/identity-verifier.js';
import type { ProviderHttpClient, ProviderHttpRequest, ProviderHttpResponse } from '../../src/oauth/provider-http-client.js';

class MockProviderHttpClient implements ProviderHttpClient {
  requests: ProviderHttpRequest[] = [];
  responseHandler?: (req: ProviderHttpRequest) => Promise<ProviderHttpResponse> | ProviderHttpResponse;

  async request(req: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    this.requests.push(req);
    if (this.responseHandler) {
      return this.responseHandler(req);
    }
    return {
      status: 200,
      headers: {},
      data: {
        access_token: 'mock-provider-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'mock-provider-refresh-token',
      },
    };
  }
}

describe('OAuth Broker Integration', () => {
  let app: FastifyInstance;
  let mockHttpClient: MockProviderHttpClient;
  let testAccessToken: string;
  const config = loadConfig();

  beforeAll(async () => {
    mockHttpClient = new MockProviderHttpClient();
    const testEmail = `broker_test_${Date.now()}@example.com`;
    await addInvitation({ email: testEmail });

    const mockVerifier: IdentityVerifier = {
      verifyIdToken: async () => ({
        sub: 'google-sub-broker-' + Date.now(),
        email: testEmail,
        emailVerified: true,
      }),
    };

    app = await buildApp({
      config,
      dependencies: {
        identityVerifier: mockVerifier,
        providerHttpClient: mockHttpClient,
      },
    });
    await app.ready();

    // Sign in to get valid session access token
    const signinRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        idToken: 'test-token',
        deviceId: 'broker-test-device',
      },
    });
    const tokens = signinRes.json();
    testAccessToken = tokens.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates Notion authorize URL with default scopes and state binding', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:4567/callback',
      headers: { Authorization: `Bearer ${testAccessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.providerId).toBe('notion');
    expect(body.binding).toBeDefined();
    expect(body.expiresInSeconds).toBe(600);

    const parsed = new URL(body.authorizeUrl);
    expect(parsed.origin).toBe('https://api.notion.com');
    expect(parsed.searchParams.get('state')).toBe(body.binding);
    expect(parsed.searchParams.get('owner')).toBe('user');
  });

  it('generates Google authorize URL with PKCE and requested scopes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/oauth/google/authorize-url?redirectUri=http://127.0.0.1:4567/callback&scopes=https://www.googleapis.com/auth/gmail.readonly',
      headers: { Authorization: `Bearer ${testAccessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.providerId).toBe('google');

    const parsed = new URL(body.authorizeUrl);
    expect(parsed.origin).toBe('https://accounts.google.com');
    expect(parsed.searchParams.get('code_challenge')).toBeDefined();
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.readonly');
  });

  it('returns 404 PROVIDER_UNSUPPORTED for non-existent provider', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/oauth/unsupported-provider/authorize-url?redirectUri=http://127.0.0.1:4567/callback',
      headers: { Authorization: `Bearer ${testAccessToken}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('PROVIDER_UNSUPPORTED');
  });

  it('exchanges code for Notion using Basic header authentication and forwards extras without retention', async () => {
    mockHttpClient.requests = [];
    mockHttpClient.responseHandler = () => ({
      status: 200,
      headers: {},
      data: {
        access_token: 'notion-tok-123',
        token_type: 'Bearer',
        workspace_id: 'ws-abc',
        workspace_name: 'Productivity Inc',
      },
    });

    // 1. Get authorize-url to acquire binding
    const authRes = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:4567/callback',
      headers: { Authorization: `Bearer ${testAccessToken}` },
    });
    const { binding } = authRes.json();

    // 2. Exchange
    const exchRes = await app.inject({
      method: 'POST',
      url: '/v1/oauth/notion/exchange',
      headers: { Authorization: `Bearer ${testAccessToken}` },
      payload: {
        code: 'notion-auth-code',
        redirectUri: 'http://127.0.0.1:4567/callback',
        binding,
      },
    });
    expect(exchRes.statusCode).toBe(200);
    const body = exchRes.json();
    expect(body.accessToken).toBe('notion-tok-123');
    expect(body.providerExtras).toEqual({
      workspace_id: 'ws-abc',
      workspace_name: 'Productivity Inc',
    });

    // Verify outbound request sent Authorization: Basic header
    expect(mockHttpClient.requests).toHaveLength(1);
    const req = mockHttpClient.requests[0]!;
    expect(req.headers?.['Authorization']).toMatch(/^Basic /);
  });

  it('handles concurrent double exchange: exactly one provider request executes, the other is rejected as BINDING_CONSUMED', async () => {
    mockHttpClient.requests = [];

    // Get fresh binding
    const authRes = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:4567/callback',
      headers: { Authorization: `Bearer ${testAccessToken}` },
    });
    const { binding } = authRes.json();

    // Execute two concurrent exchanges with the same binding
    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/v1/oauth/notion/exchange',
        headers: { Authorization: `Bearer ${testAccessToken}` },
        payload: {
          code: 'concurrent-code-1',
          redirectUri: 'http://127.0.0.1:4567/callback',
          binding,
        },
      }),
      app.inject({
        method: 'POST',
        url: '/v1/oauth/notion/exchange',
        headers: { Authorization: `Bearer ${testAccessToken}` },
        payload: {
          code: 'concurrent-code-2',
          redirectUri: 'http://127.0.0.1:4567/callback',
          binding,
        },
      }),
    ]);

    const statuses = [res1.statusCode, res2.statusCode].sort();
    expect(statuses).toEqual([200, 400]);

    const failedRes = res1.statusCode === 400 ? res1 : res2;
    expect(failedRes.json().code).toBe('BINDING_CONSUMED');

    // Exactly one provider call was made
    expect(mockHttpClient.requests).toHaveLength(1);
  });

  it('rejects exchange before contacting provider if redirectUri mismatches', async () => {
    mockHttpClient.requests = [];

    const authRes = await app.inject({
      method: 'GET',
      url: '/v1/oauth/notion/authorize-url?redirectUri=http://127.0.0.1:4567/callback',
      headers: { Authorization: `Bearer ${testAccessToken}` },
    });
    const { binding } = authRes.json();

    const exchRes = await app.inject({
      method: 'POST',
      url: '/v1/oauth/notion/exchange',
      headers: { Authorization: `Bearer ${testAccessToken}` },
      payload: {
        code: 'some-code',
        redirectUri: 'http://127.0.0.1:9999/different-callback',
        binding,
      },
    });

    expect(exchRes.statusCode).toBe(400);
    expect(exchRes.json().code).toBe('REDIRECT_MISMATCH');

    // Zero provider calls made
    expect(mockHttpClient.requests).toHaveLength(0);
  });

  it('maps provider 4xx rejection to 424 PROVIDER_REJECTED with providerReason without leaking raw body', async () => {
    mockHttpClient.responseHandler = () => ({
      status: 400,
      headers: {},
      data: {
        error: 'invalid_grant',
        error_description: 'Authorization code has expired',
      },
    });

    const authRes = await app.inject({
      method: 'GET',
      url: '/v1/oauth/google/authorize-url?redirectUri=http://127.0.0.1:4567/callback',
      headers: { Authorization: `Bearer ${testAccessToken}` },
    });
    const { binding } = authRes.json();

    const exchRes = await app.inject({
      method: 'POST',
      url: '/v1/oauth/google/exchange',
      headers: { Authorization: `Bearer ${testAccessToken}` },
      payload: {
        code: 'expired-code',
        redirectUri: 'http://127.0.0.1:4567/callback',
        binding,
      },
    });

    expect(exchRes.statusCode).toBe(424);
    const body = exchRes.json();
    expect(body.code).toBe('PROVIDER_REJECTED');
    expect(body.providerReason).toBe('Authorization code has expired');
    expect(body.error).toBeUndefined(); // internal raw fields not leaked
  });

  it('refreshes provider tokens via POST /v1/oauth/:provider/refresh', async () => {
    mockHttpClient.requests = [];
    mockHttpClient.responseHandler = () => ({
      status: 200,
      headers: {},
      data: {
        access_token: 'refreshed-provider-token-999',
        token_type: 'Bearer',
        expires_in: 3600,
      },
    });

    const refRes = await app.inject({
      method: 'POST',
      url: '/v1/oauth/google/refresh',
      headers: { Authorization: `Bearer ${testAccessToken}` },
      payload: {
        refreshToken: 'existing-provider-refresh-token',
      },
    });

    expect(refRes.statusCode).toBe(200);
    const body = refRes.json();
    expect(body.accessToken).toBe('refreshed-provider-token-999');
    expect(body.tokenType).toBe('Bearer');
  });
});
