import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-db.ts'],
    // All test files share one Postgres container, so they must not run in
    // parallel — truncateAll() in one file would wipe another file's data
    // mid-test. Serialize files; tests within a file already run sequentially.
    fileParallelism: false,
    // Container startup + migrations can take a few seconds on a cold image pull.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
