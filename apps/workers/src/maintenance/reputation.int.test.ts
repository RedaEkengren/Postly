import crypto from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { and, auditLog, domains, eq, events, messages, tenants } from '@postly/db';
import { getDb } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';
import { reviewReputation } from './reputation.js';

afterAll(async () => {
  await getRedis().quit();
});

/** A tenant with one message and `outcomes` events on it in the last hour. */
async function tenantWith(outcomes: { type: string; bounceType?: 'hard' | 'soft'; n: number }[]) {
  const db = getDb();
  const [tenant] = await db.insert(tenants).values({ name: `rep-${crypto.randomUUID()}`, plan: 'payg' }).returning();
  const [domain] = await db.insert(domains).values({ tenantId: tenant!.id, domain: `${crypto.randomUUID().slice(0, 8)}.test` }).returning();
  const [message] = await db
    .insert(messages)
    .values({ tenantId: tenant!.id, domainId: domain!.id, fromAddr: 'a@b.test', toAddrs: ['x@y.test'], subject: 's', status: 'sent' })
    .returning();
  const rows = outcomes.flatMap(({ type, bounceType, n }) =>
    Array.from({ length: n }, () => ({
      messageId: message!.id,
      tenantId: tenant!.id,
      type,
      ts: new Date(Date.now() - 60_000),
      payload: bounceType ? { bounce_type: bounceType } : {},
    })),
  );
  await db.insert(events).values(rows);
  return tenant!.id;
}

const statusOf = async (id: string) => (await getDb().select().from(tenants).where(eq(tenants.id, id)))[0]!.status;

describe('reviewReputation', () => {
  it('suspends a tenant above 0.3% complaints and records why', async () => {
    const id = await tenantWith([
      { type: 'delivered', n: 250 },
      { type: 'complained', n: 1 },
    ]);
    await reviewReputation();
    expect(await statusOf(id)).toBe('suspended');
    const [entry] = await getDb()
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.tenantId, id), eq(auditLog.action, 'tenant.auto_suspended')));
    expect(entry!.metadata).toMatchObject({ sample: 250 });
  });

  it('pauses on hard bounces above 5%, not on soft bounces', async () => {
    const hard = await tenantWith([
      { type: 'delivered', n: 180 },
      { type: 'bounced', bounceType: 'hard', n: 20 },
    ]);
    const soft = await tenantWith([
      { type: 'delivered', n: 180 },
      { type: 'bounced', bounceType: 'soft', n: 20 },
    ]);
    await reviewReputation();
    expect(await statusOf(hard)).toBe('paused');
    expect(await statusOf(soft)).toBe('active');
  });

  it('leaves small samples alone', async () => {
    const id = await tenantWith([
      { type: 'delivered', n: 10 },
      { type: 'complained', n: 3 },
    ]);
    await reviewReputation();
    expect(await statusOf(id)).toBe('active');
  });
});
