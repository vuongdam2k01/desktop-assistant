#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distCli = join(__dirname, '../dist/cli.js');

// The fallback this used to carry pointed at `src/cli.js`, which never exists: the
// source is TypeScript. It could only ever fire on a machine with no build, where it
// then failed with a module-resolution error instead of saying what was wrong.
if (!existsSync(distCli)) {
  console.error(
    'build-check has not been built yet. Run `pnpm build` (or `pnpm --filter @desktop-assistant/build-check build`) first.'
  );
  process.exit(1);
}

// An absolute Windows path is not a URL the ESM loader accepts; it has to be a file:// URL.
const { run } = await import(pathToFileURL(distCli).href);
await run();
