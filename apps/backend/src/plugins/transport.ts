import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { BackendError } from '../http/errors.js';

export interface TransportPluginOptions {
  enforceTls: boolean;
}

const plugin: FastifyPluginAsync<TransportPluginOptions> = async (fastify, options) => {
  if (options.enforceTls) {
    fastify.addHook('onRequest', async (request, _reply) => {
      if (request.protocol !== 'https') {
        throw new BackendError({
          statusCode: 426,
          code: 'HTTPS_REQUIRED',
          message: 'HTTPS is required',
        });
      }
    });
  }
};

export const transportPlugin = fp(plugin, {
  name: 'transport-plugin',
});
