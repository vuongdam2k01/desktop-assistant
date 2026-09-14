import { FastifyPluginAsync } from 'fastify';
import { authService } from '../services/auth.service.js';

export const accountRoutes: FastifyPluginAsync = async (fastify) => {
  // DELETE /v1/account — Authenticated (FR-BE-12)
  fastify.delete('/', async (request, reply) => {
    const user = (request as any).user;
    if (!user || !user.sub) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    try {
      const result = await authService.deleteAccount(user.sub);
      return reply.status(200).send({
        success: true,
        message: 'Account, devices, sessions, and allowlist entries completely deleted from backend',
        ...result,
      });
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send({
        error: 'DELETE_ACCOUNT_FAILED',
        message: err.message,
      });
    }
  });
};
