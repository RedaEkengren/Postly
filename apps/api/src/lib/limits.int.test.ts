import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, messages, tenants } from '@postly/db';
import { app } from '../app.js';
import { getDb } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';
import { getSendQueue } from '../lib/queue.js';
import { createTenant } from '../test/fixtures.js';

let tenant: Awaited<ReturnType<typeof createTenant>>;
const send = () =>
  app.request('/v1/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tenant.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `hello@${tenant.domain}`, to: ['a@example.com'], subject: 's', text: 't' }),
  });

beforeAll(async () => {
  tenant = await createTenant();
});

afterAll(async () => {
  await getSendQueue().obliterate({ force: true });
  await getRedis().quit();
});

describe('sending limits and pauses', () => {
  it('refuses the 101st email of the day on the free plan with 422', async () => {
    await getDb()
      .insert(messages)
      .values(
        Array.from({ length: 100 }, () => ({
          tenantId: tenant.tenantId,
          domainId: tenant.domainId,
          fromAddr: 'a@b.test',
          toAddrs: ['x@y.test'],
          subject: 's',
          status: 'sent',
        })),
      );
    const res = await send();
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ type: 'https://docs.postly.eu/errors/quota_exceeded' });
  });

  it('lets a paused tenant read but not send', async () => {
    const paused = await createTenant();
    await getDb().update(tenants).set({ status: 'paused' }).where(eq(tenants.id, paused.tenantId));
    const headers = { Authorization: `Bearer ${paused.apiKey}`, 'Content-Type': 'application/json' };

    const sendRes = await app.request('/v1/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({ from: `hello@${paused.domain}`, to: ['a@example.com'], subject: 's', text: 't' }),
    });
    expect(sendRes.status).toBe(403);
    expect(await sendRes.json()).toMatchObject({ type: 'https://docs.postly.eu/errors/tenant_paused' });

    expect((await app.request('/v1/emails', { headers })).status).toBe(200);
  });
});
