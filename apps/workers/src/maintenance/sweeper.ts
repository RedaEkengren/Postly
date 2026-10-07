import { Queue, type Job } from 'bullmq';
import {
  and,
  eq,
  isNull,
  lt,
  lte,
  or,
  idempotencyKeys,
  messages,
  sessions,
  webhookDeliveries,
} from '@postly/db';
import { CLAIM_TTL_MS, QUEUE_NAMES, SEND_JOB_OPTIONS, deliveryJobId } from '@postly/shared';
import { getDb } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';
import { enqueueDelivery, getWebhookQueue } from '../webhook/dispatcher.js';

/** Younger than this, a missing job is more likely in flight than lost. */
const GRACE_MS = 2 * 60 * 1000;
const BATCH = 500;

let sendQueue: Queue | undefined;
function getSendQueue(): Queue {
  sendQueue ??= new Queue(QUEUE_NAMES.send, { connection: getRedis() });
  return sendQueue;
}

/**
 * Whether a job needs (re)adding. BullMQ ignores `add` for an id it still
 * holds, so a failed or completed job must be removed first.
 */
export async function needsEnqueue(job: Job | undefined): Promise<boolean> {
  if (!job) return true;
  const state = await job.getState();
  if (state === 'failed' || state === 'completed' || state === 'unknown') {
    await job.remove();
    return true;
  }
  return false;
}

/** Messages still `queued` whose job is gone: Redis was lost, or the API's enqueue failed. */
export async function requeueStrandedMessages(now = new Date()): Promise<number> {
  const stranded = await getDb()
    .select({ id: messages.id, tenantId: messages.tenantId })
    .from(messages)
    .where(
      and(
        eq(messages.status, 'queued'),
        lt(messages.createdAt, new Date(now.getTime() - GRACE_MS)),
        or(isNull(messages.scheduledAt), lte(messages.scheduledAt, now)),
        or(isNull(messages.claimedAt), lt(messages.claimedAt, new Date(now.getTime() - CLAIM_TTL_MS))),
      ),
    )
    .limit(BATCH);

  let requeued = 0;
  for (const message of stranded) {
    if (!(await needsEnqueue(await getSendQueue().getJob(message.id)))) continue;
    await getSendQueue().add(
      'send',
      { messageId: message.id, tenantId: message.tenantId },
      { ...SEND_JOB_OPTIONS, jobId: message.id },
    );
    requeued++;
  }
  return requeued;
}

/** Pending webhook deliveries whose next attempt is overdue and not queued. */
export async function requeueStrandedDeliveries(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - GRACE_MS);
  const stranded = await getDb()
    .select({ id: webhookDeliveries.id, attempts: webhookDeliveries.attempts })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, 'pending'),
        or(
          lt(webhookDeliveries.nextAttemptAt, cutoff),
          and(isNull(webhookDeliveries.nextAttemptAt), lt(webhookDeliveries.createdAt, cutoff)),
        ),
      ),
    )
    .limit(BATCH);

  let requeued = 0;
  for (const delivery of stranded) {
    const attempt = delivery.attempts + 1;
    const job = await getWebhookQueue().getJob(deliveryJobId(delivery.id, attempt));
    if (!(await needsEnqueue(job))) continue;
    await enqueueDelivery(delivery.id, attempt);
    requeued++;
  }
  return requeued;
}

/** Expired idempotency keys (30-day retention, ADR-013) and dashboard sessions. */
export async function deleteExpired(now = new Date()) {
  const db = getDb();
  const keys = await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, now))
    .returning({ key: idempotencyKeys.key });
  const expiredSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  return { idempotencyKeys: keys.length, sessions: expiredSessions.length };
}
