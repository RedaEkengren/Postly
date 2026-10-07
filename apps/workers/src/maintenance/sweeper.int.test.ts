import crypto from 'node:crypto';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { domains, eq, messages, tenants, webhookDeliveries, webhooks } from '@postly/db';
import { QUEUE_NAMES } from '@postly/shared';
import { getDb } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';
import { claimMessage, processSendJob } from '../send/processor.js';
import { deliveryJobId } from '../webhook/schedule.js';
import { requeueStrandedDeliveries, requeueStrandedMessages } from './sweeper.js';

let tenantId: string;
let domainId: string;
const sendQueue = new Queue(QUEUE_NAMES.send, { connection: getRedis() });
const webhookQueue = new Queue(QUEUE_NAMES.webhook, { connection: getRedis() });
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

async function insertMessage(overrides: Partial<typeof messages.$inferInsert> = {}) {
  const id = crypto.randomUUID();
  await getDb()
    .insert(messages)
    .values({
      id,
      tenantId,
      domainId,
      fromAddr: 'a@b.test',
      toAddrs: ['x@y.test'],
      subject: 's',
      status: 'queued',
      payload: { from: 'a@b.test', to: ['x@y.test'], subject: 's', text: 't' },
      createdAt: minutesAgo(10),
      ...overrides,
    });
  return id;
}

beforeAll(async () => {
  await sendQueue.obliterate({ force: true });
  await webhookQueue.obliterate({ force: true });
  const [tenant] = await getDb().insert(tenants).values({ name: 'sweeper-test' }).returning();
  tenantId = tenant!.id;
  const [domain] = await getDb()
    .insert(domains)
    .values({ tenantId, domain: `${crypto.randomUUID().slice(0, 8)}.test` })
    .returning();
  domainId = domain!.id;
});

afterAll(async () => {
  await sendQueue.obliterate({ force: true });
  await webhookQueue.obliterate({ force: true });
  await sendQueue.close();
  await webhookQueue.close();
  await getRedis().quit();
});

describe('requeueStrandedMessages', () => {
  it('enqueues a queued message whose job is gone, once', async () => {
    const id = await insertMessage();
    expect(await requeueStrandedMessages()).toBeGreaterThanOrEqual(1);
    expect(await sendQueue.getJob(id)).toBeDefined();
    const again = await requeueStrandedMessages();
    expect(await sendQueue.getJob(id)).toBeDefined();
    expect(again).toBe(0);
  });

  it('leaves alone messages that are young, scheduled for later, or claimed', async () => {
    const young = await insertMessage({ createdAt: new Date() });
    const later = await insertMessage({ scheduledAt: new Date(Date.now() + 3_600_000) });
    const claimed = await insertMessage({ claimedAt: new Date() });
    await requeueStrandedMessages();
    for (const id of [young, later, claimed]) {
      expect(await sendQueue.getJob(id)).toBeUndefined();
    }
  });
});

describe('claimMessage', () => {
  it('lets exactly one of two concurrent workers take a message', async () => {
    const id = await insertMessage();
    const claims = await Promise.all([claimMessage(id), claimMessage(id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('does not send a message that is no longer queued', async () => {
    const id = await insertMessage({ status: 'sent', payload: null });
    const job = { data: { messageId: id, tenantId }, attemptsMade: 0, opts: { attempts: 5 } };
    // A mailer is never reached: without a claim the processor returns first.
    await processSendJob(job as never);
    const [row] = await getDb().select().from(messages).where(eq(messages.id, id));
    expect(row!.status).toBe('sent');
  });
});

describe('requeueStrandedDeliveries', () => {
  it('enqueues the next attempt of an overdue pending delivery', async () => {
    const [webhook] = await getDb()
      .insert(webhooks)
      .values({ tenantId, url: 'https://example.test/hook', secret: 'whsec_x', events: ['email.sent'] })
      .returning();
    const [delivery] = await getDb()
      .insert(webhookDeliveries)
      .values({
        webhookId: webhook!.id,
        eventId: crypto.randomUUID(),
        status: 'pending',
        attempts: 2,
        nextAttemptAt: minutesAgo(5),
        eventType: 'email.sent',
        payload: { type: 'email.sent' },
      })
      .returning();

    // The test database outlives a run, so earlier rows may be swept too.
    expect(await requeueStrandedDeliveries()).toBeGreaterThanOrEqual(1);
    expect(await webhookQueue.getJob(deliveryJobId(delivery!.id, 3))).toBeDefined();
    expect(await requeueStrandedDeliveries()).toBe(0);
  });
});
