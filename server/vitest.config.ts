import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The suite shares one Postgres database and re-seeds per file, so files
    // must not run concurrently.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
