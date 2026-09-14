export type CredentialStoreErrorCode =
  | 'SECURE_STORAGE_UNAVAILABLE'
  | 'CREDENTIAL_NOT_FOUND'
  | 'CREDENTIAL_UNREADABLE'
  | 'KEY_MALFORMED'
  | 'KEY_UNCLASSIFIED'
  | 'CLASS_PATTERN_CONFLICT'
  | 'METADATA_NOT_DECLARED'
  | 'WRITE_FAILED'
  | 'ERASURE_INCOMPLETE'
  | 'DESCRIPTOR_INVALID'
  | 'CLASS_TRIGGERS_INCOMPLETE'
  | 'CLASS_ROUTE_UNREACHABLE'
  | 'CLASS_ID_REUSED';

export interface CredentialStoreErrorOptions {
  code: CredentialStoreErrorCode;
  key?: string | undefined;
  classId?: string | undefined;
}

export class CredentialStoreError extends Error {
  readonly code: CredentialStoreErrorCode;
  readonly key?: string | undefined;
  readonly classId?: string | undefined;

  constructor(options: CredentialStoreErrorOptions) {
    let msg = `CredentialStoreError: ${options.code}`;
    if (options.key !== undefined) {
      msg += ` (key: ${options.key})`;
    }
    if (options.classId !== undefined) {
      msg += ` (classId: ${options.classId})`;
    }
    super(msg);
    this.name = 'CredentialStoreError';
    this.code = options.code;
    if (options.key !== undefined) {
      this.key = options.key;
    }
    if (options.classId !== undefined) {
      this.classId = options.classId;
    }
    // Inviolable: delete cause to prevent native error or secret leaks
    delete (this as { cause?: unknown }).cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.key !== undefined ? { key: this.key } : {}),
      ...(this.classId !== undefined ? { classId: this.classId } : {}),
    };
  }
}
