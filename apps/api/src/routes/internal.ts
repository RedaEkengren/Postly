import crypto from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, domains } from '@postly/db';
import { QUEUE_NAMES } from '@postly/shared';
import { env } from '../env.js';
import { getDb } from '../lib/db.js';
import { decryptPrivateKey } from '../lib/dkim.js';
import { withKeys } from '../lib/domains.js';
import { ApiError, notFoundError } from '../lib/errors.js';
import { getQueue } from '../lib/queue.js';
import { withTimeout } from '../lib/with-timeout.js';

/**
 * Endpoints KumoMTA calls: DKIM keys for signing, and delivery log records.
 * Not part of the public API and not in the OpenAPI document. Production
 * serves them on the private network only (nginx does not proxy /internal)
 * and they also require INTERNAL_TOKEN.
 */
const internalRoutes = new Hono();

internalRoutes.use('*', async (c, next) => {
  const presented = Buffer.from(c.req.header('authorization')?.replace(/^Bearer /, '') ?? '');
  const expected = Buffer.from(env.INTERNAL_TOKEN);
  if (presented.length !== expected.length || !crypto.timingSafeEqual(presented, expected)) {
    throw new ApiError(401, 'unauthorized', 'Unauthorized', 'Internal endpoint');
  }
  await next();
});

internalRoutes.get('/dkim/:tenantId/:domain', async (c) => {
  const tenantId = z.uuid().safeParse(c.req.param('tenantId'));
  if (!tenantId.success) throw notFoundError('Domain');
  const [row] = await getDb()
    .select()
    .from(domains)
    .where(and(eq(domains.tenantId, tenantId.data), eq(domains.domain, c.req.param('domain').toLowerCase())));
  if (!row) throw notFoundError('Domain');

  const domain = await withKeys(row);
  return c.json({
    domain: domain.domain,
    selector: domain.dkimSelector,
    private_key: decryptPrivateKey(domain.dkimPrivateKeyEncrypted!, env.DKIM_ENCRYPTION_KEY),
  });
});

/** The fields of a KumoMTA log record the event worker reads; the rest is kept but not relied on. */
export const kumoLogRecordSchema = z.looseObject({
  type: z.string(),
  id: z.string(),
  sender: z.string(),
  recipient: z.union([z.string(), z.array(z.string())]),
  response: z.looseObject({ code: z.number(), content: z.string() }).optional(),
  bounce_classification: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number().optional(),
  event_time: z.string().optional(),
});

internalRoutes.post('/kumo/events', async (c) => {
  const body: unknown = await c.req.json();
  const records = z.array(kumoLogRecordSchema).parse(Array.isArray(body) ? body : [body]);

  // Deterministic ids: KumoMTA retries a batch it thinks failed, and BullMQ
  // ignores an id it already holds, so a retry does not double-count.
  const jobs = records.map((record) => ({
    name: record.type,
    data: record,
    opts: { jobId: crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex') },
  }));
  try {
    await withTimeout(getQueue(QUEUE_NAMES.event).addBulk(jobs), 5_000);
  } catch {
    // KumoMTA's hook turns a non-2xx into a retry, so nothing is lost.
    throw new ApiError(503, 'unavailable', 'Unavailable', 'Could not queue delivery events');
  }
  return c.json({ accepted: records.length });
});

export { internalRoutes };
