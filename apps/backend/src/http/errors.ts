export type ErrorCode =
  // Session / Auth
  | 'IDENTITY_INVALID'
  | 'EMAIL_NOT_IN_ALLOWLIST'
  | 'TOKEN_MISSING'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'SESSION_REVOKED'
  | 'DEVICE_REVOKED'
  | 'ACCOUNT_DELETED'
  // Broker
  | 'PROVIDER_UNSUPPORTED'
  | 'BINDING_UNKNOWN'
  | 'BINDING_CONSUMED'
  | 'BINDING_EXPIRED'
  | 'REDIRECT_MISMATCH'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNREACHABLE'
  // Shared / Transport
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'HTTPS_REQUIRED'
  | 'VALIDATION_ERROR';

export interface BackendErrorOptions {
  statusCode: number;
  code: ErrorCode;
  message?: string | undefined;
  providerId?: string | undefined;
  providerReason?: string | undefined;
  retryAfterSeconds?: number | undefined;
}

export class BackendError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly providerId?: string | undefined;
  readonly providerReason?: string | undefined;
  readonly retryAfterSeconds?: number | undefined;

  constructor(options: BackendErrorOptions) {
    super(options.message ?? options.code);
    this.name = 'BackendError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.providerId = options.providerId;
    this.providerReason = options.providerReason;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
