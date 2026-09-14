import { describe, it, expect } from 'vitest';
import { deepRedact, CENSOR, buildLoggerOptions } from '../../src/http/log-redaction.js';

const CANARY = 'canary-value-that-must-never-be-logged';

/**
 * The broker exchanges provider tokens and is required never to let one reach its output.
 * Today nothing logs a token-bearing object, so the requirement holds by accident; the
 * moment someone logs a provider response while debugging a rejection, the control is all
 * that stands between that response and stdout. A control that cannot fire is worse than
 * none, because the next reader trusts it.
 */
describe('what the logger is allowed to emit', () => {
  it('censors a sensitive key wherever it appears, not only at a fixed depth', () => {
    const redacted = deepRedact({
      access_token: CANARY,
      data: { refresh_token: CANARY },
      res: { body: { tokens: { id_token: CANARY } } },
      list: [{ clientSecret: CANARY }],
    }) as Record<string, unknown>;

    expect(JSON.stringify(redacted)).not.toContain(CANARY);
    expect(redacted.access_token).toBe(CENSOR);
  });

  it('leaves everything else intact', () => {
    const redacted = deepRedact({
      providerId: 'notion',
      status: 200,
      nested: { retries: 2, url: 'https://api.notion.com/v1/oauth/token' },
    }) as Record<string, unknown>;

    expect(redacted.providerId).toBe('notion');
    expect((redacted.nested as Record<string, unknown>).url).toBe(
      'https://api.notion.com/v1/oauth/token'
    );
  });

  it('applies the value walk through the configuration the service actually runs with', () => {
    const options = buildLoggerOptions();
    const emitted = options.formatters.log({
      res: { data: { access_token: CANARY, refresh_token: CANARY } },
      binding: CANARY,
    });

    expect(JSON.stringify(emitted)).not.toContain(CANARY);
  });

  it('keeps only the paths the logging library can actually match', () => {
    const options = buildLoggerOptions();

    // A path with a partial-string wildcard matches nothing; keeping one would look like a
    // control and behave like a comment.
    for (const path of options.redact.paths) {
      expect(path).not.toMatch(/\*[^.[\]]/);
    }
    expect(options.redact.paths).toContain('req.headers.authorization');
    expect(options.redact.censor).toBe(CENSOR);
  });
});
