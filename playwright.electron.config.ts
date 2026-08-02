import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/electron',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
