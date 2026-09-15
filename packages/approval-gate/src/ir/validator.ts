import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  RULE_REPRESENTATION_SCHEMA,
  type Rule,
  type Condition,
  type ToolLeaf,
  type ScopeLeaf,
} from '@desktop-assistant/contracts/rule-representation';
import { ApprovalGateError } from '../errors.js';

type AjvOptions = Record<string, unknown>;
interface CompiledValidator {
  (data: unknown): boolean;
  errors?: Array<{ instancePath?: string; message?: string }> | null | undefined;
}
interface AjvInstance {
  compile(schema: unknown): CompiledValidator;
}
type AjvConstructor = new (opts?: AjvOptions) => AjvInstance;
type FormatPlugin = (ajv: unknown) => void;

const Ajv2020Class = (
  (Ajv2020 as unknown as { default?: AjvConstructor }).default || Ajv2020
) as unknown as AjvConstructor;
const addFormatsFn = (
  (addFormats as unknown as { default?: FormatPlugin }).default || addFormats
) as unknown as FormatPlugin;

const ajv = new Ajv2020Class({
  allErrors: true,
  strict: false,
});
addFormatsFn(ajv);

const validateRuleSchema = ajv.compile(RULE_REPRESENTATION_SCHEMA);

export const SUPPORTED_REPRESENTATION_VERSION = '1.0.0';

export interface ManifestRegistry {
  readonly knownConnectors?: readonly string[] | undefined;
  readonly knownTools?: readonly string[] | undefined;
  readonly knownObjectTypes?: readonly string[] | undefined;
}

/**
 * Validates condition tree recursively for domain constraints and reference validity.
 */
