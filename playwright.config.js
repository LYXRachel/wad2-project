import { defineConfig } from '@playwright/test'

// Browser tests: tests/<person>/e2e/. E2E_BASE_URL (e.g. the deployed site) skips starting the dev server.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/e2e/**/*.spec.js',

  use: {
    baseURL,
    headless: true
  },

  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true
  }
})
