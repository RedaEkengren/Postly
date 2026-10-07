// Regenerates docs/openapi.json from the routes. Run after changing the API:
//   pnpm --filter @postly/api openapi:write
// The snapshot test fails until this has been run and the diff reviewed.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

// env.ts validates at import; nothing is dialled while generating the document.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://openapi@127.0.0.1:1/openapi';
process.env.REDIS_URL ??= 'redis://127.0.0.1:1';
process.env.DKIM_ENCRYPTION_KEY ??= Buffer.alloc(32).toString('base64');
process.env.INTERNAL_TOKEN ??= 'openapi-generation-not-a-real-token';

const { app, OPENAPI_CONFIG } = await import('../src/app.js');
const target = path.resolve(import.meta.dirname, '../../../docs/openapi.json');
writeFileSync(target, `${JSON.stringify(app.getOpenAPI31Document(OPENAPI_CONFIG), null, 2)}\n`);
console.log(`Wrote ${target}`);
