import type { FailureNotice } from '@desktop-assistant/contracts/provider-failure';

export type RoutingErrorCode =
  | 'ROLE_UNASSIGNED'
  | 'ROLE_CAPABILITY_UNMET'
  | 'MODEL_MEASURED_UNSUITABLE'
  | 'UNMEASURED_NEEDS_ACKNOWLEDGEMENT'
  | 'PROFILE_UNKNOWN'
  | 'PROFILE_CREDENTIAL_ABSENT'
  | 'MODEL_NOT_OFFERED'
  | 'TABLE_VERSION_AHEAD';

export interface RoutingErrorOptions {
  code: RoutingErrorCode;
  role?: string | undefined;
  profileId?: string | undefined;
  model?: string | undefined;
  detail?: string | undefined;
}

export class RoutingError extends Error {
  readonly code: RoutingErrorCode;
  readonly role?: string | undefined;
  readonly profileId?: string | undefined;
  readonly model?: string | undefined;
  readonly detail?: string | undefined;

  constructor(options: RoutingErrorOptions) {
    let msg = `RoutingError: ${options.code}`;
    if (options.role !== undefined) {
      msg += ` (role: ${options.role})`;
    }
    if (options.profileId !== undefined) {
      msg += ` (profileId: ${options.profileId})`;
    }
    if (options.model !== undefined) {
      msg += ` (model: ${options.model})`;
    }
    if (options.detail !== undefined) {
      msg += ` - ${options.detail}`;
    }
    super(msg);
    this.name = 'RoutingError';
    this.code = options.code;
    this.role = options.role;
    this.profileId = options.profileId;
    this.model = options.model;
    this.detail = options.detail;
    delete (this as { cause?: unknown }).cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.role !== undefined ? { role: this.role } : {}),
      ...(this.profileId !== undefined ? { profileId: this.profileId } : {}),
      ...(this.model !== undefined ? { model: this.model } : {}),
      ...(this.detail !== undefined ? { detail: this.detail } : {}),
    };
  }
}

export type ProfileStoreErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_INVALID'
  | 'DIALECT_UNSUPPORTED'
  | 'CREDENTIAL_KEY_INVALID'
  | 'PROFILE_VERSION_AHEAD'
  | 'PROFILE_IN_USE';

export interface ProfileStoreErrorOptions {
  code: ProfileStoreErrorCode;
  profileId?: string | undefined;
  detail?: string | undefined;
}

export class ProfileStoreError extends Error {
  readonly code: ProfileStoreErrorCode;
  readonly profileId?: string | undefined;
  readonly detail?: string | undefined;

  constructor(options: ProfileStoreErrorOptions) {
    let msg = `ProfileStoreError: ${options.code}`;
    if (options.profileId !== undefined) {
      msg += ` (profileId: ${options.profileId})`;
    }
    if (options.detail !== undefined) {
      msg += ` - ${options.detail}`;
    }
    super(msg);
    this.name = 'ProfileStoreError';
    this.code = options.code;
    this.profileId = options.profileId;
    this.detail = options.detail;
    delete (this as { cause?: unknown }).cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.profileId !== undefined ? { profileId: this.profileId } : {}),
      ...(this.detail !== undefined ? { detail: this.detail } : {}),
    };
  }
}

export type UsageAccountingErrorCode =
  | 'PRICE_MALFORMED'
  | 'CURRENCY_UNKNOWN'
  | 'MODEL_NOT_OFFERED'
  | 'RECORD_DUPLICATE'
  | 'TOTAL_MIXED_CURRENCY';

export interface UsageAccountingErrorOptions {
  code: UsageAccountingErrorCode;
  jobId?: string | undefined;
  requestId?: string | undefined;
  detail?: string | undefined;
}

export class UsageAccountingError extends Error {
  readonly code: UsageAccountingErrorCode;
  readonly jobId?: string | undefined;
  readonly requestId?: string | undefined;
  readonly detail?: string | undefined;

  constructor(options: UsageAccountingErrorOptions) {
    let msg = `UsageAccountingError: ${options.code}`;
    if (options.jobId !== undefined) {
      msg += ` (jobId: ${options.jobId})`;
    }
    if (options.requestId !== undefined) {
      msg += ` (requestId: ${options.requestId})`;
    }
    if (options.detail !== undefined) {
      msg += ` - ${options.detail}`;
    }
    super(msg);
    this.name = 'UsageAccountingError';
    this.code = options.code;
    this.jobId = options.jobId;
    this.requestId = options.requestId;
    this.detail = options.detail;
    delete (this as { cause?: unknown }).cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.jobId !== undefined ? { jobId: this.jobId } : {}),
      ...(this.requestId !== undefined ? { requestId: this.requestId } : {}),
      ...(this.detail !== undefined ? { detail: this.detail } : {}),
    };
  }
}

export class ProviderFailureError extends Error {
  readonly notice: FailureNotice;

  constructor(notice: FailureNotice) {
    super(`ProviderFailureError: ${notice.cause} on profile '${notice.profileId}' - remedy: ${notice.remedy.kind}`);
    this.name = 'ProviderFailureError';
    this.notice = notice;
    delete (this as { cause?: unknown }).cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      notice: this.notice,
    };
  }
}
