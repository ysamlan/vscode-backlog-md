import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/cdp/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 90_000,
    pool: 'forks',
    maxConcurrency: 1,
    sequence: {
      concurrent: false,
    },
  },
});
