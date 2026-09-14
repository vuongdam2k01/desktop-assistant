import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    alias: {
      // Importing electron as a value runs the npm package's shim, which goes looking for a
      // binary these tests do not need. See tests/helpers/electron-stub.ts.
      electron: path.resolve(here, 'tests/helpers/electron-stub.ts'),
    },
  },
});
