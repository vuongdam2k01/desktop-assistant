import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://postgres:devpassword@127.0.0.1:54320/desktop_assistant_dev',
      REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:63790',
      JWT_KEY_RING:
        process.env.JWT_KEY_RING ||
        '{"currentKid":"k1","keys":{"k1":"dev-signing-key-minimum-256-bits-length-for-hmac-sha256-safety"}}',
      NOTION_CLIENT_ID: 'dev-notion-client-id',
      NOTION_CLIENT_SECRET: 'dev-notion-client-secret',
      GOOGLE_OAUTH_CLIENT_ID: 'dev-google-oauth-client-id',
      GOOGLE_OAUTH_CLIENT_SECRET: 'dev-google-oauth-client-secret',
      RATE_LIMIT_PUBLIC_MAX: '10000',
      RATE_LIMIT_AUTH_MAX: '10000',
      RATE_LIMIT_BROKER_MAX: '10000',
    },
  },
});
