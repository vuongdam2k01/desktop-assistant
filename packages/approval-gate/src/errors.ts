import type { EvaluationErrorCode } from './types.js';

export class ApprovalGateError extends Error {
  readonly code: EvaluationErrorCode;
  readonly detail: string;

  constructor(code: EvaluationErrorCode, detail: string, options?: ErrorOptions) {
    super(`[${code}] ${detail}`, options);
    this.name = 'ApprovalGateError';
    this.code = code;
    this.detail = detail;
  }
}
