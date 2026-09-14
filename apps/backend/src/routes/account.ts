import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { AccountService } from '../account/account-service.js';

export interface AccountRoutesOptions {
  accountService: AccountService;
  authenticateSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export const accountRoutes: FastifyPluginAsync<AccountRoutesOptions> = async (fastify, options) => {
  const authRateLimit = fastify.rateLimitConfigs?.auth ?? {
    max: 20,
    timeWindowMs: 60000,
  };

  fastify.delete(
    '/v1/account',
    {
      config: {
        rateLimit: {
          max: authRateLimit.max,
          timeWindow: authRateLimit.timeWindowMs,
        },
      },
      preHandler: [options.authenticateSession],
    },
    async (request, reply) => {
      const session = request.session!;
      const result = await options.accountService.deleteAccount(session.accountId);
      return reply.status(200).send(result);
    }
  );
};
