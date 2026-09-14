export interface OAuthProviderConfig {
  id: string;
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  defaultScopes: string[];
  usePkce: boolean;
  tokenAuthMethod: 'client_secret_post' | 'client_secret_basic';
  extraAuthorizeParams?: Record<string, string>;
}

export interface AuthorizeUrlResult {
  provider: string;
  authorizeUrl: string;
  state: string;
}

export interface TokenExchangeResult {
  provider: string;
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
  extra?: Record<string, any>;
}
