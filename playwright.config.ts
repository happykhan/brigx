import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: 'dev-runtime.spec.ts',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Exercise the immutable production output, not Vite's dependency-optimised
    // development graph (which can be invalidated during a clean install).
    command: 'npm run build && npm run start -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
