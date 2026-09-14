import { describe, it, expect } from 'vitest';
import { selectUnpackedDirectory } from '../scripts/unpacked-artifact.mjs';

/**
 * The release directory accumulates output from every platform that has ever packaged in
 * that working copy. Taking whichever entry the filesystem lists first means a macOS build
 * in a tree that still holds a Linux one verifies the Linux artifact and reports success
 * for a package it never examined.
 */
describe('which unpacked artifact the packaging check verifies', () => {
  const mixed = ['linux-unpacked', 'mac-arm64', 'win-unpacked'];

  it('picks the one belonging to the platform being packaged', () => {
    expect(selectUnpackedDirectory(mixed, 'darwin', 'arm64')).toBe('mac-arm64');
    expect(selectUnpackedDirectory(mixed, 'win32', 'x64')).toBe('win-unpacked');
    expect(selectUnpackedDirectory(mixed, 'linux', 'x64')).toBe('linux-unpacked');
  });

  it('accepts the unsuffixed macOS directory that an Intel build produces', () => {
    expect(selectUnpackedDirectory(['mac'], 'darwin', 'x64')).toBe('mac');
  });

  it('distinguishes the two macOS architectures rather than taking either', () => {
    expect(selectUnpackedDirectory(['mac', 'mac-arm64'], 'darwin', 'arm64')).toBe('mac-arm64');
    expect(selectUnpackedDirectory(['mac', 'mac-arm64'], 'darwin', 'x64')).toBe('mac');
  });

  it('refuses when nothing matches the platform being packaged', () => {
    expect(() => selectUnpackedDirectory(['linux-unpacked'], 'darwin', 'arm64')).toThrow(/darwin/);
  });

  it('refuses rather than guessing when several entries match', () => {
    expect(() =>
      selectUnpackedDirectory(['linux-unpacked', 'linux-arm64-unpacked'], 'linux', 'x64')
    ).not.toThrow();
    expect(selectUnpackedDirectory(['linux-unpacked', 'linux-arm64-unpacked'], 'linux', 'arm64')).toBe(
      'linux-arm64-unpacked'
    );
  });
});
