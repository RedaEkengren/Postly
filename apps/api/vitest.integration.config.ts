import { defineConfig } from 'vitest/config';

// Runs against the real Postgres and Redis in DATABASE_URL and REDIS_URL.
// Use a throwaway database and Redis db: see `pnpm test:integration` in the README.
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    globalSetup: ['src/test/migrate-once.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    // Required by env.ts; test-only values, not connection strings.
    env: {
      DKIM_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      INTERNAL_TOKEN: 'integration-internal-token-0123456789',
    },
  },
});
