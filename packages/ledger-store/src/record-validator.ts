import Ajv, { type ErrorObject } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { LEDGER_RECORD_SCHEMA } from '@desktop-assistant/contracts/ledger-record';
import {
  TOOL_RECONCILIATION_SCHEMA,
  type ReconciliationDeclaration,
} from '@desktop-assistant/contracts/tool-reconciliation';
import { LedgerStoreError } from './errors.js';
import type {
  TypedLedgerRecord,
  SnapshotOrUnavailable,
  Reversibility,
  CompensatingAction,
} from './types.js';

type AjvOptions = Record<string, unknown>;
interface CompiledValidator {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null | undefined;
}
interface AjvInstance {
  compile(schema: unknown): CompiledValidator;
}
type AjvConstructor = new (opts?: AjvOptions) => AjvInstance;
type FormatPlugin = (ajv: unknown) => void;

const AjvClass = ((Ajv as unknown as { default?: AjvConstructor }).default || Ajv) as unknown as AjvConstructor;
const Ajv2020Class = ((Ajv2020 as unknown as { default?: AjvConstructor }).default ||
  Ajv2020) as unknown as AjvConstructor;
const addFormatsFn = (
  (addFormats as unknown as { default?: FormatPlugin }).default || addFormats
) as unknown as FormatPlugin;

// Setup Ajv 2020 for LedgerRecord
const ajv2020 = new Ajv2020Class({
  allErrors: true,
  strict: false,
});
addFormatsFn(ajv2020);
const validateRecordSchema = ajv2020.compile(LEDGER_RECORD_SCHEMA);

// Setup Ajv Draft-07 for ToolReconciliation
const ajvDraft7 = new AjvClass({
  allErrors: true,
  strict: false,
});
const validateReconciliationSchema = ajvDraft7.compile(TOOL_RECONCILIATION_SCHEMA);
/**
 * Validates that an object conforms to the normative LedgerRecord schema.
 * Throws RECORD_REJECTED with structured error paths if invalid.
 */
export function validateLedgerRecord(record: unknown): asserts record is TypedLedgerRecord {
  const valid = validateRecordSchema(record);
  if (!valid) {
    const errorDetails = (validateRecordSchema.errors || []).map((err: ErrorObject) => ({
      instancePath: err.instancePath,
      schemaPath: err.schemaPath,
      keyword: err.keyword,
      message: err.message,
      params: err.params,
    }));

    const pathSummaries = errorDetails
      .map((e) => `${e.instancePath || '/'}: ${e.message || 'invalid'}`)
      .join('; ');

    throw new LedgerStoreError(
      'RECORD_REJECTED',
      `Record validation failed: ${pathSummaries}`,
      { details: errorDetails }
    );
  }
}

/**
 * Validates and normalizes a tool reconciliation declaration.
 * If missing, null, or invalid, returns { method: 'none', reason: 'missing_or_invalid_declaration' }.
 * If valid, returns a deep-cloned copy to prevent retaining references to live manifest objects.
 */
export function normalizeReconciliationDeclaration(declaration: unknown): ReconciliationDeclaration {
  if (!declaration || typeof declaration !== 'object') {
    return {
      method: 'none',
      reason: 'missing_or_invalid_declaration',
    };
  }

  const valid = validateReconciliationSchema(declaration);
  if (!valid) {
    return {
      method: 'none',
      reason: 'missing_or_invalid_declaration',
    };
  }

  return JSON.parse(JSON.stringify(declaration)) as ReconciliationDeclaration;
}

/**
 * Validates snapshot declaration on intent inputs.
 * Snapshot must be explicitly captured (true) or unavailable (false with reason).
 */
export function validateSnapshot(snapshot: unknown): asserts snapshot is SnapshotOrUnavailable {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new LedgerStoreError(
      'SNAPSHOT_UNDECLARED',
      'Intent record must declare a before snapshot ({ captured: true, target, state } or { captured: false, reason }).'
    );
  }

  const s = snapshot as Record<string, unknown>;
  if (s['captured'] === true) {
    if (typeof s['target'] !== 'string' || s['target'].trim().length === 0 || !('state' in s)) {
      throw new LedgerStoreError(
        'SNAPSHOT_UNDECLARED',
        'Captured snapshot must include non-empty target and state.'
      );
    }
  } else if (s['captured'] === false) {
    if (typeof s['reason'] !== 'string' || s['reason'].trim().length === 0) {
      throw new LedgerStoreError(
        'SNAPSHOT_UNDECLARED',
        'Unavailable snapshot must include a non-empty reason.'
      );
    }
  } else {
    throw new LedgerStoreError(
      'SNAPSHOT_UNDECLARED',
      'Snapshot captured property must be a boolean.'
    );
  }
}

/**
 * Validates reversibility declaration on intent inputs.
 */
export function validateReversibility(reversibility: unknown): asserts reversibility is Reversibility {
  if (!reversibility || typeof reversibility !== 'object') {
    throw new LedgerStoreError(
      'REVERSIBILITY_UNDECLARED',
      'Intent record must declare reversibility ({ kind: "reversible", snapshotMethod } or { kind: "irreversible", reason }).'
    );
  }

  const r = reversibility as Record<string, unknown>;
  if (r['kind'] === 'reversible') {
    if (typeof r['snapshotMethod'] !== 'string' || r['snapshotMethod'].trim().length === 0) {
      throw new LedgerStoreError(
        'REVERSIBILITY_UNDECLARED',
        'Reversible intent must declare a non-empty snapshotMethod.'
      );
    }
  } else if (r['kind'] === 'irreversible') {
    if (typeof r['reason'] !== 'string' || r['reason'].trim().length === 0) {
      throw new LedgerStoreError(
        'REVERSIBILITY_UNDECLARED',
        'Irreversible intent must declare a non-empty reason.'
      );
    }
  } else {
    throw new LedgerStoreError(
      'REVERSIBILITY_UNDECLARED',
      'Reversibility kind must be either "reversible" or "irreversible".'
    );
  }
}

/**
 * Validates compensating action when an intent was reversible and the result succeeded.
 */
export function validateCompensatingAction(
  action: unknown,
  intentReversibility: Reversibility,
  outcome: string
): asserts action is CompensatingAction | undefined {
  if (intentReversibility.kind === 'reversible' && outcome === 'succeeded') {
    if (!action || typeof action !== 'object') {
      throw new LedgerStoreError(
        'COMPENSATION_MISSING',
        'A successful result for a reversible intent must declare a compensatingAction ({ connector, tool, parameters }).'
      );
    }

    const a = action as Record<string, unknown>;
    if (
      typeof a['connector'] !== 'string' ||
      a['connector'].trim().length === 0 ||
      typeof a['tool'] !== 'string' ||
      a['tool'].trim().length === 0 ||
      !('parameters' in a)
    ) {
      throw new LedgerStoreError(
        'COMPENSATION_MISSING',
        'CompensatingAction must include non-empty connector, tool, and parameters.'
      );
    }
  }
}
