/* import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    // During development, send /api/... requests to the Express server
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
}) */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Vitest (unit + component tests): skip e2e/, those are Playwright tests
  test: {
    exclude: ['node_modules/**', 'e2e/**']
  },
  server: {
    host: true, // listen on all addresses, IPv4 and IPv6
    proxy: {
      '/api': 'http://127.0.0.1:3000'
    }
  },
  // Unit tests live in tests/<person>/ (browser tests in tests/<person>/e2e/ run with Playwright)
  test: {
    include: ['tests/**/*.spec.js'],
    exclude: ['tests/**/e2e/**', '**/node_modules/**']
  }
})
