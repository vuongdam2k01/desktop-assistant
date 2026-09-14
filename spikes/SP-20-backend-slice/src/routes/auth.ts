import { FastifyPluginAsync } from 'fastify';
import { authService } from '../services/auth.service.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/auth/google — Public
  fastify.post('/google', async (request, reply) => {
    const body = request.body as any;
    if (!body || !body.id_token || !body.device_id) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing id_token or device_id in request body',
      });
    }

    try {
      const tokens = await authService.authenticateWithGoogle(
        body.id_token,
        body.device_id,
        body.device_name
      );
      return reply.status(200).send(tokens);
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send({
        error: err.code || 'AUTH_ERROR',
        message: err.message,
      });
    }
  });

  // POST /v1/auth/refresh — Public with Refresh Token
  fastify.post('/refresh', async (request, reply) => {
    const body = request.body as any;
    if (!body || !body.refresh_token) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing refresh_token in request body',
      });
    }

    try {
      const tokens = await authService.refreshAppSession(body.refresh_token);
      return reply.status(200).send(tokens);
    } catch (err: any) {
      const status = err.statusCode || 401;
      return reply.status(status).send({
        error: 'INVALID_REFRESH_TOKEN',
        message: err.message,
      });
    }
  });

  // POST /v1/auth/logout — Authenticated
  fastify.post('/logout', async (request, reply) => {
    // Requires JWT (enforced by auth hook)
    const user = (request as any).user;
    const body = (request as any).body || {};

    if (body.refresh_token) {
      const parts = body.refresh_token.split('.');
      if (parts.length === 2) {
        await authService.logout(parts[0]);
      }
    }

    return reply.status(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  });
};
