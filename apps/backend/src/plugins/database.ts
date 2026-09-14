import fp from 'fastify-plugin';
import pg from 'pg';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../config.js';

export interface DatabasePluginOptions {
  database: AppConfig['database'];
}

declare module 'fastify' {
  interface FastifyInstance {
    pgPool: pg.Pool;
    probeStore: () => Promise<boolean>;
  }
}

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (fastify, options) => {
  const pool = new pg.Pool({
    connectionString: options.database.url,
    min: options.database.poolMin,
    max: options.database.poolMax,
    connectionTimeoutMillis: options.database.connectTimeoutMs,
    idleTimeoutMillis: options.database.idleTimeoutMs,
    statement_timeout: options.database.statementTimeoutMs,
  });

  pool.on('error', err => {
    fastify.log.warn({ err: err.message }, 'Unexpected error on idle PostgreSQL client');
  });

  fastify.decorate('pgPool', pool);
  fastify.decorate('probeStore', async (): Promise<boolean> => {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  });

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
};

export const databasePlugin = fp(plugin, {
  name: 'database-plugin',
});
