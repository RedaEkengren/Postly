import { Queue, type Job } from 'bullmq';
import { QUEUE_NAMES } from '@postly/shared';
import type Redis from 'ioredis';
import { deleteExpired, requeueStrandedDeliveries, requeueStrandedMessages } from './sweeper.js';
import { dispatchDomainEvent, verifyPendingDomains, type DomainEvent } from './domains.js';
import { dispatchWebhooks } from '../webhook/dispatcher.js';
import { reviewReputation } from './reputation.js';

export const MAINTENANCE_JOBS = {
  sweep: { every: 60_000 },
  cleanup: { every: 60 * 60_000 },
  'verify-domains': { every: 5 * 60_000 },
  reputation: { every: 15 * 60_000 },
} as const;

/** Registers the repeating jobs. Idempotent: upsert replaces an existing schedule. */
export async function scheduleMaintenance(connection: Redis) {
  const queue = new Queue(QUEUE_NAMES.maintenance, { connection });
  for (const [name, repeat] of Object.entries(MAINTENANCE_JOBS)) {
    await queue.upsertJobScheduler(name, repeat, {
      name,
      opts: { removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
    });
  }
  await queue.close();
}

export async function processMaintenanceJob(job: Job) {
  if (job.name === 'sweep') {
    const [messages, deliveries] = await Promise.all([requeueStrandedMessages(), requeueStrandedDeliveries()]);
    if (messages || deliveries) {
      console.log(`Sweeper re-enqueued ${messages} messages and ${deliveries} webhook deliveries`);
    }
    return { messages, deliveries };
  }
  if (job.name === 'cleanup') {
    return deleteExpired();
  }
  if (job.name === 'reputation') {
    return reviewReputation();
  }
  if (job.name === 'verify-domains') {
    return verifyPendingDomains();
  }
  // Enqueued by the API for events it creates (e.g. email.canceled); webhook
  // dispatch lives in the workers.
  if (job.name === 'dispatch-webhook') {
    const { tenantId, eventId, eventType, payload } = job.data as {
      tenantId: string;
      eventId: string;
      eventType: string;
      payload: Record<string, unknown>;
    };
    return dispatchWebhooks(tenantId, eventId, eventType, payload);
  }
  // Enqueued by the API when a manual check changes a domain's verification.
  if (job.name === 'domain-event') {
    return dispatchDomainEvent(job.data as DomainEvent);
  }
  throw new Error(`Unknown maintenance job: ${job.name}`);
}
