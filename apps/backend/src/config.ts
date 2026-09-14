import path from 'node:path';
import fs from 'node:fs';

export interface RateLimitClassConfig {
  max: number;
  timeWindowMs: number;
}

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  host: string;
  port: number;
  enforceTls: boolean;
  trustProxy: boolean | string | string[];
  database: {
    url: string;
    poolMin: number;
    poolMax: number;
    connectTimeoutMs: number;
    idleTimeoutMs: number;
    statementTimeoutMs: number;
  };
  redis: {
    url: string;
    connectTimeoutMs: number;
    maxRetriesPerRequest: number;
  };
  google: {
    clientId: string;
  };
  jwt: {
    issuer: string;
    audience: string;
    keyRingSecretRef: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
  };
  providers: {
    descriptorDirectory: string;
    requestTimeoutMs: number;
  };
  updateFeed: {
    rootDirectory: string;
  };
  appVersion: {
    currentVersion: string;
    minimumSupportedVersion: string;
    mandatory: boolean;
    manifestUri?: string | undefined;
    releaseNotesUri?: string | undefined;
  };
  rateLimit: {
    public: RateLimitClassConfig;
    auth: RateLimitClassConfig;
    broker: RateLimitClassConfig;
  };
  replication: {
    enabled: boolean;
  };
}

function resolvePath(relativePath: string, envVal?: string): string {
  if (envVal && envVal.trim().length > 0) {
    return path.resolve(envVal);
  }
  const cwd = process.cwd();
  const direct = path.resolve(cwd, relativePath);
  if (fs.existsSync(direct)) {
    return direct;
  }
  const inApp = path.resolve(cwd, 'apps/backend', relativePath);
  if (fs.existsSync(inApp)) {
    return inApp;
  }
  return direct;
}

function parseTrustProxy(val?: string): boolean | string | string[] {
  if (!val || val.trim().length === 0 || val === 'false') {
    return false;
  }
  if (val === 'true') {
    return true;
  }
  if (val.includes(',')) {
    return val.split(',').map(s => s.trim());
  }
  return val.trim();
}

function parsePositiveInt(val: string | undefined, defaultVal: number, name: string): number {
  if (!val || val.trim().length === 0) {
    return defaultVal;
  }
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid positive integer for ${name}: "${val}"`);
  }
  return parsed;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const nodeEnvRaw = env.NODE_ENV?.toLowerCase();
  const nodeEnv: 'development' | 'production' | 'test' =
    nodeEnvRaw === 'production' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'development';

  const enforceTlsRaw = env.ENFORCE_TLS?.toLowerCase();
  let enforceTls: boolean;
  if (nodeEnv === 'production') {
    if (enforceTlsRaw === 'false') {
      throw new Error('Production startup rejects ENFORCE_TLS=false');
    }
    enforceTls = true;
  } else {
    enforceTls = enforceTlsRaw === 'true';
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl || typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is required in environment');
  }

  const host = env.HOST || '127.0.0.1';
  const port = env.PORT ? parseInt(env.PORT, 10) : 4000;
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: "${env.PORT}"`);
  }

  const redisUrl = env.REDIS_URL || 'redis://127.0.0.1:63790';

  const replicationEnabled = env.REPLICATION_ENABLED === 'true';

  return {
    nodeEnv,
    host,
    port,
    enforceTls,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    database: {
      url: databaseUrl,
      poolMin: parsePositiveInt(env.DATABASE_POOL_MIN, 2, 'DATABASE_POOL_MIN'),
      poolMax: parsePositiveInt(env.DATABASE_POOL_MAX, 10, 'DATABASE_POOL_MAX'),
      connectTimeoutMs: parsePositiveInt(env.DATABASE_CONNECT_TIMEOUT_MS, 2000, 'DATABASE_CONNECT_TIMEOUT_MS'),
      idleTimeoutMs: parsePositiveInt(env.DATABASE_IDLE_TIMEOUT_MS, 10000, 'DATABASE_IDLE_TIMEOUT_MS'),
      statementTimeoutMs: parsePositiveInt(env.DATABASE_STATEMENT_TIMEOUT_MS, 5000, 'DATABASE_STATEMENT_TIMEOUT_MS'),
    },
    redis: {
      url: redisUrl,
      connectTimeoutMs: parsePositiveInt(env.REDIS_CONNECT_TIMEOUT_MS, 2000, 'REDIS_CONNECT_TIMEOUT_MS'),
      maxRetriesPerRequest: parsePositiveInt(env.REDIS_MAX_RETRIES, 3, 'REDIS_MAX_RETRIES'),
    },
    google: {
      clientId: env.GOOGLE_SIGN_IN_CLIENT_ID || 'dev-google-sign-in-client-id',
    },
    jwt: {
      issuer: env.JWT_ISSUER || 'desktop-assistant-backend',
      audience: env.JWT_AUDIENCE || 'desktop-assistant-client',
      keyRingSecretRef: env.JWT_KEY_RING_SECRET_REF || 'JWT_KEY_RING',
      accessTokenTtlSeconds: parsePositiveInt(env.JWT_ACCESS_TOKEN_TTL_SECONDS, 900, 'JWT_ACCESS_TOKEN_TTL_SECONDS'),
      refreshTokenTtlSeconds: parsePositiveInt(env.JWT_REFRESH_TOKEN_TTL_SECONDS, 2592000, 'JWT_REFRESH_TOKEN_TTL_SECONDS'),
    },
    providers: {
      descriptorDirectory: resolvePath('config/providers', env.PROVIDER_DESCRIPTOR_DIRECTORY),
      requestTimeoutMs: parsePositiveInt(env.PROVIDER_REQUEST_TIMEOUT_MS, 10000, 'PROVIDER_REQUEST_TIMEOUT_MS'),
    },
    updateFeed: {
      rootDirectory: resolvePath('update-feed', env.UPDATE_FEED_ROOT),
    },
    appVersion: {
      currentVersion: env.APP_CURRENT_VERSION || '0.1.0',
      minimumSupportedVersion: env.APP_MINIMUM_SUPPORTED_VERSION || '0.1.0',
      mandatory: env.APP_UPDATE_MANDATORY === 'true',
      manifestUri: env.APP_MANIFEST_URI,
      releaseNotesUri: env.APP_RELEASE_NOTES_URI,
    },
    rateLimit: {
      public: {
        max: parsePositiveInt(env.RATE_LIMIT_PUBLIC_MAX, 100, 'RATE_LIMIT_PUBLIC_MAX'),
        timeWindowMs: parsePositiveInt(env.RATE_LIMIT_PUBLIC_TIME_WINDOW_MS, 60000, 'RATE_LIMIT_PUBLIC_TIME_WINDOW_MS'),
      },
      auth: {
        max: parsePositiveInt(env.RATE_LIMIT_AUTH_MAX, 20, 'RATE_LIMIT_AUTH_MAX'),
        timeWindowMs: parsePositiveInt(env.RATE_LIMIT_AUTH_TIME_WINDOW_MS, 60000, 'RATE_LIMIT_AUTH_TIME_WINDOW_MS'),
      },
      broker: {
        max: parsePositiveInt(env.RATE_LIMIT_BROKER_MAX, 30, 'RATE_LIMIT_BROKER_MAX'),
        timeWindowMs: parsePositiveInt(env.RATE_LIMIT_BROKER_TIME_WINDOW_MS, 60000, 'RATE_LIMIT_BROKER_TIME_WINDOW_MS'),
      },
    },
    replication: {
      enabled: replicationEnabled,
    },
  };
}
