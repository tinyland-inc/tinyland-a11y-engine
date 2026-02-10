import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tinyland-a11y-engine',
    root: '.',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'jsdom',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});
