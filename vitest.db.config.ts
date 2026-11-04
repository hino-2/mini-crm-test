import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts', 'tests/db/**/*.acceptance.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
