export const LEDGER_STORE_ERROR_CODES = [
  // Contract error codes (ledger-store.md)
  'LEDGER_WRITE_FAILED',
  'RECORD_REJECTED',
  'STORE_UNAVAILABLE',
  'STORE_DAMAGED',
  'SHAPE_AHEAD',
  'SHAPE_STEP_FAILED',
  'SHAPE_WOULD_REWRITE',
  'JOB_UNKNOWN',
  'QUERY_UNBOUNDED',
  'REMOVAL_SCOPE_INVALID',
  'RECORD_IMMUTABLE',
  // Concrete local codes
  'CORRELATION_MISSING',
  'CORRELATION_REUSED',
  'CORRELATION_UNMATCHED',
  'SNAPSHOT_UNDECLARED',
  'REVERSIBILITY_UNDECLARED',
  'COMPENSATION_MISSING',
  'DEVICE_ID_MISMATCH',
  'SEQUENCE_EXHAUSTED',
  'APPROVAL_REQUEST_UNKNOWN',
  'ATTACHMENT_PATH_INVALID',
  'REMOVAL_INCOMPLETE',
] as const;

export type LedgerStoreErrorCode = (typeof LEDGER_STORE_ERROR_CODES)[number];

export interface LedgerStoreErrorOptions {
  cause?: unknown;
  details?: unknown;
}

export class LedgerStoreError extends Error {
  readonly code: LedgerStoreErrorCode;
  readonly details?: unknown;

  constructor(code: LedgerStoreErrorCode, message: string, options?: LedgerStoreErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'LedgerStoreError';
    this.code = code;
    this.details = options?.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
