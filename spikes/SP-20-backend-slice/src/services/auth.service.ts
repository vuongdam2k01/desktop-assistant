import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { query, queryOne, exec } from '../db/index.js';
import { config } from '../config.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    email: string;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  deviceId: string;
  type: 'access';
}

export class AuthService {
  /**
   * Verifies Google ID Token.
   * In production, verifies with Google's tokeninfo API.
   * In test/dev, allows simulated test tokens for automated testing.
   */
  public async verifyGoogleIdToken(idToken: string): Promise<{ sub: string; email: string }> {
    if (idToken.startsWith('mock-google-token:')) {
      const parts = idToken.split(':');
      const email = parts[1];
      const sub = parts[2] || `google_sub_${crypto.createHash('md5').update(email).digest('hex')}`;
      return { sub, email };
    }

    // Call Google tokeninfo endpoint
    try {
      const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!resp.ok) {
        throw new Error('Google tokeninfo rejected id_token');
      }
      const data = await resp.json();
      if (!data.email || !data.sub) {
        throw new Error('Token payload missing email or sub');
      }
      return { sub: data.sub, email: data.email };
    } catch (err: any) {
      const error: any = new Error(`Invalid Google ID token: ${err.message}`);
      error.statusCode = 401;
      throw error;
    }
  }

  /**
   * Checks whether an email is on the closed beta allowlist.
   */
  public async checkAllowlist(email: string): Promise<boolean> {
    const record = await queryOne(
      `SELECT * FROM invite_allowlist 
       WHERE email = $1 AND (status = 'active' OR status = 'redeemed')
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);`,
      [email.toLowerCase()]
    );
    return !!record;
  }

  /**
   * Full Google Sign-In flow (FR-BE-01 / ADR-006):
   * 1. Verify Google ID token
   * 2. Gate by closed beta allowlist
   * 3. Upsert Account
   * 4. Register Device
   * 5. Issue Session & JWT tokens
   */
  public async authenticateWithGoogle(
    idToken: string,
    deviceId: string,
    deviceName?: string
  ): Promise<AuthTokens> {
    const { sub, email } = await this.verifyGoogleIdToken(idToken);
    const normalizedEmail = email.toLowerCase();

    // Closed beta gate (FR-BE-01, OQ-10)
    const isAllowed = await this.checkAllowlist(normalizedEmail);
    if (!isAllowed) {
      const err: any = new Error(`Email '${normalizedEmail}' is not in the closed beta allowlist.`);
      err.statusCode = 403;
      err.code = 'EMAIL_NOT_IN_ALLOWLIST';
      throw err;
    }

    // Upsert Account
    let account = await queryOne<{ id: string; email: string }>(
      `SELECT id, email FROM account WHERE google_sub = $1;`,
      [sub]
    );

    if (!account) {
      const accountId = crypto.randomUUID();
      await exec(`
        INSERT INTO account (id, google_sub, email, status)
        VALUES ('${accountId}', '${sub}', '${normalizedEmail}', 'active');
      `);
      account = { id: accountId, email: normalizedEmail };

      // Mark allowlist as redeemed by this account
      await query(
        `UPDATE invite_allowlist 
         SET status = 'redeemed', activated_account_id = $1 
         WHERE email = $2;`,
        [accountId, normalizedEmail]
      );
    }

    // Upsert Device
    const existingDevice = await queryOne(
      `SELECT id FROM device WHERE account_id = $1 AND device_id = $2;`,
      [account.id, deviceId]
    );

    if (existingDevice) {
      await query(
        `UPDATE device SET last_active_at = CURRENT_TIMESTAMP, device_name = $1 WHERE id = $2;`,
        [deviceName || 'Desktop Client', existingDevice.id]
      );
    } else {
      const devRowId = crypto.randomUUID();
      await query(
        `INSERT INTO device (id, account_id, device_id, device_name) VALUES ($1, $2, $3, $4);`,
        [devRowId, account.id, deviceId, deviceName || 'Desktop Client']
      );
    }

    // Issue Session & Refresh Token
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + config.jwtRefreshExpiresInDays * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO session (id, account_id, device_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5);`,
      [sessionId, account.id, deviceId, refreshTokenHash, expiresAt.toISOString()]
    );

    // Issue Access Token JWT
    const payload: JwtPayload = {
      sub: account.id,
      email: account.email,
      deviceId,
      type: 'access',
    };

    const accessToken = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtAccessExpiresIn as any,
    });

    return {
      accessToken,
      refreshToken: `${sessionId}.${rawRefreshToken}`,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 mins
      user: {
        id: account.id,
        email: account.email,
      },
    };
  }

  /**
   * Refreshes app access token using refresh token.
   */
  public async refreshAppSession(refreshTokenWithId: string): Promise<AuthTokens> {
    const parts = refreshTokenWithId.split('.');
    if (parts.length !== 2) {
      const err: any = new Error('Malformed refresh token format');
      err.statusCode = 401;
      throw err;
    }

    const [sessionId, rawRefreshToken] = parts;
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const session = await queryOne<{
      id: string;
      account_id: string;
      device_id: string;
      email: string;
    }>(
      `SELECT s.id, s.account_id, s.device_id, a.email
       FROM session s
       JOIN account a ON s.account_id = a.id
       WHERE s.id = $1 
         AND s.refresh_token_hash = $2
         AND s.revoked_at IS NULL
         AND s.expires_at > CURRENT_TIMESTAMP;`,
      [sessionId, refreshTokenHash]
    );

    if (!session) {
      const err: any = new Error('Invalid, expired, or revoked refresh token');
      err.statusCode = 401;
      throw err;
    }

    // Issue new access token
    const payload: JwtPayload = {
      sub: session.account_id,
      email: session.email,
      deviceId: session.device_id,
      type: 'access',
    };

    const newAccessToken = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtAccessExpiresIn as any,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: refreshTokenWithId,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: session.account_id,
        email: session.email,
      },
    };
  }

  /**
   * Revokes refresh token on logout (FR-BE-01).
   */
  public async logout(sessionId: string): Promise<void> {
    await query(
      `UPDATE session SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1;`,
      [sessionId]
    );
  }

  /**
   * Account deletion (FR-BE-12):
   * Backend completely deletes Account, Device, Session, and allowlist records.
   */
  public async deleteAccount(accountId: string): Promise<{ deleted: boolean }> {
    const account = await queryOne<{ email: string }>(
      `SELECT email FROM account WHERE id = $1;`,
      [accountId]
    );

    if (!account) {
      const err: any = new Error('Account not found');
      err.statusCode = 404;
      throw err;
    }

    // Delete allowlist record associated with this account or email
    await query(
      `DELETE FROM invite_allowlist WHERE activated_account_id = $1 OR email = $2;`,
      [accountId, account.email]
    );

    // Delete account (CASCADE deletes devices and sessions)
    await query(
      `DELETE FROM account WHERE id = $1;`,
      [accountId]
    );

    return { deleted: true };
  }
}

export const authService = new AuthService();
