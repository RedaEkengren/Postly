import crypto from 'node:crypto';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, gte, inArray, ne, or, webhooks, webhookDeliveries, desc } from '@postly/db';
import { QUEUE_NAMES, createWebhookSchema, deliveryJobId, isPrivateAddress } from '@postly/shared';
import { isIP } from 'node:net';
import { authMiddleware, requireScope } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';
import { getQueue } from '../lib/queue.js';
import { withTimeout } from '../lib/with-timeout.js';
import { cursorTimestamp, olderThan, parsePage, toPage } from '../lib/pagination.js';
import { ApiError, notFoundError } from '../lib/errors.js';
import { createRouter, errors, json, jsonBody, page, PageQuery, security, Timestamp } from '../openapi/common.js';

const Webhook = z
  .object({
    id: z.string(),
    url: z.string(),
    events: z.array(z.string()).openapi({ example: ['email.delivered', 'email.bounced'] }),
    active: z.boolean(),
    created_at: Timestamp,
  })
  .openapi('Webhook');

const CreatedWebhook = Webhook.extend({
  secret: z.string().openapi({ description: 'HMAC-SHA256 signing secret. Shown once.' }),
}).openapi('CreatedWebhook');

const IdParam = z.object({ id: z.uuid() });

/**
 * Early, friendly refusal of URLs that obviously point inside a network. The
 * real guard is at delivery time (publicOnlyLookup in the webhook worker),
 * because a hostname can resolve anywhere later.
 */
function assertPublicWebhookUrl(url: string) {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || (isIP(host) !== 0 && isPrivateAddress(host))) {
    throw new ApiError(400, 'validation_error', 'Validation error', 'Webhook URL must be publicly reachable');
  }
}

const toWebhook = (w: typeof webhooks.$inferSelect) => ({
  id: w.id,
  url: w.url,
  events: w.events,
  active: w.active,
  created_at: w.createdAt.toISOString(),
});

async function findWebhook(tenantId: string, id: string) {
  const [webhook] = await getDb()
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, tenantId)));
  if (!webhook) throw notFoundError('Webhook');
  return webhook;
}

const webhookRoutes = createRouter();

webhookRoutes.use('*', authMiddleware);

webhookRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    operationId: 'createWebhook',
    tags: ['Webhooks'],
    summary: 'Register a webhook endpoint',
    security,
    middleware: [requireScope('webhooks.write')] as const,
    request: jsonBody(createWebhookSchema),
    responses: { 201: json(CreatedWebhook, 'The endpoint and its secret, shown once'), ...errors(400, 401, 403) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    assertPublicWebhookUrl(input.url);
    const id = crypto.randomUUID();
    const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;

    const [webhook] = await getDb()
      .insert(webhooks)
      .values({ id, tenantId: auth.tenantId, url: input.url, secret, events: input.events })
      .returning();
    return c.json({ ...toWebhook(webhook!), secret }, 201);
  },
);

webhookRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    operationId: 'listWebhooks',
    tags: ['Webhooks'],
    summary: 'List webhook endpoints',
    security,
    middleware: [requireScope('webhooks.read')] as const,
    request: { query: PageQuery },
    responses: { 200: json(page(Webhook, 'WebhookPage'), 'A page of endpoints, newest first'), ...errors(400, 401, 403) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { limit, cursor } = parsePage(c.req.query());

    const rows = await getDb()
      .select({ webhook: webhooks, cursorTs: cursorTimestamp(webhooks.createdAt) })
      .from(webhooks)
      .where(
        and(
          eq(webhooks.tenantId, auth.tenantId),
          cursor ? olderThan(webhooks.createdAt, webhooks.id, cursor, 'uuid') : undefined,
        ),
      )
      .orderBy(desc(webhooks.createdAt), desc(webhooks.id))
      .limit(limit + 1);

    const result = toPage(rows, limit, (r) => ({ t: r.cursorTs, k: r.webhook.id }));
    return c.json({ data: result.data.map((r) => toWebhook(r.webhook)), next_cursor: result.next_cursor }, 200);
  },
);

webhookRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    operationId: 'getWebhook',
    tags: ['Webhooks'],
    summary: 'Get a webhook endpoint',
    security,
    middleware: [requireScope('webhooks.read')] as const,
    request: { params: IdParam },
    responses: { 200: json(Webhook, 'The endpoint'), ...errors(400, 401, 403, 404) },
  }),
  async (c) => {
    const webhook = await findWebhook(c.get('auth').tenantId, c.req.valid('param').id);
    return c.json(toWebhook(webhook), 200);
  },
);

webhookRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    operationId: 'deleteWebhook',
    tags: ['Webhooks'],
    summary: 'Delete a webhook endpoint',
    security,
    middleware: [requireScope('webhooks.write')] as const,
    request: { params: IdParam },
    responses: { 204: { description: 'Deleted' }, ...errors(400, 401, 403, 404) },
  }),
  async (c) => {
    const webhook = await findWebhook(c.get('auth').tenantId, c.req.valid('param').id);
    await getDb().delete(webhooks).where(eq(webhooks.id, webhook.id));
    return c.body(null, 204);
  },
);

const ReplayRequest = z
  .object({
    after: z.iso.datetime().optional().openapi({ description: 'Redeliver failed deliveries created at or after this time' }),
    event_ids: z.array(z.uuid()).max(1000).optional().openapi({ description: 'Redeliver these events, whatever their status' }),
  })
  .refine((r) => r.after || r.event_ids?.length, { message: 'Give after, event_ids, or both' })
  .openapi('WebhookReplayRequest');

webhookRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/{id}/replay',
    operationId: 'replayWebhook',
    tags: ['Webhooks'],
    summary: 'Redeliver events to an endpoint',
    description:
      'For an endpoint that was down: redelivers its failed deliveries since `after`, or exactly the listed `event_ids`. Each redelivery is signed again with a fresh timestamp. At most 1,000 per call.',
    security,
    middleware: [requireScope('webhooks.write')] as const,
    request: { params: IdParam, ...jsonBody(ReplayRequest) },
    responses: {
      202: json(z.object({ replayed: z.number().int() }).openapi('WebhookReplayResult'), 'Queued for redelivery'),
      ...errors(400, 401, 403, 404),
    },
  }),
  async (c) => {
    const webhook = await findWebhook(c.get('auth').tenantId, c.req.valid('param').id);
    const { after, event_ids: eventIds } = c.req.valid('json');

    const rows = await getDb()
      .update(webhookDeliveries)
      .set({ status: 'pending', nextAttemptAt: null })
      .where(
        and(
          eq(webhookDeliveries.webhookId, webhook.id),
          or(
            after ? and(eq(webhookDeliveries.status, 'failed'), gte(webhookDeliveries.createdAt, new Date(after))) : undefined,
            eventIds?.length ? inArray(webhookDeliveries.eventId, eventIds) : undefined,
          ),
          // A delivery still being retried is already on its way.
          ne(webhookDeliveries.status, 'pending'),
        ),
      )
      .returning({ id: webhookDeliveries.id, attempts: webhookDeliveries.attempts });

    // One more attempt each, numbered after the ones already made. If Redis
    // is down, the sweeper finds the pending rows.
    await withTimeout(
      getQueue(QUEUE_NAMES.webhook).addBulk(
        rows.map((row) => ({
          name: 'deliver',
          data: { deliveryId: row.id },
          opts: { jobId: deliveryJobId(row.id, row.attempts + 1), removeOnComplete: { age: 86_400 } },
        })),
      ),
      5_000,
    ).catch((err: Error) => console.error(`Replay enqueue failed, the sweeper will retry: ${err.name}`));

    return c.json({ replayed: rows.length }, 202);
  },
);

export { webhookRoutes };
