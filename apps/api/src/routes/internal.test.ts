import { describe, expect, it } from 'vitest';
import { app } from '../app.js';

describe('/internal', () => {
  it('refuses requests without the internal token', async () => {
    for (const authorization of [undefined, 'Bearer wrong', 'Bearer test-internal-token-0123456789abcdeX']) {
      const res = await app.request('/internal/kumo/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        body: '[]',
      });
      expect(res.status).toBe(401);
    }
  });

  it('rejects records that are not KumoMTA log records', async () => {
    const res = await app.request('/internal/kumo/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-internal-token-0123456789abcdef' },
      body: JSON.stringify([{ hello: 'world' }]),
    });
    expect(res.status).toBe(400);
  });
});
