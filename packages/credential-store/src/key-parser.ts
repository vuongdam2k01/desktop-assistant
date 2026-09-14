import { CredentialStoreError } from './errors.js';

export interface ParsedCredentialKey {
  domain: string;
  category: string;
  identity: string;
  field?: string;
  segments: [string, string, string] | [string, string, string, string];
}

const UNPAIRED_SURROGATE_REGEX =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const UNICODE_WHITESPACE_OR_SPECIAL_REGEX =
  /[\s\u2000-\u200f\u2028\u2029\u3000\ufeff]/;

function hasInvalidKeyCharacters(str: string): boolean {
  if (UNPAIRED_SURROGATE_REGEX.test(str)) {
    return true;
  }

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // C0 controls (0..31), space (32), DEL (127), and C1 controls (128..159)
    if (code <= 32 || code === 127 || (code >= 128 && code <= 159)) {
      return true;
    }
  }

  return UNICODE_WHITESPACE_OR_SPECIAL_REGEX.test(str);
}

function validateSegment(segment: string, rawKey: string): void {
  if (segment.length === 0 || hasInvalidKeyCharacters(segment)) {
    throw new CredentialStoreError({
      code: 'KEY_MALFORMED',
      key: rawKey,
    });
  }
}

/**
 * Parses and validates a credential key.
 * Must consist of exactly 3 or 4 non-empty colon-separated segments:
 * <domain>:<category>:<identity>[:<field>]
 */
export function parseCredentialKey(key: string): ParsedCredentialKey {
  if (typeof key !== 'string' || key.length === 0) {
    throw new CredentialStoreError({
      code: 'KEY_MALFORMED',
      key: typeof key === 'string' ? key : String(key),
    });
  }

  if (hasInvalidKeyCharacters(key) || key.startsWith(':') || key.endsWith(':')) {
    throw new CredentialStoreError({
      code: 'KEY_MALFORMED',
      key,
    });
  }

  const parts = key.split(':');
  if (parts.length !== 3 && parts.length !== 4) {
    throw new CredentialStoreError({
      code: 'KEY_MALFORMED',
      key,
    });
  }

  const domain = parts[0]!;
  const category = parts[1]!;
  const identity = parts[2]!;
  const field = parts[3];

  validateSegment(domain, key);
  validateSegment(category, key);
  validateSegment(identity, key);
  if (field !== undefined) {
    validateSegment(field, key);
  }

  const segments: [string, string, string] | [string, string, string, string] =
    parts.length === 3 ? [domain, category, identity] : [domain, category, identity, field!];

  return {
    domain,
    category,
    identity,
    ...(field !== undefined ? { field } : {}),
    segments,
  };
}

/**
 * Parses and validates a credential prefix.
 * Prefix must be '*' (all) or a colon-terminated prefix with at least domain and category
 * e.g. "connector:notion:" or "connector:notion:default:".
 */
export function parseCredentialPrefix(prefix: string): string {
  if (typeof prefix !== 'string' || prefix.length === 0) {
    throw new CredentialStoreError({
      code: 'KEY_MALFORMED',
      key: typeof prefix === 'string' ? prefix : String(prefix),
    });
  }

  if (prefix === '*') {
    return '*';
  }

  if (hasInvalidKeyCharacters(prefix)) {
    throw new CredentialStoreError({
      code: 'KEY_MALFORMED',
      key: prefix,
    });
  }

  if (!prefix.endsWith(':')) {
    throw new CredentialStoreError({
      code: 'KEY_MALFORMED',
      key: prefix,
    });
  }

  const parts = prefix.slice(0, -1).split(':');
  if (parts.length < 2) {
    throw new CredentialStoreError({
      code: 'KEY_MALFORMED',
      key: prefix,
    });
  }

  for (const part of parts) {
    if (part.length === 0) {
      throw new CredentialStoreError({
        code: 'KEY_MALFORMED',
        key: prefix,
      });
    }
  }

  return prefix;
}
