import crypto from 'node:crypto';
import type pg from 'pg';
import { BackendError } from '../http/errors.js';
import type { IdentityVerifier } from './identity-verifier.js';
import { SessionTokenService, hashRefreshToken } from './session-token-service.js';

export interface SessionTokensResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  account: {
    id: string;
    email: string;
  };
}

export interface SignOutResult {
  sessionRevoked: true;
  otherSessionsRetained: number;
}

export class SessionService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly identityVerifier: IdentityVerifier,
    private readonly sessionTokenService: SessionTokenService
  ) {}

  async signInGoogle(params: {
    idToken: string;
    deviceId: string;
    deviceName?: string;
  }): Promise<SessionTokensResult> {
    if (!params.deviceId || typeof params.deviceId !== 'string' || params.deviceId.trim().length === 0) {
      throw new BackendError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'deviceId is required',
      });
    }

    // Step 1: Verify identity before database interaction
    const identity = await this.identityVerifier.verifyIdToken(params.idToken);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if account already exists by identity_subject
      const accRes = await client.query<{
        id: string;
        identity_subject: string;
        email: string;
        status: string;
      }>('SELECT id, identity_subject, email, status FROM account WHERE identity_subject = $1 FOR UPDATE', [
        identity.sub,
      ]);

      let accountId: string;
      const existingAccount = accRes.rows[0];

      if (existingAccount) {
        accountId = existingAccount.id;
        if (existingAccount.status !== 'active') {
          throw new BackendError({
            statusCode: 401,
            code: 'IDENTITY_INVALID',
            message: 'Account is not active',
          });
        }

        // Verify that the account still has a valid admission invitation
        const invRes = await client.query<{
          id: string;
          email: string | null;
          status: string;
          expires_at: Date | null;
          activated_account_id: string | null;
        }>(
          `SELECT id, email, status, expires_at, activated_account_id 
           FROM invitation 
           WHERE activated_account_id = $1 OR email = $2 
           FOR UPDATE`,
          [accountId, identity.email]
        );

        const invitation = invRes.rows[0];
        const isExpired = invitation?.expires_at ? new Date(invitation.expires_at) < new Date() : false;

        if (!invitation || invitation.status === 'revoked' || (invitation.status === 'active' && isExpired)) {
          throw new BackendError({
            statusCode: 403,
            code: 'EMAIL_NOT_IN_ALLOWLIST',
            message: 'No active invitation for this account or email',
          });
        }

        if (invitation.status === 'active') {
          await client.query(
            `UPDATE invitation 
             SET status = 'redeemed', activated_account_id = $1 
             WHERE id = $2`,
            [accountId, invitation.id]
          );
        }

        // Update email if it changed on Google side
        if (existingAccount.email !== identity.email) {
          await client.query(
            'UPDATE account SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [identity.email, accountId]
          );
        }
      } else {
        // Step 2: New account - must have an active, unexpired invitation for this email
        const invRes = await client.query<{
          id: string;
          email: string | null;
          status: string;
          expires_at: Date | null;
        }>(
          `SELECT id, email, status, expires_at 
           FROM invitation 
           WHERE email = $1 AND status = 'active' 
           FOR UPDATE`,
          [identity.email]
        );

        const invitation = invRes.rows[0];
        const isExpired = invitation?.expires_at ? new Date(invitation.expires_at) < new Date() : false;

        if (!invitation || isExpired) {
          throw new BackendError({
            statusCode: 403,
            code: 'EMAIL_NOT_IN_ALLOWLIST',
            message: 'Email is not admitted in closed beta allowlist',
          });
        }

        accountId = crypto.randomUUID();
        await client.query(
          `INSERT INTO account (id, identity_subject, email, status) 
           VALUES ($1, $2, $3, 'active')`,
          [accountId, identity.sub, identity.email]
        );

        await client.query(
          `UPDATE invitation 
           SET status = 'redeemed', activated_account_id = $1 
           WHERE id = $2`,
          [accountId, invitation.id]
        );
      }

      // Upsert device: unique on (account_id, device_id)
      const deviceIdField = params.deviceId.trim();
      const deviceName = params.deviceName?.trim() || null;
      const deviceUuid = crypto.randomUUID();

      await client.query(
        `INSERT INTO device (id, account_id, device_id, device_name, last_active_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (account_id, device_id) 
         DO UPDATE SET device_name = EXCLUDED.device_name, 
                       last_active_at = CURRENT_TIMESTAMP, 
                       revoked_at = NULL`,
        [deviceUuid, accountId, deviceIdField, deviceName]
      );

      // Issue session
      const sessionId = crypto.randomUUID();
      const tokens = await this.sessionTokenService.issueTokens({
        accountId,
        deviceId: deviceIdField,
        sessionId,
      });

      const refreshHash = hashRefreshToken(tokens.refreshToken);
      await client.query(
        `INSERT INTO session (id, account_id, device_id, refresh_token_hash, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + ($5 || ' seconds')::interval)`,
        [sessionId, accountId, deviceIdField, refreshHash, this.sessionTokenService.refreshTokenTtlSeconds]
      );

      await client.query('COMMIT');

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: tokens.expiresInSeconds,
        account: {
          id: accountId,
          email: identity.email,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async refreshSession(refreshToken: string): Promise<SessionTokensResult> {
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Refresh token is required',
      });
    }

    let claims;
    try {
      claims = await this.sessionTokenService.verifyToken(refreshToken, 'refresh');
    } catch (err) {
      if (err instanceof BackendError && err.code === 'TOKEN_EXPIRED') {
        throw err;
      }
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Invalid refresh token',
      });
    }

    const refreshHash = hashRefreshToken(refreshToken);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const sessRes = await client.query<{
        id: string;
        account_id: string;
        device_id: string;
        expires_at: Date;
        revoked_at: Date | null;
        acc_id: string | null;
        acc_email: string | null;
        acc_status: string | null;
        dev_revoked_at: Date | null;
      }>(
        `SELECT s.id, s.account_id, s.device_id, s.expires_at, s.revoked_at,
                a.id as acc_id, a.email as acc_email, a.status as acc_status,
                d.revoked_at as dev_revoked_at
         FROM session s
         LEFT JOIN account a ON s.account_id = a.id
         LEFT JOIN device d ON (s.account_id = d.account_id AND s.device_id = d.device_id)
         WHERE s.refresh_token_hash = $1
         FOR UPDATE OF s`,
        [refreshHash]
      );

      const session = sessRes.rows[0];

      if (!session) {
        // Unknown or rotated token. Check if account was deleted
        const accCheck = await client.query('SELECT id FROM account WHERE id = $1', [claims.accountId]);
        if (accCheck.rowCount === 0) {
          throw new BackendError({
            statusCode: 410,
            code: 'ACCOUNT_DELETED',
            message: 'Account has been deleted',
          });
        }
        // Generic token invalid oracle-resistant response
        throw new BackendError({
          statusCode: 401,
          code: 'TOKEN_INVALID',
          message: 'Refresh token is invalid or has been rotated',
        });
      }

      if (!session.acc_id) {
        throw new BackendError({
          statusCode: 410,
          code: 'ACCOUNT_DELETED',
          message: 'Account has been deleted',
        });
      }

      if (session.revoked_at) {
        throw new BackendError({
          statusCode: 401,
          code: 'SESSION_REVOKED',
          message: 'Session has been revoked',
        });
      }

      if (session.dev_revoked_at) {
        throw new BackendError({
          statusCode: 401,
          code: 'DEVICE_REVOKED',
          message: 'Device has been revoked',
        });
      }

      if (new Date(session.expires_at) < new Date()) {
        throw new BackendError({
          statusCode: 401,
          code: 'TOKEN_EXPIRED',
          message: 'Refresh token has expired',
        });
      }

      if (session.acc_status !== 'active') {
        throw new BackendError({
          statusCode: 401,
          code: 'SESSION_REVOKED',
          message: 'Account is suspended',
        });
      }

      // Check invitation revocation
      const invCheck = await client.query<{ status: string }>(
        'SELECT status FROM invitation WHERE activated_account_id = $1',
        [session.account_id]
      );
      if (invCheck.rows[0]?.status === 'revoked') {
        throw new BackendError({
          statusCode: 401,
          code: 'SESSION_REVOKED',
          message: 'Invitation has been revoked',
        });
      }

      // Atomic rotation
      const newTokens = await this.sessionTokenService.issueTokens({
        accountId: session.account_id,
        deviceId: session.device_id,
        sessionId: session.id,
      });

      const newHash = hashRefreshToken(newTokens.refreshToken);
      await client.query(
        `UPDATE session 
         SET refresh_token_hash = $1, 
             expires_at = NOW() + ($2 || ' seconds')::interval 
         WHERE id = $3`,
        [newHash, this.sessionTokenService.refreshTokenTtlSeconds, session.id]
      );

      await client.query(
        `UPDATE device 
         SET last_active_at = CURRENT_TIMESTAMP 
         WHERE account_id = $1 AND device_id = $2`,
        [session.account_id, session.device_id]
      );

      await client.query('COMMIT');

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        tokenType: 'Bearer',
        expiresInSeconds: newTokens.expiresInSeconds,
        account: {
          id: session.account_id,
          email: session.acc_email!,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async logoutSession(params: {
    authenticatedAccountId: string;
    authenticatedDeviceId: string;
    authenticatedSessionId: string;
    refreshToken: string;
  }): Promise<SignOutResult> {
    if (!params.refreshToken || typeof params.refreshToken !== 'string') {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Refresh token is required for sign out',
      });
    }

    let refreshClaims;
    try {
      refreshClaims = await this.sessionTokenService.verifyToken(params.refreshToken, 'refresh');
    } catch {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Invalid refresh token for sign out',
      });
    }

    if (
      refreshClaims.accountId !== params.authenticatedAccountId ||
      refreshClaims.deviceId !== params.authenticatedDeviceId ||
      refreshClaims.sessionId !== params.authenticatedSessionId
    ) {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Refresh token does not match authenticated session',
      });
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE session 
         SET revoked_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND account_id = $2 AND device_id = $3`,
        [params.authenticatedSessionId, params.authenticatedAccountId, params.authenticatedDeviceId]
      );

      const countRes = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text as count 
         FROM session 
         WHERE account_id = $1 
           AND id != $2 
           AND revoked_at IS NULL 
           AND expires_at > CURRENT_TIMESTAMP`,
        [params.authenticatedAccountId, params.authenticatedSessionId]
      );

      await client.query('COMMIT');

      const otherCount = parseInt(countRes.rows[0]?.count || '0', 10);

      return {
        sessionRevoked: true,
        otherSessionsRetained: isNaN(otherCount) ? 0 : otherCount,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
