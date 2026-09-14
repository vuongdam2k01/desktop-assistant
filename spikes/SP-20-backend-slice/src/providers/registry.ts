import { OAuthProviderConfig } from './types.js';
import { config } from '../config.js';

// Provider Registry: Adding a new provider is done SOLELY by adding an entry here!
// Routes, controllers, and clients require ZERO modifications (FR-CF-03).
export const providers: Record<string, OAuthProviderConfig> = {
  notion: {
    id: 'notion',
    name: 'Notion',
    authorizeUrl: config.notion.authorizeUrl,
    tokenUrl: config.notion.tokenUrl,
    clientId: config.notion.clientId,
    clientSecret: config.notion.clientSecret,
    defaultScopes: [],
    usePkce: false,
    tokenAuthMethod: 'client_secret_basic',
    extraAuthorizeParams: {
      owner: 'user',
      response_type: 'code',
    },
  },
  google: {
    id: 'google',
    name: 'Google',
    authorizeUrl: config.google.authorizeUrl,
    tokenUrl: config.google.tokenUrl,
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    defaultScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    usePkce: true,
    tokenAuthMethod: 'client_secret_post',
    extraAuthorizeParams: {
      access_type: 'offline',
      prompt: 'consent',
      response_type: 'code',
    },
  },
};

export function getProviderConfig(providerId: string): OAuthProviderConfig | null {
  return providers[providerId.toLowerCase()] || null;
}
