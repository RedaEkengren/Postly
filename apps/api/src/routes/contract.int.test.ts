import crypto from 'node:crypto';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, messages, suppressions, webhookDeliveries, webhooks } from '@postly/db';
import { QUEUE_NAMES, deliveryJobId } from '@postly/shared';
import { app } from '../app.js';
import { getDb } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';
import { getSendQueue } from '../lib/queue.js';
import { createTenant } from '../test/fixtures.js';

let tenant: Awaited<ReturnType<typeof createTenant>>;
const webhookQueue = new Queue(QUEUE_NAMES.webhook, { connection: getRedis() });

function call(method: string, path: string, body?: object) {
  return app.request(path, {
    method,
    headers: { Authorization: `Bearer ${tenant.apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const email = (to: string, extra: object = {}) => ({
  from: `hello@${tenant.domain}`,
  to: [to],
  subject: 'Hi',
  text: 'Hej',
  ...extra,
});

beforeAll(async () => {
  tenant = await createTenant();
});

afterAll(async () => {
  await getSendQueue().obliterate({ force: true });
  await webhookQueue.obliterate({ force: true });
  await webhookQueue.close();
  await getRedis().quit();
});

describe('POST /v1/emails/batch', () => {
  it('accepts or rejects each message on its own', async () => {
    await getDb().insert(suppressions).values({ tenantId: tenant.tenantId, address: 'blocked@example.com', reason: 'manual' });
    const res = await call('POST', '/v1/emails/batch', {
      messages: [
        email('ok@example.com'),
        email('blocked@example.com'),
        { ...email('ok@example.com'), from: 'hello@unverified.example' },
      ],
    });
    expect(res.status).toBe(202);
    const { results } = (await res.json()) as { results: { index: number; status: string; id?: string; error?: { type: string } }[] };
    expect(results.map((r) => r.status)).toEqual(['queued', 'rejected', 'rejected']);
    expect(results[1]!.error!.type).toBe('recipient_suppressed');
    expect(results[2]!.error!.type).toBe('domain_not_verified');
    expect(await getSendQueue().getJob(results[0]!.id!)).toBeDefined();
  });

  it('honours a per-message idempotency key', async () => {
    const key = crypto.randomUUID();
    const body = { messages: [{ ...email('once@example.com'), idempotency_key: key }] };
    const first = (await (await call('POST', '/v1/emails/batch', body)).json()) as { results: { id: string }[] };
    const second = (await (await call('POST', '/v1/emails/batch', body)).json()) as { results: { id: string }[] };
    expect(second.results[0]!.id).toBe(first.results[0]!.id);
  });
});

describe('DELETE /v1/emails/:id', () => {
  const scheduled = () => email('later@example.com', { scheduled_at: new Date(Date.now() + 3_600_000).toISOString() });

  it('cancels a scheduled email, clears its content and removes its job', async () => {
    const { id } = (await (await call('POST', '/v1/emails', scheduled())).json()) as { id: string };
    expect(await getSendQueue().getJob(id)).toBeDefined();

    expect((await call('DELETE', `/v1/emails/${id}`)).status).toBe(204);
    const [row] = await getDb().select().from(messages).where(eq(messages.id, id));
    expect(row!.status).toBe('canceled');
    expect(row!.payload).toBeNull();
    expect(await getSendQueue().getJob(id)).toBeUndefined();

    expect((await call('DELETE', `/v1/emails/${id}`)).status).toBe(409);
  });

  it('refuses once a worker has claimed the email', async () => {
    const { id } = (await (await call('POST', '/v1/emails', scheduled())).json()) as { id: string };
    await getDb().update(messages).set({ claimedAt: new Date() }).where(eq(messages.id, id));
    expect((await call('DELETE', `/v1/emails/${id}`)).status).toBe(409);
  });

  it('answers 404 for an email that is not the tenant\'s', async () => {
    expect((await call('DELETE', `/v1/emails/${crypto.randomUUID()}`)).status).toBe(404);
  });
});

describe('POST /v1/webhooks/:id/replay', () => {
  it('requeues failed deliveries since `after` and listed events, and leaves pending ones alone', async () => {
    const [webhook] = await getDb()
      .insert(webhooks)
      .values({ tenantId: tenant.tenantId, url: 'https://example.com/hook', secret: 'whsec_x', events: ['email.sent'] })
      .returning();
    const delivery = (status: string, createdAt: Date, attempts = 7) => ({
      webhookId: webhook!.id,
      eventId: crypto.randomUUID(),
      status,
      attempts,
      createdAt,
      eventType: 'email.sent',
      payload: { type: 'email.sent' },
    });
    const since = new Date(Date.now() - 3_600_000);
    const rows = await getDb()
      .insert(webhookDeliveries)
      .values([
        delivery('failed', new Date(Date.now() - 7_200_000)),
        delivery('failed', new Date()),
        delivery('pending', new Date(), 2),
        delivery('delivered', new Date(Date.now() - 7_200_000), 1),
      ])
      .returning();
    const [oldFailed, newFailed, pending, delivered] = rows;

    const res = await call('POST', `/v1/webhooks/${webhook!.id}/replay`, {
      after: since.toISOString(),
      event_ids: [delivered!.eventId],
    });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ replayed: 2 });

    expect(await webhookQueue.getJob(deliveryJobId(newFailed!.id, 8))).toBeDefined();
    expect(await webhookQueue.getJob(deliveryJobId(delivered!.id, 2))).toBeDefined();
    const status = async (id: string) =>
      (await getDb().select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id)))[0]!.status;
    expect(await status(oldFailed!.id)).toBe('failed');
    expect(await status(pending!.id)).toBe('pending');
  });

  it('needs after or event_ids', async () => {
    const [webhook] = await getDb()
      .insert(webhooks)
      .values({ tenantId: tenant.tenantId, url: 'https://example.com/hook', secret: 'whsec_x', events: ['email.sent'] })
      .returning();
    expect((await call('POST', `/v1/webhooks/${webhook!.id}/replay`, {})).status).toBe(400);
  });
});
