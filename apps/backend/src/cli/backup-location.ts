import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * The root of this checkout, found by walking up from this file to the workspace manifest.
 * Resolved once, so a command that changes its working directory cannot move it.
 */
function findRepositoryRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return dir;
    }
    dir = parent;
  }
}

export const REPOSITORY_ROOT = findRepositoryRoot();

function isInsideRepository(candidate: string): boolean {
  const relative = path.relative(REPOSITORY_ROOT, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Decides where a database backup is written.
 *
 * A backup holds every account, device, session and invitation row the service has. The
 * working tree is the one directory it must never occupy: a scheduled backup that runs
 * from a checkout would leave the dump where the next commit picks it up, and this
 * repository's secret scanner does not look there. So a path inside the checkout is
 * refused outright rather than merely discouraged, and the default lives in the operator's
 * home directory instead.
 */
export function resolveBackupDirectory(
  options: { requested?: string | undefined; env?: NodeJS.ProcessEnv } = {}
): string {
  const env = options.env ?? process.env;
  const requested = options.requested ?? env.BACKEND_BACKUP_DIR;

  if (requested && requested.trim().length > 0) {
    const resolved = path.resolve(requested);
    if (isInsideRepository(resolved)) {
      throw new Error(
        `Refusing to write database backups to ${resolved}, which is inside the repository at ${REPOSITORY_ROOT}. ` +
          'A dump left in the working tree can be committed. Choose a directory outside the checkout, ' +
          'or set BACKEND_BACKUP_DIR.'
      );
    }
    return resolved;
  }

  return path.join(os.homedir(), '.desktop-assistant', 'backups');
}
