import type { FastifyReply, FastifyRequest } from 'fastify';
import { BackendError } from './errors.js';

export function handleAppError(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (error instanceof BackendError) {
    if (error.statusCode === 429 || error.code === 'RATE_LIMITED') {
      const retryAfter = error.retryAfterSeconds ?? 60;
      reply.header('Retry-After', String(retryAfter));
      reply.status(429).send({
        code: 'RATE_LIMITED',
        message: error.message,
        retryAfterSeconds: retryAfter,
      });
      return;
    }

    if (error.code === 'PROVIDER_REJECTED') {
      reply.status(error.statusCode).send({
        code: error.code,
        providerId: error.providerId,
        providerReason: error.providerReason ?? 'The provider rejected the request',
      });
      return;
    }

    if (error.code === 'PROVIDER_UNREACHABLE' || error.code === 'PROVIDER_UNSUPPORTED') {
      reply.status(error.statusCode).send({
        code: error.code,
        providerId: error.providerId,
      });
      return;
    }

    reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
    });
    return;
  }

  const errObj = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;

  // Rate-limit plugin errors
  if (errObj.statusCode === 429 || errObj.code === 'FST_ERR_RATE_LIMIT_EXCEEDED' || errObj.code === 'RATE_LIMITED') {
    const rawTtl = typeof errObj.ttl === 'number' ? errObj.ttl : 60000;
    const retryAfter = typeof errObj.retryAfterSeconds === 'number'
      ? errObj.retryAfterSeconds
      : Math.max(1, Math.ceil(rawTtl / 1000));
    reply.header('Retry-After', String(retryAfter));
    reply.status(429).send({
      code: 'RATE_LIMITED',
      retryAfterSeconds: retryAfter,
    });
    return;
  }

  // Schema validation errors from Fastify
  if ('validation' in errObj && errObj.validation) {
    reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload or parameters',
    });
    return;
  }

  // Range Not Satisfiable (RFC 7233 / RFC 9110 from static file serving)
  if (errObj.statusCode === 416) {
    const rangeHeader = errObj.headers && typeof errObj.headers === 'object' ? (errObj.headers as Record<string, string>)['content-range'] : undefined;
    if (rangeHeader) {
      reply.header('Content-Range', rangeHeader);
    }
    reply.status(416).send({
      code: 'RANGE_NOT_SATISFIABLE',
      message: 'Requested range not satisfiable',
    });
    return;
  }

  // Not found
  if (errObj.statusCode === 404) {
    reply.status(404).send({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
    return;
  }
  // Unhandled / unexpected internal errors - never leak internal stack or message
  const errName = error instanceof Error ? error.name : 'Error';
  request.log.error(
    {
      event: 'unexpected_error',
      errorClass: errName,
      route: request.url,
      method: request.method,
    },
    'Internal server error'
  );

  reply.status(503).send({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
  });
}
