import type { FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { BackendError } from '../http/errors.js';
import type { SessionTokenService } from './session-token-service.js';

export interface AuthenticatedSession {
  accountId: string;
  deviceId: string;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: AuthenticatedSession;
  }
}

export function createAuthenticateSession(
  pool: pg.Pool,
  sessionTokenService: SessionTokenService
) {
  return async function authenticateSession(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_MISSING',
        message: 'Authorization header is missing',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Invalid bearer authorization header format',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_MISSING',
        message: 'Bearer token is empty',
      });
    }

    const claims = await sessionTokenService.verifyToken(token, 'access');

    const client = await pool.connect();
    try {
      const res = await client.query<{
        session_id: string;
        session_revoked_at: Date | null;
        account_id: string;
        account_status: string;
        device_id: string;
        device_revoked_at: Date | null;
      }>(
        `SELECT s.id as session_id, s.revoked_at as session_revoked_at,
                a.id as account_id, a.status as account_status,
                d.device_id as device_id, d.revoked_at as device_revoked_at
         FROM session s
         JOIN account a ON s.account_id = a.id
         JOIN device d ON (s.account_id = d.account_id AND s.device_id = d.device_id)
         WHERE s.id = $1`,
        [claims.sessionId]
      );

      const row = res.rows[0];
      if (!row) {
        const accCheck = await client.query('SELECT id FROM account WHERE id = $1', [claims.accountId]);
        if (accCheck.rowCount === 0) {
          throw new BackendError({
            statusCode: 410,
            code: 'ACCOUNT_DELETED',
            message: 'Account has been deleted',
          });
        }
        throw new BackendError({
          statusCode: 401,
          code: 'SESSION_REVOKED',
          message: 'Session has been revoked or not found',
        });
      }

      if (row.account_status !== 'active') {
        throw new BackendError({
          statusCode: 401,
          code: 'SESSION_REVOKED',
          message: 'Account is not active',
        });
      }

      if (row.session_revoked_at) {
        throw new BackendError({
          statusCode: 401,
          code: 'SESSION_REVOKED',
          message: 'Session has been revoked',
        });
      }

      if (row.device_revoked_at) {
        throw new BackendError({
          statusCode: 401,
          code: 'DEVICE_REVOKED',
          message: 'Device has been revoked',
        });
      }

      // The invitation is matched through the account's address rather than through
      // `activated_account_id`. Revoking clears that column in the same statement that sets
      // the status, and the schema's `invitation_consumption` constraint requires it to be
      // null for any status other than redeemed, so a lookup by that column can never return
      // a revoked row and the rejection below could never fire.
      const invCheck = await client.query<{ status: string }>(
        `SELECT i.status
           FROM invitation i
           JOIN account a ON a.email = i.email
          WHERE a.id = $1`,
        [row.account_id]
      );
      if (invCheck.rows[0]?.status === 'revoked') {
        throw new BackendError({
          statusCode: 401,
          code: 'SESSION_REVOKED',
          message: 'Invitation has been revoked',
        });
      }

      await client.query(
        'UPDATE device SET last_active_at = CURRENT_TIMESTAMP WHERE account_id = $1 AND device_id = $2',
        [row.account_id, row.device_id]
      );

      request.session = {
        accountId: row.account_id,
        deviceId: row.device_id,
        sessionId: row.session_id,
      };
    } finally {
      client.release();
    }
  };
}
