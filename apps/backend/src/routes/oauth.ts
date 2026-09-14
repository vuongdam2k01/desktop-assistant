import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { OAuthBrokerService } from '../oauth/oauth-broker-service.js';

export interface OAuthRoutesOptions {
  oauthBrokerService: OAuthBrokerService;
  authenticateSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export const oauthRoutes: FastifyPluginAsync<OAuthRoutesOptions> = async (fastify, options) => {
  const brokerRateLimit = fastify.rateLimitConfigs?.broker ?? {
    max: 30,
    timeWindowMs: 60000,
  };

  fastify.get<{
    Params: { provider: string };
    Querystring: { redirectUri: string; scopes?: string | undefined };
  }>(
    '/v1/oauth/:provider/authorize-url',
    {
      config: {
        rateLimit: {
          max: brokerRateLimit.max,
          timeWindow: brokerRateLimit.timeWindowMs,
        },
      },
      preHandler: [options.authenticateSession],
      schema: {
        params: {
          type: 'object',
          required: ['provider'],
          properties: {
            provider: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,31}$' },
          },
        },
        querystring: {
          type: 'object',
          required: ['redirectUri'],
          properties: {
            redirectUri: { type: 'string', minLength: 1 },
            scopes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const session = request.session!;
      const result = await options.oauthBrokerService.getAuthorizeUrl({
        providerId: request.params.provider,
        sessionId: session.sessionId,
        redirectUri: request.query.redirectUri,
        scopes: request.query.scopes,
      });
      return reply.status(200).send(result);
    }
  );

  fastify.post<{
    Params: { provider: string };
    Body: { code: string; redirectUri: string; binding: string };
  }>(
    '/v1/oauth/:provider/exchange',
    {
      config: {
        rateLimit: {
          max: brokerRateLimit.max,
          timeWindow: brokerRateLimit.timeWindowMs,
        },
      },
      preHandler: [options.authenticateSession],
      schema: {
        params: {
          type: 'object',
          required: ['provider'],
          properties: {
            provider: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,31}$' },
          },
        },
        body: {
          type: 'object',
          required: ['code', 'redirectUri', 'binding'],
          additionalProperties: false,
          properties: {
            code: { type: 'string', minLength: 1 },
            redirectUri: { type: 'string', minLength: 1 },
            binding: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const session = request.session!;
      const result = await options.oauthBrokerService.exchangeCode({
        providerId: request.params.provider,
        sessionId: session.sessionId,
        code: request.body.code,
        redirectUri: request.body.redirectUri,
        binding: request.body.binding,
      });
      return reply.status(200).send(result);
    }
  );

  fastify.post<{
    Params: { provider: string };
    Body: { refreshToken: string };
  }>(
    '/v1/oauth/:provider/refresh',
    {
      config: {
        rateLimit: {
          max: brokerRateLimit.max,
          timeWindow: brokerRateLimit.timeWindowMs,
        },
      },
      preHandler: [options.authenticateSession],
      schema: {
        params: {
          type: 'object',
          required: ['provider'],
          properties: {
            provider: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,31}$' },
          },
        },
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
      const result = await options.oauthBrokerService.refreshProviderToken({
        providerId: request.params.provider,
        refreshToken: request.body.refreshToken,
      });
      return reply.status(200).send(result);
    }
  );
};
