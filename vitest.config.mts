import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['./tests/unit/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 20000
  }
});
