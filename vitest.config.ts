import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));


export default defineConfig({
  root: __dirname,
  test: {
    name: 'tinyland-a11y-engine',
    root: __dirname,
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    setupFiles: [resolve(__dirname, './tests/setup-dom.ts')],
    pool: 'threads',
    deps: {
      interopDefault: true,
    },
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});
