import { describe, expect, it } from 'vitest';
import { app } from './app.js';

// These requests are rejected before any database or Redis call, so they run
// without either. vitest sets NODE_ENV=test.
describe('app', () => {
  it('rejects /v1 without an API key with problem details', async () => {
    const res = await app.request('/v1/account');
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      type: 'https://docs.postly.eu/errors/unauthorized',
      status: 401,
    });
  });

  it('does not mount /dev outside development', async () => {
    const res = await app.request('/dev/simulate-event', { method: 'POST', body: '{}' });
    expect(res.status).toBe(404);
  });
});
