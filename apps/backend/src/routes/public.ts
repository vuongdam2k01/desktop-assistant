import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../config.js';
import type { components } from '@desktop-assistant/contracts/public-service-endpoints';

type HealthResult = components['schemas']['HealthResult'];
type VersionResult = components['schemas']['VersionResult'];

export interface PublicRoutesOptions {
  appVersion: AppConfig['appVersion'];
}

export const publicRoutes: FastifyPluginAsync<PublicRoutesOptions> = async (fastify, options) => {
  const publicRateLimit = fastify.rateLimitConfigs?.public ?? {
    max: 100,
    timeWindowMs: 60000,
  };

  fastify.get<{ Reply: HealthResult }>(
    '/v1/health',
    {
      config: {
        rateLimit: {
          max: publicRateLimit.max,
          timeWindow: publicRateLimit.timeWindowMs,
        },
      },
    },
    async (_request, reply) => {
      const storeReachable = await fastify.probeStore();
      const result: HealthResult = {
        status: storeReachable ? 'healthy' : 'unhealthy',
        storeReachable,
        uptimeSeconds: Math.floor(process.uptime()),
      };
      return reply.status(200).send(result);
    }
  );

  fastify.get<{ Reply: VersionResult }>(
    '/v1/app/version',
    {
      config: {
        rateLimit: {
          max: publicRateLimit.max,
          timeWindow: publicRateLimit.timeWindowMs,
        },
      },
    },
    async (_request, reply) => {
      const v = options.appVersion;
      const result: VersionResult = {
        currentVersion: v.currentVersion,
        minimumSupportedVersion: v.minimumSupportedVersion,
        mandatory: v.mandatory,
      };
      if (v.manifestUri) {
        result.manifestUri = v.manifestUri;
      }
      if (v.releaseNotesUri) {
        result.releaseNotesUri = v.releaseNotesUri;
      }
      return reply.status(200).send(result);
    }
  );
};
