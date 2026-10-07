import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, isNull, lt, or, messages, events } from '@postly/db';
import { CLAIM_TTL_MS, QUEUE_NAMES, batchEmailSchema, sendEmailSchema } from '@postly/shared';
import { authMiddleware, requireScope } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';
import { hashRequestBody } from '../lib/idempotency.js';
import { ApiError, notFoundError } from '../lib/errors.js';
import { getQueue, getSendQueue } from '../lib/queue.js';
import { withTimeout } from '../lib/with-timeout.js';
import { cursorTimestamp, olderThan, parsePage, toPage } from '../lib/pagination.js';
import { acceptSend, enqueueSends, type Accepted } from '../lib/send-email.js';

import {
  createRouter,
  errors,
  IdempotencyHeaders,
  json,
  jsonBody,
  page,
  PageQuery,
  security,
  Timestamp,
} from '../openapi/common.js';

const Queued = z
  .object({
    id: z.string(),
    status: z.literal('queued'),
    to: z.array(z.string()),
    subject: z.string(),
    created_at: Timestamp,
  })
  .openapi('QueuedEmail');

const EmailSummary = z
  .object({
    id: z.string(),
    status: z.string().openapi({ example: 'delivered' }),
    to: z.array(z.string()),
    subject: z.string(),
    created_at: Timestamp,
  })
  .openapi('EmailSummary');

const EmailEvent = z
  .object({ type: z.string(), ts: Timestamp, payload: z.unknown() })
  .openapi('EmailEvent');

const Email = z
  .object({
    id: z.string(),
    tenant_id: z.string(),
    status: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string(),
    tags: z.unknown(),
    created_at: Timestamp,
    sent_at: Timestamp.nullable(),
    events: z.array(EmailEvent),
  })
  .openapi('Email');

/**
 * Best effort on Redis: the status already says canceled, so a job that
 * survives is skipped by the worker's claim. The webhook goes through the
 * workers, which own dispatch.
 */
async function afterCancel(message: typeof messages.$inferSelect, event: typeof events.$inferSelect) {
  await withTimeout(
    (async () => {
      await (await getSendQueue().getJob(message.id))?.remove();
      await getQueue(QUEUE_NAMES.maintenance).add('dispatch-webhook', {
        tenantId: message.tenantId,
        eventId: event.id,
        eventType: 'email.canceled',
        payload: {
          id: event.id,
          type: 'email.canceled',
          created_at: event.ts.toISOString(),
          data: { message_id: message.id, to: message.toAddrs, from: message.fromAddr, subject: message.subject },
        },
      });
    })(),
    3_000,
  ).catch((err: Error) => console.error(`After-cancel work failed for ${message.id}: ${err.name}`));
}

const emailRoutes = createRouter();

emailRoutes.use('*', authMiddleware);

emailRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    operationId: 'sendEmail',
    tags: ['Emails'],
    summary: 'Send an email',
    description:
      'Accepted emails are stored before the response and delivered asynchronously. With `Idempotency-Key`, a retry with the same body returns the first response.',
    security,
    middleware: [requireScope('emails.send')] as const,
    request: { headers: IdempotencyHeaders, ...jsonBody(sendEmailSchema) },
    responses: { 202: json(Queued, 'Queued for delivery'), ...errors(400, 401, 403, 404, 409, 422) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const key = c.req.header('idempotency-key');
    // Hash the body as sent, before defaults are applied, so a retry matches.
    const idempotency = key ? { key, requestHash: hashRequestBody(await c.req.json()) } : null;

    const accepted = await acceptSend(getDb(), auth.tenantId, input, idempotency);
    await enqueueSends(auth.tenantId, [accepted]);
    return c.json(accepted.response, 202);
  },
);

const BatchResult = z
  .union([
    z.object({ index: z.number().int(), status: z.literal('queued'), id: z.string() }),
    z.object({
      index: z.number().int(),
      status: z.literal('rejected'),
      error: z.object({ type: z.string(), title: z.string(), detail: z.string() }),
    }),
  ])
  .openapi('BatchResult');

emailRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/batch',
    operationId: 'sendEmailBatch',
    tags: ['Emails'],
    summary: 'Send up to 500 emails in one request',
    description:
      'Each message is accepted or rejected on its own; one bad message does not fail the rest. A message may carry its own `idempotency_key`.',
    security,
    middleware: [requireScope('emails.send')] as const,
    request: jsonBody(batchEmailSchema),
    responses: {
      202: json(z.object({ results: z.array(BatchResult) }).openapi('BatchResponse'), 'One result per message, in order'),
      ...errors(400, 401, 403),
    },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { messages: items } = c.req.valid('json');
    const raw = ((await c.req.json()) as { messages: unknown[] }).messages;
    const db = getDb();

    const results: z.infer<typeof BatchResult>[] = [];
    const accepted: Accepted[] = [];
    // TODO(reda): sequential is simple and fine for now; parallelise per domain if 500-message batches get slow.
    for (const [index, { idempotency_key, ...input }] of items.entries()) {
      try {
        const idempotency = idempotency_key ? { key: idempotency_key, requestHash: hashRequestBody(raw[index]) } : null;
        const result = await acceptSend(db, auth.tenantId, input, idempotency);
        accepted.push(result);
        results.push({ index, status: 'queued', id: result.response.id });
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        results.push({ index, status: 'rejected', error: { type: err.type, title: err.title, detail: err.detail } });
      }
    }

    await enqueueSends(auth.tenantId, accepted);
    return c.json({ results }, 202);
  },
);

emailRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    operationId: 'cancelEmail',
    tags: ['Emails'],
    summary: 'Cancel an email that has not been handed to delivery',
    description:
      'Typically a scheduled email. Its status becomes `canceled` and `email.canceled` fires. Once a worker has taken it, the answer is 409 `not_cancelable`.',
    security,
    middleware: [requireScope('emails.send')] as const,
    request: { params: z.object({ id: z.uuid() }) },
    responses: { 204: { description: 'Canceled' }, ...errors(400, 401, 403, 404, 409) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const db = getDb();

    // Atomic with the worker's claim: whichever sets its column first wins.
    const [canceled] = await db
      .update(messages)
      .set({ status: 'canceled', payload: null })
      .where(
        and(
          eq(messages.id, id),
          eq(messages.tenantId, auth.tenantId),
          eq(messages.status, 'queued'),
          or(isNull(messages.claimedAt), lt(messages.claimedAt, new Date(Date.now() - CLAIM_TTL_MS))),
        ),
      )
      .returning();
    if (!canceled) {
      const [existing] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, id), eq(messages.tenantId, auth.tenantId)));
      if (!existing) throw notFoundError('Message');
      throw new ApiError(409, 'not_cancelable', 'Not cancelable', 'The message has already been handed to delivery');
    }

    const [event] = await db
      .insert(events)
      .values({ messageId: id, tenantId: auth.tenantId, type: 'canceled', ts: new Date() })
      .returning();
    await afterCancel(canceled, event!);
    return c.body(null, 204);
  },
);

emailRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    operationId: 'getEmail',
    tags: ['Emails'],
    summary: 'Get an email and its events',
    security,
    middleware: [requireScope('emails.read')] as const,
    request: { params: z.object({ id: z.uuid() }) },
    responses: { 200: json(Email, 'The email'), ...errors(400, 401, 403, 404) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const db = getDb();

    const [message] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.tenantId, auth.tenantId)));
    if (!message) throw notFoundError('Message');

    const messageEvents = await db.select().from(events).where(eq(events.messageId, id)).orderBy(events.ts);

    return c.json(
      {
        id: message.id,
        tenant_id: message.tenantId,
        status: message.status,
        from: message.fromAddr,
        to: message.toAddrs,
        subject: message.subject,
        tags: message.tags,
        created_at: message.createdAt.toISOString(),
        sent_at: message.sentAt?.toISOString() ?? null,
        events: messageEvents.map((e) => ({ type: e.type, ts: e.ts.toISOString(), payload: e.payload })),
      },
      200,
    );
  },
);

emailRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    operationId: 'listEmails',
    tags: ['Emails'],
    summary: 'List emails',
    security,
    middleware: [requireScope('emails.read')] as const,
    request: { query: PageQuery },
    responses: { 200: json(page(EmailSummary, 'EmailPage'), 'A page of emails, newest first'), ...errors(400, 401, 403) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { limit, cursor } = parsePage(c.req.query());

    const rows = await getDb()
      .select({
        id: messages.id,
        status: messages.status,
        toAddrs: messages.toAddrs,
        subject: messages.subject,
        createdAt: messages.createdAt,
        cursorTs: cursorTimestamp(messages.createdAt),
      })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, auth.tenantId),
          cursor ? olderThan(messages.createdAt, messages.id, cursor, 'uuid') : undefined,
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);

    const result = toPage(rows, limit, (m) => ({ t: m.cursorTs, k: m.id }));
    return c.json(
      {
        data: result.data.map((m) => ({
          id: m.id,
          status: m.status,
          to: m.toAddrs,
          subject: m.subject,
          created_at: m.createdAt.toISOString(),
        })),
        next_cursor: result.next_cursor,
      },
      200,
    );
  },
);

export { emailRoutes };
