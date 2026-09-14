import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Load root spikes .env.local if present
const rootEnvPath = path.resolve(process.cwd(), '../../.env.local');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
// Also load local .env if present
dotenv.config();

// Attempt to read Google OAuth client from secrets manager directory
let googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
let googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

const googleClientJsonPath = path.resolve(process.cwd(), '../../secrets/google-oauth-client.json');
if ((!googleClientId || !googleClientSecret) && fs.existsSync(googleClientJsonPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(googleClientJsonPath, 'utf8'));
    const inst = raw.installed || raw.web || {};
    googleClientId = inst.client_id || googleClientId;
    googleClientSecret = inst.client_secret || googleClientSecret;
  } catch (err) {
    // ignore
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '127.0.0.1',
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'sp20-dev-jwt-secret-key-32-chars-min!!',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresInDays: 30,
  databaseUrl: process.env.DATABASE_URL || '',
  dbDataDir: path.resolve(process.cwd(), './data/pglite'),
  
  // Rate limiting options (FR-BE-11)
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '60', 10), // max requests
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  },

  // OAuth Provider Secrets (NFR-BE-03)
  notion: {
    clientId: process.env.NOTION_OAUTH_CLIENT_ID || 'notion_sp20_client_id_placeholder',
    clientSecret: process.env.NOTION_OAUTH_CLIENT_SECRET || 'notion_sp20_client_secret_placeholder',
    authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
  },

  google: {
    clientId: googleClientId || 'google_sp20_client_id_placeholder',
    clientSecret: googleClientSecret || 'google_sp20_client_secret_placeholder',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },

  appVersion: {
    version: '0.1.0-beta.1',
    minClientVersion: '0.1.0',
    releaseNotesUrl: 'https://github.com/vuongdam2k01/desktop-assistant/releases',
    mandatory: false,
    updateUrl: 'https://releases.desktopassistant.local/v0.1.0/update.json'
  }
};
