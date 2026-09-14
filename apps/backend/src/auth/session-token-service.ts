import crypto from 'node:crypto';
import { SignJWT, jwtVerify, decodeProtectedHeader, errors as joseErrors } from 'jose';
import { BackendError } from '../http/errors.js';
import type { SecretResolver } from '../secrets/environment-secret-resolver.js';

export interface KeyRingConfig {
  currentKid: string;
  keys: Record<string, string>;
}

export interface SessionTokenServiceOptions {
  secretResolver: SecretResolver;
  keyRingSecretRef: string;
  issuer: string;
  audience: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
}

export interface VerifiedTokenClaims {
  accountId: string;
  deviceId: string;
  sessionId: string;
}

export function hashRefreshToken(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

export class SessionTokenService {
  private readonly secretResolver: SecretResolver;
  private readonly keyRingSecretRef: string;
  private readonly issuer: string;
  private readonly audience: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;

  constructor(options: SessionTokenServiceOptions) {
    this.secretResolver = options.secretResolver;
    this.keyRingSecretRef = options.keyRingSecretRef;
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.accessTokenTtlSeconds = options.accessTokenTtlSeconds ?? 900;
    this.refreshTokenTtlSeconds = options.refreshTokenTtlSeconds ?? 2592000;
  }

  private async loadKeyRing(): Promise<{ currentKid: string; keys: Record<string, Uint8Array> }> {
    const rawSecret = await this.secretResolver.resolveSecret(this.keyRingSecretRef);
    if (!rawSecret || rawSecret.trim().length === 0) {
      throw new Error(`Signing key ring reference "${this.keyRingSecretRef}" could not be resolved`);
    }

    let parsedConfig: KeyRingConfig;
    if (rawSecret.trim().startsWith('{')) {
      try {
        parsedConfig = JSON.parse(rawSecret) as KeyRingConfig;
      } catch (err) {
        throw new Error(`Invalid JSON in key ring reference "${this.keyRingSecretRef}": ${String(err)}`, { cause: err });
      }
    } else {
      parsedConfig = {
        currentKid: 'default',
        keys: { default: rawSecret.trim() },
      };
    }

    if (!parsedConfig.currentKid || !parsedConfig.keys || typeof parsedConfig.keys !== 'object') {
      throw new Error(`Key ring "${this.keyRingSecretRef}" missing currentKid or keys object`);
    }

    if (!parsedConfig.keys[parsedConfig.currentKid]) {
      throw new Error(
        `Key ring currentKid "${parsedConfig.currentKid}" not found in keys: [${Object.keys(parsedConfig.keys).join(', ')}]`
      );
    }

    const encoder = new TextEncoder();
    const encodedKeys: Record<string, Uint8Array> = {};

    for (const [kid, keyStr] of Object.entries(parsedConfig.keys)) {
      if (!keyStr || typeof keyStr !== 'string') {
        throw new Error(`Key ring key "${kid}" is not a non-empty string`);
      }
      const keyBytes = encoder.encode(keyStr);
      if (keyBytes.length < 32) {
        throw new Error(`Key ring key "${kid}" must be at least 256 bits (32 bytes), but got ${keyBytes.length} bytes`);
      }
      encodedKeys[kid] = keyBytes;
    }

    return {
      currentKid: parsedConfig.currentKid,
      keys: encodedKeys,
    };
  }

  async issueTokens(params: {
    accountId: string;
    deviceId: string;
    sessionId: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  }> {
    const { currentKid, keys } = await this.loadKeyRing();
    const signingKey = keys[currentKid];
    if (!signingKey) {
      throw new Error(`Signing key for kid "${currentKid}" not found in loaded keys`);
    }

    const accessToken = await new SignJWT({
      tokenUse: 'access',
      deviceId: params.deviceId,
      sessionId: params.sessionId,
    })
      .setProtectedHeader({ alg: 'HS256', kid: currentKid })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setSubject(params.accountId)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTokenTtlSeconds}s`)
      .sign(signingKey);

    const refreshToken = await new SignJWT({
      tokenUse: 'refresh',
      deviceId: params.deviceId,
      sessionId: params.sessionId,
      nonce: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: 'HS256', kid: currentKid })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setSubject(params.accountId)
      .setIssuedAt()
      .setExpirationTime(`${this.refreshTokenTtlSeconds}s`)
      .sign(signingKey);

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.accessTokenTtlSeconds,
    };
  }

  async verifyToken(token: string, expectedUse: 'access' | 'refresh'): Promise<VerifiedTokenClaims> {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_MISSING',
        message: 'Token is missing',
      });
    }

    let protectedHeader;
    try {
      protectedHeader = decodeProtectedHeader(token);
    } catch {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Malformed token header',
      });
    }

    const kid = protectedHeader.kid;
    const { keys } = await this.loadKeyRing();

    // Look up key by kid or fallback to default if only one key exists
    let key = kid ? keys[kid] : undefined;
    if (!key && Object.keys(keys).length === 1 && keys['default']) {
      key = keys['default'];
    }

    if (!key) {
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Unknown token key ID',
      });
    }

    try {
      const { payload } = await jwtVerify(token, key, {
        issuer: this.issuer,
        audience: this.audience,
      });

      if (payload.tokenUse !== expectedUse) {
        throw new BackendError({
          statusCode: 401,
          code: 'TOKEN_INVALID',
          message: `Expected ${expectedUse} token but got ${String(payload.tokenUse)}`,
        });
      }

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new BackendError({
          statusCode: 401,
          code: 'TOKEN_INVALID',
          message: 'Token subject is missing',
        });
      }

      return {
        accountId: payload.sub,
        deviceId: String(payload.deviceId || ''),
        sessionId: String(payload.sessionId || ''),
      };
    } catch (err) {
      if (err instanceof BackendError) {
        throw err;
      }
      if (err instanceof joseErrors.JWTExpired) {
        throw new BackendError({
          statusCode: 401,
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        });
      }
      throw new BackendError({
        statusCode: 401,
        code: 'TOKEN_INVALID',
        message: 'Token validation failed',
      });
    }
  }
}
