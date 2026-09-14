import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';
import type { RateLimitClassConfig } from '../config.js';

export interface RateLimitPluginOptions {
  rateLimit: {
    public: RateLimitClassConfig;
    auth: RateLimitClassConfig;
    broker: RateLimitClassConfig;
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    rateLimitConfigs: {
      public: RateLimitClassConfig;
      auth: RateLimitClassConfig;
      broker: RateLimitClassConfig;
    };
  }
}

const plugin: FastifyPluginAsync<RateLimitPluginOptions> = async (fastify, options) => {
  fastify.decorate('rateLimitConfigs', options.rateLimit);

  // If redis is available, use it as store, otherwise in-memory fallback for isolated tests
  const redisClient = fastify.hasDecorator('redis') ? fastify.redis : undefined;

  await fastify.register(fastifyRateLimit, {
    global: false,
    hook: 'onRequest',
    redis: redisClient,
    errorResponseBuilder: (request, context) => {
      const rawTtl = context.ttl;
      const ttlSeconds = Math.max(1, Math.ceil(rawTtl / 1000));
      request.log.warn(
        {
          event: 'rate_limited',
          route: request.url,
          retryAfterSeconds: ttlSeconds,
        },
        'Rate limit exceeded'
      );
      return {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        retryAfterSeconds: ttlSeconds,
      };
    },
  });
};

export const rateLimitPlugin = fp(plugin, {
  name: 'rate-limit-plugin',
  dependencies: [],
});