function validateConditionTree(
  condition: Condition,
  path = 'condition',
  registry?: ManifestRegistry
): void {
  if (!condition || typeof condition !== 'object') {
    throw new ApprovalGateError(
      'RULE_SCHEMA_INVALID',
      `Malformed condition at ${path}: must be an object.`
    );
  }

  const kind = (condition as { kind?: string }).kind;
  if (!kind) {
    throw new ApprovalGateError(
      'RULE_SCHEMA_INVALID',
      `Malformed condition at ${path}: missing 'kind'.`
    );
  }

  switch (kind) {
    case 'all':
    case 'any': {
      const ofList = (condition as { of?: Condition[] }).of;
      if (!Array.isArray(ofList) || ofList.length === 0) {
        throw new ApprovalGateError(
          'RULE_SCHEMA_INVALID',
          `Condition '${kind}' at ${path} must contain non-empty 'of' array.`
        );
      }
      for (let i = 0; i < ofList.length; i++) {
        const child = ofList[i];
        if (!child) {
          throw new ApprovalGateError(
            'RULE_SCHEMA_INVALID',
            `Condition child at ${path}.of[${i}] is undefined.`
          );
        }
        validateConditionTree(child, `${path}.of[${i}]`, registry);
      }
      break;
    }
    case 'not': {
      const notOf = (condition as { of?: Condition }).of;
      if (!notOf) {
        throw new ApprovalGateError(
          'RULE_SCHEMA_INVALID',
          `Condition 'not' at ${path} must have 'of' property.`
        );
      }
      validateConditionTree(notOf, `${path}.of`, registry);
      break;
    }
    case 'tool': {
      if (registry) {
        const toolLeaf = condition as ToolLeaf;
        if (toolLeaf.connector && registry.knownConnectors) {
          const connectors = Array.isArray(toolLeaf.connector)
            ? toolLeaf.connector
            : [toolLeaf.connector];
          for (const c of connectors) {
            if (!registry.knownConnectors.includes(c)) {
              throw new ApprovalGateError(
                'RULE_REFERENCE_UNKNOWN',
                `Rule condition at ${path} references unknown connector '${c}'.`
              );
            }
          }
        }
        if (toolLeaf.tool && registry.knownTools) {
          const tools = Array.isArray(toolLeaf.tool) ? toolLeaf.tool : [toolLeaf.tool];
          for (const t of tools) {
            if (!registry.knownTools.includes(t)) {
              throw new ApprovalGateError(
                'RULE_REFERENCE_UNKNOWN',
                `Rule condition at ${path} references unknown tool '${t}'.`
              );
            }
          }
        }
      }
      break;
    }
    case 'scope': {
      if (registry && registry.knownObjectTypes) {
        const scopeLeaf = condition as ScopeLeaf;
        if (scopeLeaf.objectType) {
          const types = Array.isArray(scopeLeaf.objectType)
            ? scopeLeaf.objectType
            : [scopeLeaf.objectType];
          for (const t of types) {
            if (!registry.knownObjectTypes.includes(t)) {
              throw new ApprovalGateError(
                'RULE_REFERENCE_UNKNOWN',
                `Rule condition at ${path} references unknown objectType '${t}'.`
              );
            }
          }
        }
      }
      break;
    }
    case 'field': {
      const fieldLeaf = condition as {
        becomes?: { matches?: string; field?: string };
        changes?: { remainderNotEmpty?: string[] };
      };
      if (fieldLeaf.becomes?.matches !== undefined) {
        const pattern = fieldLeaf.becomes.matches;
        if (typeof pattern !== 'string' || pattern.length > 1024) {
          throw new ApprovalGateError(
            'RULE_PATTERN_INVALID',
            `Regex pattern at ${path}.becomes.matches exceeds 1024 characters or is invalid.`
          );
        }

        // ReDoS guard against catastrophic nested quantifiers (e.g. (a+)+, (.*)*)
        if (/\(.*[+*].*\)[+*]/.test(pattern) || /([+*]|\{\d+,?\d*\})\s*([+*]|\{\d+,?\d*\})/.test(pattern)) {
          throw new ApprovalGateError(
            'RULE_PATTERN_INVALID',
            `Regex pattern '${pattern}' at ${path}.becomes.matches contains nested quantifiers with catastrophic backtracking risk.`
          );
        }

        try {
          new RegExp(pattern);
        } catch (err) {
          throw new ApprovalGateError(
            'RULE_PATTERN_INVALID',
            `Regex pattern '${pattern}' at ${path}.becomes.matches is invalid regex: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      break;
    }
    case 'count': {
      const countLeaf = condition as {
        metric?: string;
        field?: string;
      };
      if (countLeaf.metric === 'fieldChanges' && !countLeaf.field) {
        throw new ApprovalGateError(
          'RULE_SCHEMA_INVALID',
          `Count condition at ${path} with metric 'fieldChanges' requires 'field' property.`
        );
      }
      break;
    }
    case 'ownership':
    case 'time':
    case 'irreversible':
    case 'permission':
      // Handled by JSON schema validation
      break;
    default:
      throw new ApprovalGateError(
        'RULE_SCHEMA_INVALID',
        `Unknown condition kind '${kind}' at ${path}.`
      );
  }
}

/**
 * Validates that an object conforms to rule-representation@1.0.0.
 * Performs deep semantic inspection on regex patterns, version compatibility,
 * origin restrictions, and optional manifest reference integrity.
 */
export function validateRule(data: unknown, registry?: ManifestRegistry): asserts data is Rule {
  if (!data || typeof data !== 'object') {
    throw new ApprovalGateError('RULE_SCHEMA_INVALID', 'Rule must be an object.');
  }

  // Origin check: Stored rules cannot claim hardline/static origin
  if (
    typeof data === 'object' &&
    data !== null &&
    'origin' in data &&
    (data as { origin?: unknown }).origin !== 'user'
  ) {
    const ruleId = (data as { id?: unknown }).id || 'unknown';
    throw new ApprovalGateError(
      'RULE_ORIGIN_FORBIDDEN',
      `Stored rule '${String(ruleId)}' cannot claim origin '${String((data as { origin?: unknown }).origin)}'. Only 'user' is permitted.`
    );
  }

  const valid = validateRuleSchema(data);
  if (!valid) {
    const errorDetails = (validateRuleSchema.errors || [])
      .map((e) => `${e.instancePath || 'root'}: ${e.message || 'invalid'}`)
      .join('; ');
    throw new ApprovalGateError(
      'RULE_SCHEMA_INVALID',
      `Rule schema validation failed: ${errorDetails}`
    );
  }

  const rule = data as Rule;

  // Origin check
  if (rule.origin !== 'user') {
    throw new ApprovalGateError(
      'RULE_ORIGIN_FORBIDDEN',
      `Stored rule '${rule.id}' cannot claim origin '${rule.origin}'. Only 'user' is permitted.`
    );
  }

  // Version check
  if (rule.representationVersion !== SUPPORTED_REPRESENTATION_VERSION) {
    const [supMajor] = SUPPORTED_REPRESENTATION_VERSION.split('.').map(Number);
    const [ruleMajor] = rule.representationVersion.split('.').map(Number);
    if ((ruleMajor ?? 0) > (supMajor ?? 0)) {
      throw new ApprovalGateError(
        'RULE_VERSION_AHEAD',
        `Rule '${rule.id}' uses representation version ${rule.representationVersion}, which is ahead of supported ${SUPPORTED_REPRESENTATION_VERSION}.`
      );
    }
    // Any mismatch at 1.0.0 is rejected
    throw new ApprovalGateError(
      'RULE_SCHEMA_INVALID',
      `Unsupported representation version '${rule.representationVersion}'. Expected '${SUPPORTED_REPRESENTATION_VERSION}'.`
    );
  }

  // Recursive condition verification
  validateConditionTree(rule.condition, 'condition', registry);
}
