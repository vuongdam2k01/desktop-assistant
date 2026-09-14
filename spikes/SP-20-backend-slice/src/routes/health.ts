import { FastifyPluginAsync } from 'fastify';
import { queryOne } from '../db/index.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/health — Public (FR-BE-11)
  fastify.get('/', async (request, reply) => {
    let dbStatus = 'healthy';
    try {
      await queryOne('SELECT 1 as alive;');
    } catch (err) {
      dbStatus = 'unhealthy';
    }

    const uptime = process.uptime();
    const memory = process.memoryUsage();

    return reply.status(200).send({
      status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
      service: 'desktop-assistant-backend',
      version: '0.1.0-beta.1',
      uptimeSeconds: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      database: dbStatus,
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
      },
    });
  });
};
