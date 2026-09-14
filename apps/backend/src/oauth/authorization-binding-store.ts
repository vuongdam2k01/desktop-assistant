import crypto from 'node:crypto';
import type { Redis } from 'ioredis';
import { BackendError } from '../http/errors.js';

export interface BindingData {
  providerId: string;
  sessionId: string;
  redirectUri: string;
  codeVerifier?: string | undefined;
  issuedAt: number;
  expiresAt: number;
  status: 'active' | 'consumed' | 'expired';
}

const CONSUME_BINDING_LUA = `
local key = KEYS[1]
local expectedProvider = ARGV[1]
local expectedSession = ARGV[2]
local expectedRedirect = ARGV[3]
local now = tonumber(ARGV[4])

local raw = redis.call('GET', key)
if not raw then
    return 'BINDING_UNKNOWN'
end

local data = cjson.decode(raw)

if data.providerId ~= expectedProvider or data.sessionId ~= expectedSession then
    return 'BINDING_UNKNOWN'
end

if data.status == 'consumed' then
    return 'BINDING_CONSUMED'
end

if tonumber(data.expiresAt) <= now then
    data.status = 'expired'
    redis.call('SET', key, cjson.encode(data), 'EX', 600)
    return 'BINDING_EXPIRED'
end

if data.redirectUri ~= expectedRedirect then
    data.status = 'consumed'
    redis.call('SET', key, cjson.encode(data), 'EX', 600)
    return 'REDIRECT_MISMATCH'
end

data.status = 'consumed'
redis.call('SET', key, cjson.encode(data), 'EX', 600)
return cjson.encode(data)
`;

export class AuthorizationBindingStore {
  readonly activeTtlSeconds = 600; // 10 minutes
  readonly tombstoneTtlSeconds = 600; // 10 minutes retained

  constructor(private readonly redis: Redis) {}

  private getBindingKey(rawBinding: string): string {
    const hash = crypto.createHash('sha256').update(rawBinding).digest('hex');
    return `oauth:binding:${hash}`;
  }

  async createBinding(params: {
    providerId: string;
    sessionId: string;
    redirectUri: string;
    codeVerifier?: string | undefined;
  }): Promise<{ binding: string; expiresInSeconds: number }> {
    const rawBinding = crypto.randomBytes(32).toString('base64url');
    const bindingKey = this.getBindingKey(rawBinding);

    const now = Date.now();
    const bindingData: BindingData = {
      providerId: params.providerId,
      sessionId: params.sessionId,
      redirectUri: params.redirectUri,
      codeVerifier: params.codeVerifier,
      issuedAt: now,
      expiresAt: now + this.activeTtlSeconds * 1000,
      status: 'active',
    };

    const totalTtl = this.activeTtlSeconds + this.tombstoneTtlSeconds;
    await this.redis.set(bindingKey, JSON.stringify(bindingData), 'EX', totalTtl);

    return {
      binding: rawBinding,
      expiresInSeconds: this.activeTtlSeconds,
    };
  }

  async consumeBinding(params: {
    binding: string;
    providerId: string;
    sessionId: string;
    redirectUri: string;
  }): Promise<{ codeVerifier?: string | undefined }> {
    if (!params.binding || typeof params.binding !== 'string') {
      throw new BackendError({
        statusCode: 400,
        code: 'BINDING_UNKNOWN',
        message: 'Invalid binding value',
      });
    }

    const bindingKey = this.getBindingKey(params.binding);
    const now = Date.now();

    const result = (await this.redis.eval(
      CONSUME_BINDING_LUA,
      1,
      bindingKey,
      params.providerId,
      params.sessionId,
      params.redirectUri,
      String(now)
    )) as string;

    if (result === 'BINDING_UNKNOWN') {
      throw new BackendError({
        statusCode: 400,
        code: 'BINDING_UNKNOWN',
        message: 'Binding is unknown or expired',
      });
    }

    if (result === 'BINDING_CONSUMED') {
      throw new BackendError({
        statusCode: 400,
        code: 'BINDING_CONSUMED',
        message: 'Binding has already been consumed',
      });
    }

    if (result === 'BINDING_EXPIRED') {
      throw new BackendError({
        statusCode: 400,
        code: 'BINDING_EXPIRED',
        message: 'Binding has expired',
      });
    }

    if (result === 'REDIRECT_MISMATCH') {
      throw new BackendError({
        statusCode: 400,
        code: 'REDIRECT_MISMATCH',
        message: 'Redirect URI does not match the URI the binding was issued for',
      });
    }

    try {
      const data = JSON.parse(result) as BindingData;
      return { codeVerifier: data.codeVerifier };
    } catch {
      throw new BackendError({
        statusCode: 400,
        code: 'BINDING_UNKNOWN',
        message: 'Malformed binding state',
      });
    }
  }
}
