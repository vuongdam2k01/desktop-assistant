import crypto from 'node:crypto';
import { getProviderConfig } from '../providers/registry.js';
import { AuthorizeUrlResult, TokenExchangeResult } from '../providers/types.js';

export class OAuthBrokerService {
  /**
   * Generates the authorization URL for the specified provider.
   */
  public generateAuthorizeUrl(
    providerId: string,
    redirectUri: string,
    state?: string,
    customScopes?: string[]
  ): AuthorizeUrlResult {
    const config = getProviderConfig(providerId);
    if (!config) {
      throw new Error(`Unsupported provider: ${providerId}`);
    }

    const stateValue = state || crypto.randomBytes(16).toString('hex');
    const url = new URL(config.authorizeUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', stateValue);

    const scopes = customScopes && customScopes.length > 0 ? customScopes : config.defaultScopes;
    if (scopes.length > 0) {
      url.searchParams.set('scope', scopes.join(' '));
    }

    if (config.extraAuthorizeParams) {
      for (const [k, v] of Object.entries(config.extraAuthorizeParams)) {
        url.searchParams.set(k, v);
      }
    }

    return {
      provider: config.id,
      authorizeUrl: url.toString(),
      state: stateValue,
    };
  }

  /**
   * Exchanges an authorization code for tokens using server-held client_secret.
   * CRITICAL ARCHITECTURAL GUARANTEE (FR-BE-02, NFR-BE-05):
   * This method NEVER stores the tokens in the database or server filesystem.
   * Tokens are directly passed through to the client over TLS.
   */
  public async exchangeCode(
    providerId: string,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<TokenExchangeResult> {
    const config = getProviderConfig(providerId);
    if (!config) {
      throw new Error(`Unsupported provider: ${providerId}`);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    if (config.tokenAuthMethod === 'client_secret_basic') {
      const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    } else {
      bodyParams.set('client_id', config.clientId);
      bodyParams.set('client_secret', config.clientSecret);
    }

    if (config.usePkce && codeVerifier) {
      bodyParams.set('code_verifier', codeVerifier);
    }

    // Call provider token endpoint
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data.error_description || data.error || `Provider returned status ${response.status}`;
      const err: any = new Error(`OAuth token exchange failed: ${errMsg}`);
      err.statusCode = response.status;
      err.details = data;
      throw err;
    }

    // Return token without writing to database
    return {
      provider: config.id,
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
      scope: data.scope,
      extra: {
        workspace_id: data.workspace_id,
        workspace_name: data.workspace_name,
        bot_id: data.bot_id,
        owner: data.owner,
      }
    };
  }

  /**
   * Refreshes a provider token using server-held client_secret when required.
   * Tokens are NOT saved in server DB.
   */
  public async refreshToken(
    providerId: string,
    refreshToken: string
  ): Promise<TokenExchangeResult> {
    const config = getProviderConfig(providerId);
    if (!config) {
      throw new Error(`Unsupported provider: ${providerId}`);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    if (config.tokenAuthMethod === 'client_secret_basic') {
      const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    } else {
      bodyParams.set('client_id', config.clientId);
      bodyParams.set('client_secret', config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data.error_description || data.error || `Provider returned status ${response.status}`;
      const err: any = new Error(`OAuth token refresh failed: ${errMsg}`);
      err.statusCode = response.status;
      err.details = data;
      throw err;
    }

    return {
      provider: config.id,
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token || refreshToken, // rotate or keep
      scope: data.scope,
    };
  }
}

export const brokerService = new OAuthBrokerService();
