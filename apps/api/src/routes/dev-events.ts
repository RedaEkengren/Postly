import crypto from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { QUEUE_NAMES } from '@postly/shared';
import { getQueue } from '../lib/queue.js';

/**
 * Development only (mounted when NODE_ENV=development): feeds the event worker
 * a KumoMTA log record without a real delivery, e.g. to try a bounce.
 */
const devEventRoutes = new Hono();

const simulateEventSchema = z.object({
  message_id: z.uuid(),
  type: z.enum(['Delivery', 'Bounce', 'TransientFailure', 'Expiration', 'OOB', 'Feedback']),
  recipient: z.email(),
  response: z.object({ code: z.number().int(), content: z.string() }).optional(),
  bounce_classification: z.string().optional(),
});

devEventRoutes.post('/simulate-event', async (c) => {
  const input = simulateEventSchema.parse(await c.req.json());
  const record = {
    type: input.type,
    id: `dev-${crypto.randomUUID()}`,
    sender: `b-${input.message_id}@dev.invalid`,
    recipient: input.recipient,
    response: input.response ?? { code: input.type === 'Delivery' ? 250 : 550, content: 'simulated' },
    bounce_classification: input.bounce_classification ?? (input.type === 'Bounce' ? 'InvalidRecipient' : 'Uncategorized'),
    meta: { x_postly_message_id: input.message_id },
    timestamp: Math.floor(Date.now() / 1000),
  };
  const jobId = crypto.randomUUID();
  await getQueue(QUEUE_NAMES.event).add(input.type, record, { jobId });
  return c.json({ queued: true, job_id: jobId, record });
});

export { devEventRoutes };
