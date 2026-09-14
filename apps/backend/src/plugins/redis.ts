import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../config.js';

export interface RedisPluginOptions {
  redis: AppConfig['redis'];
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    probeRedis: () => Promise<boolean>;
  }
}

const plugin: FastifyPluginAsync<RedisPluginOptions> = async (fastify, options) => {
  const client = new Redis(options.redis.url, {
    lazyConnect: true,
    connectTimeout: options.redis.connectTimeoutMs,
    maxRetriesPerRequest: options.redis.maxRetriesPerRequest,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > options.redis.maxRetriesPerRequest) {
        return null;
      }
      return Math.min(times * 100, 1000);
    },
  });

  client.on('error', err => {
    fastify.log.warn({ err: err.message }, 'Unexpected Redis client error');
  });

  // Connect and verify at startup
  await client.connect();
  await client.ping();

  fastify.decorate('redis', client);
  fastify.decorate('probeRedis', async (): Promise<boolean> => {
    try {
      const pong = await client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  });

  fastify.addHook('onClose', async () => {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  });
};

export const redisPlugin = fp(plugin, {
  name: 'redis-plugin',
});
