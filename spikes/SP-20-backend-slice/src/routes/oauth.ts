import { FastifyPluginAsync } from 'fastify';
import { brokerService } from '../services/broker.service.js';

export const oauthRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/oauth/:provider/authorize-url — Authenticated
  fastify.get('/:provider/authorize-url', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const query = request.query as any;

    if (!query.redirect_uri) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing redirect_uri query parameter',
      });
    }

    try {
      const customScopes = query.scope ? query.scope.split(' ') : undefined;
      const result = brokerService.generateAuthorizeUrl(
        provider,
        query.redirect_uri,
        query.state,
        customScopes
      );
      return reply.status(200).send(result);
    } catch (err: any) {
      return reply.status(404).send({
        error: 'PROVIDER_NOT_FOUND',
        message: err.message,
      });
    }
  });

  // POST /v1/oauth/:provider/exchange — Authenticated
  // FR-CF-03: Exchanges authorization code for provider token using server-held client_secret.
  // FR-BE-02: Server DOES NOT store connector tokens in database.
  fastify.post('/:provider/exchange', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const body = request.body as any;

    if (!body || !body.code || !body.redirect_uri) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing code or redirect_uri in request body',
      });
    }

    try {
      const result = await brokerService.exchangeCode(
        provider,
        body.code,
        body.redirect_uri,
        body.code_verifier
      );
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send({
        error: 'EXCHANGE_FAILED',
        message: err.message,
        details: err.details,
      });
    }
  });

  // POST /v1/oauth/:provider/refresh — Authenticated
  // Refreshes connector token via broker when provider requires client_secret.
  fastify.post('/:provider/refresh', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const body = request.body as any;

    if (!body || !body.refresh_token) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing refresh_token in request body',
      });
    }

    try {
      const result = await brokerService.refreshToken(provider, body.refresh_token);
      return reply.status(200).send(result);
    } catch (err: any) {
      const status = err.statusCode || 500;
      return reply.status(status).send({
        error: 'REFRESH_FAILED',
        message: err.message,
        details: err.details,
      });
    }
  });
};
