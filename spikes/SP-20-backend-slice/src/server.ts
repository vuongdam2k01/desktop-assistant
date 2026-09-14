import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { getDb } from './db/index.js';
import { authRoutes } from './routes/auth.js';
import { oauthRoutes } from './routes/oauth.js';
import { accountRoutes } from './routes/account.js';
import { appRoutes } from './routes/app.js';
import { healthRoutes } from './routes/health.js';

export async function buildServer(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const server = fastify({
    logger: options.logger ?? {
      level: 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          '*.client_secret',
          '*.clientSecret',
          '*.refreshToken',
          '*.refresh_token',
          '*.accessToken',
          '*.access_token',
        ],
        censor: '[REDACTED]',
      },
    },
  });

  // Enable CORS
  await server.register(cors, {
    origin: true,
  });

  // Rate Limiting (FR-BE-11)
  await server.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    allowList: ['127.0.0.1'], // Can be overridden in tests
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${context.after}`,
    }),
  });

  // Ensure Database is initialized and migrated
  await getDb();

  // Authentication Hook (FR-BE-08):
  // Every endpoint except auth login/refresh, version check, and health requires a valid JWT.
  server.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0];

    // Public endpoints
    const isPublic =
      url === '/v1/health' ||
      url === '/v1/app/version' ||
      url === '/v1/auth/google' ||
      url === '/v1/auth/refresh';

    if (isPublic) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header (Bearer token required)',
      });
    }

    const token = authHeader.substring(7).trim();
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      (request as any).user = decoded;
    } catch (err: any) {
      const isExpired = err.name === 'TokenExpiredError';
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: isExpired ? 'JWT token has expired' : 'Invalid JWT token or signature',
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      });
    }
  });

  // Register Routes
  await server.register(authRoutes, { prefix: '/v1/auth' });
  await server.register(oauthRoutes, { prefix: '/v1/oauth' });
  await server.register(accountRoutes, { prefix: '/v1/account' });
  await server.register(appRoutes, { prefix: '/v1/app' });
  await server.register(healthRoutes, { prefix: '/v1/health' });

  return server;
}

export async function startServer() {
  const server = await buildServer({ logger: true });
  try {
    const address = await server.listen({
      port: config.port,
      host: config.host,
    });
    console.log(`[SP-20 Backend] Server listening at ${address}`);
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Auto-start when executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer();
}
