import { OAuth2Client } from 'google-auth-library';
import { BackendError } from '../http/errors.js';
import type { IdentityPayload, IdentityVerifier } from './identity-verifier.js';

export class GoogleIdentityVerifier implements IdentityVerifier {
  private readonly client: OAuth2Client;
  private readonly audience: string;

  constructor(audience: string, client?: OAuth2Client) {
    this.audience = audience;
    this.client = client ?? new OAuth2Client();
  }

  async verifyIdToken(idToken: string): Promise<IdentityPayload> {
    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      throw new BackendError({
        statusCode: 401,
        code: 'IDENTITY_INVALID',
        message: 'Identity token is missing or empty',
      });
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audience,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
        throw new BackendError({
          statusCode: 401,
          code: 'IDENTITY_INVALID',
          message: 'Identity token does not contain a verified email or subject',
        });
      }

      return {
        sub: payload.sub,
        email: payload.email.toLowerCase().trim(),
        emailVerified: true,
      };
    } catch (err) {
      if (err instanceof BackendError) {
        throw err;
      }
      throw new BackendError({
        statusCode: 401,
        code: 'IDENTITY_INVALID',
        message: 'Google identity verification failed',
      });
    }
  }
}
