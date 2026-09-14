import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1, // Electron instances run sequentially
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
});
