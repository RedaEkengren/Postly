import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.int.test.ts'],
    // env.ts validates at import. Clients connect lazily, so these are never dialled.
    env: {
      DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
      REDIS_URL: 'redis://127.0.0.1:1',
      DKIM_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      INTERNAL_TOKEN: 'test-internal-token-0123456789abcdef',
      KUMO_HTTP_URL: 'http://127.0.0.1:1',
    },
  },
});
