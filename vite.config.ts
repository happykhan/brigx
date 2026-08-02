import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { readFileSync } from 'fs'
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2020',
    outDir: 'out',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Several integration tests intentionally parse 5-6 Mbp real genome
    // fixtures. Leave enough headroom when CI runs those files in parallel.
    testTimeout: 15_000,
    hookTimeout: 30_000,
    include: ['**/__tests__/**/*.{ts,tsx}', '**/*.{spec,test}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/tests/electron/**'],
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
