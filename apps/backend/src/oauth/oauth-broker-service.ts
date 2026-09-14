import crypto from 'node:crypto';
import { BackendError } from '../http/errors.js';
import type { AuthorizationBindingStore } from './authorization-binding-store.js';
import type { ProviderHttpClient } from './provider-http-client.js';
import type { ProviderRegistry } from './provider-registry.js';

export interface AuthorizeUrlResult {
  providerId: string;
  authorizeUrl: string;
  binding: string;
  expiresInSeconds: number;
}

export interface ProviderTokens {
  providerId: string;
  accessToken: string;
  tokenType: string;
  expiresInSeconds?: number | undefined;
  refreshToken?: string | undefined;
  scope?: string | undefined;
  providerExtras?: Record<string, unknown> | undefined;
}

export function validateLoopbackRedirectUri(redirectUri: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new BackendError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'redirectUri must be a valid URL',
    });
  }

  if (parsed.protocol !== 'http:') {
    throw new BackendError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'redirectUri must use http protocol',
    });
  }

  if (parsed.username || parsed.password) {
    throw new BackendError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'redirectUri must not contain credentials',
    });
  }

  if (parsed.hash) {
    throw new BackendError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'redirectUri must not contain a fragment',
    });
  }

  const hostname = parsed.hostname;
  const isIpv4Loopback = /^127\.(?:[0-9]{1,3}\.){2}[0-9]{1,3}$/.test(hostname);
  const isIpv6Loopback = hostname === '[::1]' || hostname === '::1';

  if (!isIpv4Loopback && !isIpv6Loopback) {
    throw new BackendError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'redirectUri must be a loopback IP address (127.0.0.0/8 or ::1)',
    });
  }

  if (!parsed.port) {
    throw new BackendError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'redirectUri must specify an explicit port',
    });
  }

  const port = parseInt(parsed.port, 10);
  if (isNaN(port) || port < 1024 || port > 65535) {
    throw new BackendError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'redirectUri port must be between 1024 and 65535',
    });
  }

  return parsed;
}

