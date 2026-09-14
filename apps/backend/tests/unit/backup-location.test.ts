import { describe, it, expect } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { resolveBackupDirectory, REPOSITORY_ROOT } from '../../src/cli/backup-location.js';

/**
 * A database backup contains every account, device, session and invitation row the
 * service holds. The working tree is the one place it must never land: a scheduled
 * backup that runs from a checkout writes the file where the next commit would pick
 * it up, and the repository's own secret scanner does not look there.
 */
describe('where a database backup is written', () => {
  it('defaults outside the repository', () => {
    const resolved = resolveBackupDirectory({});
    expect(resolved.startsWith(REPOSITORY_ROOT + path.sep)).toBe(false);
    expect(resolved.startsWith(os.homedir())).toBe(true);
  });

  it('refuses an explicit directory inside the repository', () => {
    expect(() => resolveBackupDirectory({ requested: path.join(REPOSITORY_ROOT, 'apps/backend/backups') })).toThrow(
      /inside the repository/i
    );
  });

  it('refuses the repository root itself', () => {
    expect(() => resolveBackupDirectory({ requested: REPOSITORY_ROOT })).toThrow(/inside the repository/i);
  });

  it('refuses a directory that climbs back into the repository', () => {
    const sneaky = path.join(REPOSITORY_ROOT, 'apps', '..', 'apps', 'backend', 'backups');
    expect(() => resolveBackupDirectory({ requested: sneaky })).toThrow(/inside the repository/i);
  });

  it('accepts an explicit directory outside the repository', () => {
    const outside = path.join(os.tmpdir(), 'desktop-assistant-backup-test');
    expect(resolveBackupDirectory({ requested: outside })).toBe(outside);
  });

  it('reads the environment when no directory is passed', () => {
    const outside = path.join(os.tmpdir(), 'from-the-environment');
    expect(resolveBackupDirectory({ env: { BACKEND_BACKUP_DIR: outside } })).toBe(outside);
  });

  it('refuses an environment directory inside the repository too', () => {
    expect(() =>
      resolveBackupDirectory({ env: { BACKEND_BACKUP_DIR: path.join(REPOSITORY_ROOT, 'backups') } })
    ).toThrow(/inside the repository/i);
  });
});
