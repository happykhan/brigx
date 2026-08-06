import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'dev-runtime.spec.ts',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://127.0.0.1:5173' },
  projects: [{ name: 'chromium-dev', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --force',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
