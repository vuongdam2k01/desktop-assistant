import { describe, it, expect } from 'vitest';
import { parseCredentialKey, parseCredentialPrefix } from '../src/key-parser.js';
import { CredentialStoreError } from '../src/errors.js';

describe('Key and prefix parsing boundaries', () => {
  it('parses valid 3-segment keys', () => {
    const parsed = parseCredentialKey('connector:notion:default');
    expect(parsed.domain).toBe('connector');
    expect(parsed.category).toBe('notion');
    expect(parsed.identity).toBe('default');
    expect(parsed.field).toBeUndefined();
    expect(parsed.segments).toEqual(['connector', 'notion', 'default']);
  });

  it('parses valid 4-segment keys', () => {
    const parsed = parseCredentialKey('connector:notion:default:token');
    expect(parsed.domain).toBe('connector');
    expect(parsed.category).toBe('notion');
    expect(parsed.identity).toBe('default');
    expect(parsed.field).toBe('token');
    expect(parsed.segments).toEqual(['connector', 'notion', 'default', 'token']);
  });

  it('rejects keys with fewer than 3 segments', () => {
    expect(() => parseCredentialKey('connector:notion')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector')).toThrowError(CredentialStoreError);
  });

  it('rejects keys with more than 4 segments', () => {
    expect(() => parseCredentialKey('connector:notion:default:token:extra')).toThrowError(
      CredentialStoreError
    );
  });

  it('rejects keys with whitespace or control characters', () => {
    expect(() => parseCredentialKey(' connector:notion:default')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector:notion:default ')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector:no tion:default')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector:notion:def\x00ault')).toThrowError(
      CredentialStoreError
    );
    expect(() => parseCredentialKey('connector:notion:def\nault')).toThrowError(CredentialStoreError);
    // Non-ASCII Unicode whitespace and C1 controls
    expect(() => parseCredentialKey('connector:notion:def\u00A0ault')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector:notion:def\u3000ault')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector:notion:def\u0085ault')).toThrowError(CredentialStoreError);
    // Unpaired surrogates
    expect(() => parseCredentialKey('connector:notion:def\uD800ault')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector:notion:def\uDFFFault')).toThrowError(CredentialStoreError);
  });

  it('accepts valid paired astral plane Unicode characters in keys and prefixes', () => {
    const parsed = parseCredentialKey('connector:notion:acc😀:token');
    expect(parsed.identity).toBe('acc😀');
    expect(parseCredentialPrefix('connector:notion:acc😀:')).toBe('connector:notion:acc😀:');
  });
  it('rejects keys with empty segments or leading/trailing colons', () => {
    expect(() => parseCredentialKey(':connector:notion:default')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector:notion:default:')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialKey('connector::default')).toThrowError(CredentialStoreError);
  });

  it('parses prefix wildcard *', () => {
    expect(parseCredentialPrefix('*')).toBe('*');
  });

  it('parses valid colon-terminated prefixes with at least domain and category', () => {
    expect(parseCredentialPrefix('connector:notion:')).toBe('connector:notion:');
    expect(parseCredentialPrefix('connector:notion:default:')).toBe('connector:notion:default:');
  });

  it('rejects prefixes missing trailing colon', () => {
    expect(() => parseCredentialPrefix('connector:notion')).toThrowError(CredentialStoreError);
  });

  it('rejects single-segment prefixes', () => {
    expect(() => parseCredentialPrefix('connector:')).toThrowError(CredentialStoreError);
  });

  it('rejects prefixes with whitespace, control characters, or empty segments', () => {
    expect(() => parseCredentialPrefix(' connector:notion:')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialPrefix('connector:notion: ')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialPrefix('connector::')).toThrowError(CredentialStoreError);
    expect(() => parseCredentialPrefix('connector:not\x01ion:')).toThrowError(CredentialStoreError);
  });
});
