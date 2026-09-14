import fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from './config.js';
import { handleAppError } from './http/error-handler.js';
import { transportPlugin } from './plugins/transport.js';
import { databasePlugin } from './plugins/database.js';
import { redisPlugin } from './plugins/redis.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { EnvironmentSecretResolver, type SecretResolver } from './secrets/environment-secret-resolver.js';
import { type IdentityVerifier } from './auth/identity-verifier.js';
import { GoogleIdentityVerifier } from './auth/google-identity-verifier.js';
import { SessionTokenService } from './auth/session-token-service.js';
import { SessionService } from './auth/session-service.js';
import { createAuthenticateSession } from './auth/session-guard.js';
import { sessionRoutes } from './routes/session.js';
import { ProviderRegistry } from './oauth/provider-registry.js';
import { AuthorizationBindingStore } from './oauth/authorization-binding-store.js';
import { type ProviderHttpClient, FetchProviderHttpClient } from './oauth/provider-http-client.js';
import { OAuthBrokerService } from './oauth/oauth-broker-service.js';
import { oauthRoutes } from './routes/oauth.js';
import { publicRoutes } from './routes/public.js';
import { type AccountDataLifecycle, EmptyAccountDataLifecycle } from './account/account-data-lifecycle.js';
import { AccountService } from './account/account-service.js';
import { accountRoutes } from './routes/account.js';
import { updateFeedRoutes } from './routes/update-feed.js';
import { buildLoggerOptions } from './http/log-redaction.js';

export interface BuildAppDependencies {
  identityVerifier?: IdentityVerifier;
  providerHttpClient?: ProviderHttpClient;
  accountDataLifecycle?: AccountDataLifecycle;
  secretResolver?: SecretResolver;
}

export interface BuildAppOptions {
  config?: AppConfig;
  env?: Record<string, string | undefined>;
  logger?: boolean;
  dependencies?: BuildAppDependencies;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig(options.env);

  if (config.replication.enabled && !options.dependencies?.accountDataLifecycle) {
    throw new Error('REPLICATION_ENABLED=true requires a real AccountDataLifecycle implementation');
  }

  const app = fastify({
    trustProxy: config.trustProxy,
    logger: options.logger === false ? false : buildLoggerOptions(),
  });

  // 1. Transport and error policy
  app.setErrorHandler(handleAppError);
  await app.register(transportPlugin, { enforceTls: config.enforceTls });

  // 2. PostgreSQL store
  await app.register(databasePlugin, { database: config.database });

  // 3. Redis store
  await app.register(redisPlugin, { redis: config.redis });

  // 4. Rate limiting (distributed via Redis)
  await app.register(rateLimitPlugin, { rateLimit: config.rateLimit });

  // 5. Session authentication and lifecycle
  const secretResolver = options.dependencies?.secretResolver ?? new EnvironmentSecretResolver(options.env);

  const identityVerifier =
    options.dependencies?.identityVerifier ??
    new GoogleIdentityVerifier(config.google.clientId);

  const sessionTokenService = new SessionTokenService({
    secretResolver,
    keyRingSecretRef: config.jwt.keyRingSecretRef,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    accessTokenTtlSeconds: config.jwt.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: config.jwt.refreshTokenTtlSeconds,
  });

  const sessionService = new SessionService(app.pgPool, identityVerifier, sessionTokenService);
  const authenticateSession = createAuthenticateSession(app.pgPool, sessionTokenService);

  await app.register(sessionRoutes, {
    sessionService,
    authenticateSession,
  });

  // 6. Provider registry and OAuth broker
  const providerHttpClient =
    options.dependencies?.providerHttpClient ??
    new FetchProviderHttpClient(config.providers.requestTimeoutMs);

  const providerRegistry = new ProviderRegistry(
    config.providers.descriptorDirectory,
    secretResolver,
    app.log
  );
  await providerRegistry.load();

  const bindingStore = new AuthorizationBindingStore(app.redis);
  const oauthBrokerService = new OAuthBrokerService(providerRegistry, bindingStore, providerHttpClient);

  await app.register(oauthRoutes, {
    oauthBrokerService,
    authenticateSession,
  });

  // 7. Public routes
  await app.register(publicRoutes, {
    appVersion: config.appVersion,
  });

  // 8. Account deletion and lifecycle
  const accountDataLifecycle =
    options.dependencies?.accountDataLifecycle ??
    new EmptyAccountDataLifecycle();

  const accountService = new AccountService(
    app.pgPool,
    providerRegistry,
    providerHttpClient,
    accountDataLifecycle,
    app.log
  );

  await app.register(accountRoutes, {
    accountService,
    authenticateSession,
  });

  // 9. Static update feed
  await app.register(updateFeedRoutes, {
    rootDirectory: config.updateFeed.rootDirectory,
  });

  return app;
}
