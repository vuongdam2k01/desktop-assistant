/**
 * What the service is allowed to write about itself.
 *
 * The broker exchanges provider tokens and is required never to let one reach its output.
 * Redaction by path cannot express that requirement: the logging library matches a path
 * segment by segment and has no notion of "a key with this name, wherever it occurs", so
 * a configuration full of `*.*access_token*` entries matches nothing at all. The paths
 * below are the ones that genuinely work — fixed positions the framework itself logs —
 * and the value walk beside them covers every other depth by key name.
 */
export const CENSOR = '[REDACTED]';

export const LOG_REDACTION_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
] as const;

/**
 * A key is sensitive when its name, ignoring case and separators, contains one of these.
 * Matching the name rather than the position is what makes the depth irrelevant.
 */
const SENSITIVE_FRAGMENTS = [
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'clientsecret',
  'authorization',
  'cookie',
  'password',
  'secret',
  'credential',
  'privatekey',
  'apikey',
  'codeverifier',
  'binding',
];

function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_FRAGMENTS.some(fragment => normalised.includes(fragment));
}

const MAX_DEPTH = 12;

/**
 * Returns a copy of `value` with every sensitive key censored at any depth.
 *
 * The copy is shallow per level and stops at a depth no legitimate log record reaches, so a
 * cyclic or pathological object cannot turn a log call into an unbounded walk.
 */
export function deepRedact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return CENSOR;
  }

  if (Array.isArray(value)) {
    return value.map(entry => deepRedact(entry, depth + 1));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date || value instanceof Error) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? CENSOR : deepRedact(entry, depth + 1);
  }
  return result;
}

/**
 * The logger configuration the service runs with, in one place so that what protects the
 * output can be inspected and tested rather than read.
 */
export function buildLoggerOptions(): {
  level: string;
  redact: { paths: string[]; censor: string };
  formatters: { log: (object: Record<string, unknown>) => Record<string, unknown> };
} {
  return {
    level: 'info',
    redact: { paths: [...LOG_REDACTION_PATHS], censor: CENSOR },
    formatters: {
      log: object => deepRedact(object) as Record<string, unknown>,
    },
  };
}
