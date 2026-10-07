import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { app, OPENAPI_CONFIG } from '../app.js';

const SNAPSHOT = path.resolve(import.meta.dirname, '../../../../docs/openapi.json');

describe('OpenAPI document', () => {
  it('matches the reviewed snapshot in docs/openapi.json', () => {
    const generated = `${JSON.stringify(app.getOpenAPI31Document(OPENAPI_CONFIG), null, 2)}\n`;
    // If this fails, the API contract changed. Run `pnpm --filter @postly/api openapi:write`,
    // review the diff in docs/openapi.json, and commit it with the change.
    expect(generated).toBe(readFileSync(SNAPSHOT, 'utf8'));
  });

  it('is served at /v1/openapi.json without authentication', async () => {
    const res = await app.request('/v1/openapi.json');
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toContain('/v1/emails');
  });
});
