import { Worker } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from '@postly/shared';
import { getRedis } from './lib/redis.js';
import { processSendJob, type SendJobData } from './send/processor.js';
import {
  processWebhookDelivery,
  type WebhookDeliveryJobData,
} from './webhook/processor.js';
import { processEventJob, type EventJobData } from './event/processor.js';
import { recordCompleted, recordFailed, startHeartbeat } from './health/record.js';
import { processMaintenanceJob, scheduleMaintenance } from './maintenance/processor.js';

const connection = getRedis();

const sendWorker = new Worker<SendJobData>(QUEUE_NAMES.send, processSendJob, {
  connection,
  concurrency: 10,
  limiter: { max: 50, duration: 1000 },
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      return Math.min(1000 * 2 ** attemptsMade, 30000);
    },
  },
});

const eventWorker = new Worker<EventJobData>(QUEUE_NAMES.event, processEventJob, {
  connection,
  concurrency: 20,
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      return Math.min(1000 * 2 ** attemptsMade, 60000);
    },
  },
});

// Retries are scheduled by the processor as new delayed jobs (webhook/schedule.ts).
const webhookWorker = new Worker<WebhookDeliveryJobData>(QUEUE_NAMES.webhook, processWebhookDelivery, {
  connection,
  concurrency: 20,
});

const maintenanceWorker = new Worker(QUEUE_NAMES.maintenance, processMaintenanceJob, {
  connection,
  concurrency: 1,
});

function observe(worker: Worker, queue: QueueName, label: string) {
  worker.on('completed', (job) => {
    recordCompleted(connection, queue).catch(() => {});
    if (queue === QUEUE_NAMES.send) console.log(`Send job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    recordFailed(connection, queue, err).catch(() => {});
    if (job) console.error(`${label} job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
  });
  worker.on('error', (err) => {
    console.error(`${label} worker error:`, err.message);
  });
}

observe(sendWorker, QUEUE_NAMES.send, 'Send');
observe(eventWorker, QUEUE_NAMES.event, 'Event');
observe(webhookWorker, QUEUE_NAMES.webhook, 'Webhook');
observe(maintenanceWorker, QUEUE_NAMES.maintenance, 'Maintenance');

scheduleMaintenance(connection).catch((err: Error) => {
  console.error('Scheduling maintenance jobs failed:', err.name);
});

const heartbeat = startHeartbeat(connection);

console.log(`Postly workers started: ${Object.values(QUEUE_NAMES).join(', ')}`);

async function shutdown() {
  console.log('Shutting down workers...');
  clearInterval(heartbeat);
  await Promise.all([sendWorker.close(), eventWorker.close(), webhookWorker.close(), maintenanceWorker.close()]);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