export class OAuthBrokerService {
  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly bindingStore: AuthorizationBindingStore,
    private readonly httpClient: ProviderHttpClient
  ) {}

  async getAuthorizeUrl(params: {
    providerId: string;
    sessionId: string;
    redirectUri: string;
    scopes?: string | undefined;
  }): Promise<AuthorizeUrlResult> {
    validateLoopbackRedirectUri(params.redirectUri);

    const provider = this.providerRegistry.getProvider(params.providerId);
    const { clientId } = await this.providerRegistry.resolveCredentials(provider);

    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (provider.usesProofKey) {
      codeVerifier = crypto.randomBytes(32).toString('base64url');
      codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    }

    const { binding, expiresInSeconds } = await this.bindingStore.createBinding({
      providerId: provider.providerId,
      sessionId: params.sessionId,
      redirectUri: params.redirectUri,
      codeVerifier,
    });

    const url = new URL(provider.authorizeEndpoint);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', binding);

    const requestedScopes = params.scopes?.trim();
    const effectiveScopes = requestedScopes && requestedScopes.length > 0
      ? requestedScopes
      : provider.defaultScopes.join(' ');

    if (effectiveScopes.length > 0) {
      url.searchParams.set('scope', effectiveScopes);
    }

    if (codeChallenge) {
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
    }

    if (provider.extraAuthorizeParams) {
      for (const [key, val] of Object.entries(provider.extraAuthorizeParams)) {
        url.searchParams.set(key, String(val));
      }
    }

    return {
      providerId: provider.providerId,
      authorizeUrl: url.toString(),
      binding,
      expiresInSeconds,
    };
  }

  async exchangeCode(params: {
    providerId: string;
    sessionId: string;
    code: string;
    redirectUri: string;
    binding: string;
  }): Promise<ProviderTokens> {
    validateLoopbackRedirectUri(params.redirectUri);

    if (!params.code || typeof params.code !== 'string' || params.code.trim().length === 0) {
      throw new BackendError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'code is required',
      });
    }

    const provider = this.providerRegistry.getProvider(params.providerId);

    // Atomically consume binding BEFORE contacting provider
    const { codeVerifier } = await this.bindingStore.consumeBinding({
      binding: params.binding,
      providerId: provider.providerId,
      sessionId: params.sessionId,
      redirectUri: params.redirectUri,
    });

    const { clientId, clientSecret } = await this.providerRegistry.resolveCredentials(provider);

    const bodyParams = new URLSearchParams();
    bodyParams.set('grant_type', 'authorization_code');
    bodyParams.set('code', params.code);
    bodyParams.set('redirect_uri', params.redirectUri);

    if (codeVerifier) {
      bodyParams.set('code_verifier', codeVerifier);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };

    if (provider.tokenAuthMethod === 'credentials-in-header') {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${creds}`;
    } else {
      bodyParams.set('client_id', clientId);
      bodyParams.set('client_secret', clientSecret);
    }

    const res = await this.httpClient.request({
      url: provider.tokenEndpoint,
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    if (res.status < 200 || res.status >= 300) {
      const data = res.data as Record<string, unknown> | null;
      let reason = 'The provider rejected the exchange request';
      if (data && typeof data === 'object') {
        reason = String(
          data.error_description || data.error || data.message || reason
        );
      }
      throw new BackendError({
        statusCode: 424,
        code: 'PROVIDER_REJECTED',
        providerId: provider.providerId,
        providerReason: reason,
        message: `Provider rejected exchange: ${reason}`,
      });
    }

    return this.parseTokenResponse(provider.providerId, res.data);
  }

  async refreshProviderToken(params: {
    providerId: string;
    refreshToken: string;
  }): Promise<ProviderTokens> {
    if (!params.refreshToken || typeof params.refreshToken !== 'string' || params.refreshToken.trim().length === 0) {
      throw new BackendError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'refreshToken is required',
      });
    }

    const provider = this.providerRegistry.getProvider(params.providerId);
    const { clientId, clientSecret } = await this.providerRegistry.resolveCredentials(provider);

    const bodyParams = new URLSearchParams();
    bodyParams.set('grant_type', 'refresh_token');
    bodyParams.set('refresh_token', params.refreshToken);

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };

    if (provider.tokenAuthMethod === 'credentials-in-header') {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${creds}`;
    } else {
      bodyParams.set('client_id', clientId);
      bodyParams.set('client_secret', clientSecret);
    }

    const res = await this.httpClient.request({
      url: provider.tokenEndpoint,
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    if (res.status < 200 || res.status >= 300) {
      const data = res.data as Record<string, unknown> | null;
      let reason = 'The provider rejected the refresh request';
      if (data && typeof data === 'object') {
        reason = String(
          data.error_description || data.error || data.message || reason
        );
      }
      throw new BackendError({
        statusCode: 424,
        code: 'PROVIDER_REJECTED',
        providerId: provider.providerId,
        providerReason: reason,
        message: `Provider rejected refresh: ${reason}`,
      });
    }

    return this.parseTokenResponse(provider.providerId, res.data);
  }

  private parseTokenResponse(providerId: string, rawData: unknown): ProviderTokens {
    if (!rawData || typeof rawData !== 'object') {
      throw new BackendError({
        statusCode: 424,
        code: 'PROVIDER_UNREACHABLE',
        providerId,
        message: 'Invalid response from provider token endpoint',
      });
    }

    const data = rawData as Record<string, unknown>;
    const accessToken = typeof data.access_token === 'string' ? data.access_token : undefined;
    if (!accessToken) {
      throw new BackendError({
        statusCode: 424,
        code: 'PROVIDER_REJECTED',
        providerId,
        providerReason: 'Provider response omitted access_token',
      });
    }

    const tokenType = typeof data.token_type === 'string' ? data.token_type : 'Bearer';
    const expiresInSeconds = typeof data.expires_in === 'number' ? data.expires_in : undefined;
    const refreshToken = typeof data.refresh_token === 'string' ? data.refresh_token : undefined;
    const scope = typeof data.scope === 'string' ? data.scope : undefined;

    // Separate extras
    const standardKeys = new Set([
      'access_token',
      'token_type',
      'expires_in',
      'refresh_token',
      'scope',
    ]);
    const extras: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (!standardKeys.has(key)) {
        extras[key] = val;
      }
    }

    return {
      providerId,
      accessToken,
      tokenType,
      expiresInSeconds,
      refreshToken,
      scope,
      providerExtras: Object.keys(extras).length > 0 ? extras : undefined,
    };
  }
}
