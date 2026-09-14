import { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

export const appRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/app/version — Public (FR-BE-09)
  fastify.get('/version', async (request, reply) => {
    return reply.status(200).send(config.appVersion);
  });
};
