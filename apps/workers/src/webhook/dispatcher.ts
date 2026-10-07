import crypto from 'node:crypto';
import { Queue } from 'bullmq';
import { eq, and, webhooks, webhookDeliveries } from '@postly/db';
import { QUEUE_NAMES } from '@postly/shared';
import { getDb } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';
import { DELIVERY_JOB_OPTIONS, deliveryJobId } from './schedule.js';

let webhookQueue: Queue;

export function getWebhookQueue(): Queue {
  if (!webhookQueue) {
    webhookQueue = new Queue(QUEUE_NAMES.webhook, { connection: getRedis() });
  }
  return webhookQueue;
}

export async function enqueueDelivery(deliveryId: string, attempt: number, delay = 0) {
  await getWebhookQueue().add(
    'deliver',
    { deliveryId },
    { ...DELIVERY_JOB_OPTIONS, delay, jobId: deliveryJobId(deliveryId, attempt) },
  );
}

export async function dispatchWebhooks(
  tenantId: string,
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const db = getDb();

  const matchingWebhooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.tenantId, tenantId), eq(webhooks.active, true)));

  for (const webhook of matchingWebhooks) {
    if (!webhook.events.includes(eventType)) continue;

    const deliveryId = crypto.randomUUID();
    await db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId: webhook.id,
      eventId,
      eventType,
      payload,
      status: 'pending',
      attempts: 0,
    });

    try {
      await enqueueDelivery(deliveryId, 1);
    } catch (err) {
      console.error(`Enqueue failed for delivery ${deliveryId}, the sweeper will retry: ${(err as Error).name}`);
    }
  }
}
