import { describe, it, expect } from 'vitest';
import {
  OAuthBrokerService,
  validateLoopbackRedirectUri,
} from '../../src/oauth/oauth-broker-service.js';
import { BackendError } from '../../src/http/errors.js';
import type { ProviderRegistry } from '../../src/oauth/provider-registry.js';
import type { AuthorizationBindingStore } from '../../src/oauth/authorization-binding-store.js';
import type { ProviderHttpClient } from '../../src/oauth/provider-http-client.js';
import type { AuthorisationProviderDescriptor } from '@desktop-assistant/contracts/authorisation-provider-descriptor';

describe('validateLoopbackRedirectUri', () => {
  it('accepts valid loopback addresses with ephemeral ports', () => {
    expect(() => validateLoopbackRedirectUri('http://127.0.0.1:4567/callback')).not.toThrow();
    expect(() => validateLoopbackRedirectUri('http://127.0.0.2:8080/cb')).not.toThrow();
    expect(() => validateLoopbackRedirectUri('http://[::1]:3000/oauth')).not.toThrow();
  });

  it('rejects non-http protocols', () => {
    expect(() => validateLoopbackRedirectUri('https://127.0.0.1:4567/callback')).toThrow(BackendError);
    expect(() => validateLoopbackRedirectUri('custom://127.0.0.1:4567/callback')).toThrow(BackendError);
  });

  it('rejects ports below 1024 or missing port', () => {
    expect(() => validateLoopbackRedirectUri('http://127.0.0.1/callback')).toThrow(BackendError);
    expect(() => validateLoopbackRedirectUri('http://127.0.0.1:80/callback')).toThrow(BackendError);
    expect(() => validateLoopbackRedirectUri('http://127.0.0.1:443/callback')).toThrow(BackendError);
  });

  it('rejects non-loopback hostnames and IPs', () => {
    expect(() => validateLoopbackRedirectUri('http://localhost:4567/callback')).toThrow(BackendError);
    expect(() => validateLoopbackRedirectUri('http://example.com:4567/callback')).toThrow(BackendError);
    expect(() => validateLoopbackRedirectUri('http://192.168.1.1:4567/callback')).toThrow(BackendError);
  });

  it('rejects fragments or credentials', () => {
    expect(() => validateLoopbackRedirectUri('http://user:pass@127.0.0.1:4567/callback')).toThrow(BackendError);
    expect(() => validateLoopbackRedirectUri('http://127.0.0.1:4567/callback#frag')).toThrow(BackendError);
  });
});

describe('OAuthBrokerService', () => {
  const notionDescriptor: AuthorisationProviderDescriptor = {
    providerId: 'notion',
    version: '0.1.0',
    name: 'Notion',
    authorizeEndpoint: 'https://api.notion.com/v1/oauth/authorize',
    tokenEndpoint: 'https://api.notion.com/v1/oauth/token',
    clientIdRef: 'NOTION_CLIENT_ID',
    clientSecretRef: 'NOTION_CLIENT_SECRET',
    tokenAuthMethod: 'credentials-in-header',
    usesProofKey: false,
    defaultScopes: ['read_content'],
    extraAuthorizeParams: { owner: 'user' },
  };

  const googleDescriptor: AuthorisationProviderDescriptor = {
    providerId: 'google',
    version: '0.1.0',
    name: 'Google',
    authorizeEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    clientIdRef: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretRef: 'GOOGLE_OAUTH_CLIENT_SECRET',
    tokenAuthMethod: 'credentials-in-body',
    usesProofKey: true,
    defaultScopes: [],
    extraAuthorizeParams: { access_type: 'offline' },
  };

  const mockRegistry: Partial<ProviderRegistry> = {
    getProvider: (id: string) => {
      if (id === 'notion') return notionDescriptor;
      if (id === 'google') return googleDescriptor;
      throw new BackendError({ statusCode: 404, code: 'PROVIDER_UNSUPPORTED', providerId: id });
    },
    resolveCredentials: async (p: AuthorisationProviderDescriptor) => {
      return { clientId: `id-for-${p.providerId}`, clientSecret: `secret-for-${p.providerId}` };
    },
  };

  const mockBindingStore: Partial<AuthorizationBindingStore> = {
    createBinding: async () => ({ binding: 'test-binding-123', expiresInSeconds: 600 }),
    consumeBinding: async () => ({ codeVerifier: 'mock-code-verifier' }),
  };

  it('constructs authorize URL with PKCE parameters for providers declaring usesProofKey: true', async () => {
    const broker = new OAuthBrokerService(
      mockRegistry as ProviderRegistry,
      mockBindingStore as AuthorizationBindingStore,
      {} as ProviderHttpClient
    );

    const result = await broker.getAuthorizeUrl({
      providerId: 'google',
      sessionId: 'sess-1',
      redirectUri: 'http://127.0.0.1:3000/callback',
      scopes: 'https://www.googleapis.com/auth/drive.readonly',
    });

    const parsed = new URL(result.authorizeUrl);
    expect(parsed.searchParams.get('client_id')).toBe('id-for-google');
    expect(parsed.searchParams.get('state')).toBe('test-binding-123');
    expect(parsed.searchParams.get('code_challenge')).toBeDefined();
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.readonly');
  });

  it('uses Basic header authentication for Notion exchange and returns providerExtras without persistence', async () => {
    let capturedReq: unknown;

    const mockHttp: ProviderHttpClient = {
      request: async req => {
        capturedReq = req;
        return {
          status: 200,
          headers: {},
          data: {
            access_token: 'notion-access-token-123',
            token_type: 'Bearer',
            workspace_id: 'ws-789',
            workspace_name: 'Engineering',
          },
        };
      },
    };

    const broker = new OAuthBrokerService(
      mockRegistry as ProviderRegistry,
      mockBindingStore as AuthorizationBindingStore,
      mockHttp
    );

    const tokens = await broker.exchangeCode({
      providerId: 'notion',
      sessionId: 'sess-1',
      code: 'notion-code-xyz',
      redirectUri: 'http://127.0.0.1:3000/callback',
      binding: 'test-binding-123',
    });

    expect(tokens.accessToken).toBe('notion-access-token-123');
    expect(tokens.providerExtras).toEqual({
      workspace_id: 'ws-789',
      workspace_name: 'Engineering',
    });

    const req = capturedReq as { headers: Record<string, string>; body: string };
    expect(req.headers['Authorization']).toMatch(/^Basic /);
    expect(req.body).toContain('code=notion-code-xyz');
  });

  it('maps provider non-2xx response to 424 PROVIDER_REJECTED with platform reason', async () => {
    const mockHttp: ProviderHttpClient = {
      request: async () => ({
        status: 400,
        headers: {},
        data: {
          error: 'invalid_grant',
          error_description: 'The code is invalid or expired',
        },
      }),
    };

    const broker = new OAuthBrokerService(
      mockRegistry as ProviderRegistry,
      mockBindingStore as AuthorizationBindingStore,
      mockHttp
    );

    await expect(
      broker.exchangeCode({
        providerId: 'google',
        sessionId: 'sess-1',
        code: 'bad-code',
        redirectUri: 'http://127.0.0.1:3000/callback',
        binding: 'test-binding',
      })
    ).rejects.toMatchObject({
      statusCode: 424,
      code: 'PROVIDER_REJECTED',
      providerReason: 'The code is invalid or expired',
    });
  });
});
