import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionService } from '../auth/session-service.js';

export interface SessionRoutesOptions {
  sessionService: SessionService;
  authenticateSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export const sessionRoutes: FastifyPluginAsync<SessionRoutesOptions> = async (fastify, options) => {
  const authRateLimit = fastify.rateLimitConfigs?.auth ?? {
    max: 20,
    timeWindowMs: 60000,
  };

  fastify.post<{
    Body: {
      idToken: string;
      deviceId: string;
      deviceName?: string;
    };
  }>(
    '/v1/auth/google',
    {
      config: {
        rateLimit: {
          max: authRateLimit.max,
          timeWindow: authRateLimit.timeWindowMs,
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['idToken', 'deviceId'],
          additionalProperties: false,
          properties: {
            idToken: { type: 'string', minLength: 1 },
            deviceId: { type: 'string', minLength: 1 },
            deviceName: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await options.sessionService.signInGoogle(request.body);
      return reply.status(200).send(result);
    }
  );

  fastify.post<{
    Body: {
      refreshToken: string;
    };
  }>(
    '/v1/auth/refresh',
    {
      config: {
        rateLimit: {
          max: authRateLimit.max,
          timeWindow: authRateLimit.timeWindowMs,
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          additionalProperties: false,
          properties: {
            refreshToken: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await options.sessionService.refreshSession(request.body.refreshToken);
      return reply.status(200).send(result);
    }
  );

  fastify.post<{
    Body: {
      refreshToken: string;
    };
  }>(
    '/v1/auth/logout',
    {
      config: {
        rateLimit: {
          max: authRateLimit.max,
          timeWindow: authRateLimit.timeWindowMs,
        },
      },
      preHandler: [options.authenticateSession],
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          additionalProperties: false,
          properties: {
            refreshToken: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const session = request.session!;
      const result = await options.sessionService.logoutSession({
        authenticatedAccountId: session.accountId,
        authenticatedDeviceId: session.deviceId,
        authenticatedSessionId: session.sessionId,
        refreshToken: request.body.refreshToken,
      });
      return reply.status(200).send(result);
    }
  );
};
