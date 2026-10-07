import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, idempotencyKeys, messages } from '@postly/db';
import { app } from '../app.js';
import { getDb } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';
import { getSendQueue } from '../lib/queue.js';
import { createTenant } from '../test/fixtures.js';

let tenant: Awaited<ReturnType<typeof createTenant>>;

function send(body: object, headers: Record<string, string> = {}) {
  return app.request('/v1/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tenant.apiKey}`, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const email = () => ({ from: `hello@${tenant.domain}`, to: ['someone@example.com'], subject: 'Hi', text: 'Hej' });

beforeAll(async () => {
  tenant = await createTenant();
});

afterAll(async () => {
  await getSendQueue().obliterate({ force: true });
  await getRedis().quit();
});

describe('POST /v1/emails', () => {
  it('stores the content on the message and enqueues only the id', async () => {
    const res = await send(email());
    expect(res.status).toBe(202);
    const { id } = (await res.json()) as { id: string };

    const [row] = await getDb().select().from(messages).where(eq(messages.id, id));
    expect(row!.payload).toMatchObject({ subject: 'Hi', text: 'Hej' });
    expect((await getSendQueue().getJob(id))!.data).toEqual({ messageId: id, tenantId: tenant.tenantId });
  });

  it('creates one message for concurrent requests with the same Idempotency-Key', async () => {
    const key = crypto.randomUUID();
    const body = email();
    const responses = await Promise.all(Array.from({ length: 5 }, () => send(body, { 'Idempotency-Key': key })));

    expect(responses.map((r) => r.status)).toEqual([202, 202, 202, 202, 202]);
    const ids = new Set(await Promise.all(responses.map(async (r) => ((await r.json()) as { id: string }).id)));
    expect(ids.size).toBe(1);
    const rows = await getDb().select().from(messages).where(eq(messages.idempotencyKey, key));
    expect(rows).toHaveLength(1);
  });

  it('rejects the same key with a different body', async () => {
    const key = crypto.randomUUID();
    expect((await send(email(), { 'Idempotency-Key': key })).status).toBe(202);
    const res = await send({ ...email(), subject: 'Different' }, { 'Idempotency-Key': key });
    expect(res.status).toBe(409);
  });

  it('treats an expired key as unused', async () => {
    const key = crypto.randomUUID();
    const first = (await (await send(email(), { 'Idempotency-Key': key })).json()) as { id: string };
    await getDb()
      .update(idempotencyKeys)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(idempotencyKeys.key, key));

    const second = (await (await send(email(), { 'Idempotency-Key': key })).json()) as { id: string };
    expect(second.id).not.toBe(first.id);
  });

  it('answers invalid JSON with 400, not 500', async () => {
    const res = await app.request('/v1/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tenant.apiKey}`, 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /v1/emails pagination', () => {
  it('pages through rows with identical created_at without skipping or repeating', async () => {
    const own = await createTenant();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const ids = Array.from({ length: 5 }, () => crypto.randomUUID());
    await getDb()
      .insert(messages)
      .values(
        ids.map((id) => ({
          id,
          tenantId: own.tenantId,
          domainId: own.domainId,
          fromAddr: 'a@b.c',
          toAddrs: ['x@y.z'],
          subject: 's',
          status: 'sent',
          createdAt,
        })),
      );

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const qs = new URLSearchParams({ limit: '2', ...(cursor ? { cursor } : {}) });
      const res = await app.request(`/v1/emails?${qs}`, { headers: { Authorization: `Bearer ${own.apiKey}` } });
      const page = (await res.json()) as { data: { id: string }[]; next_cursor: string | null };
      seen.push(...page.data.map((m) => m.id));
      cursor = page.next_cursor;
    } while (cursor);

    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(ids));
  });
});
