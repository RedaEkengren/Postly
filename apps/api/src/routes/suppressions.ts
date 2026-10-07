import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, suppressions, desc } from '@postly/db';
import { SUPPRESSION_REASONS, createSuppressionSchema } from '@postly/shared';
import { authMiddleware, requireScope } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';
import { cursorTimestamp, olderThan, parsePage, toPage } from '../lib/pagination.js';
import { notFoundError } from '../lib/errors.js';
import { createRouter, errors, json, jsonBody, page, PageQuery, security, Timestamp } from '../openapi/common.js';

const Suppression = z
  .object({
    address: z.string(),
    reason: z.string().openapi({ example: 'bounce' }),
    source_message_id: z.string().nullable(),
    created_at: Timestamp,
  })
  .openapi('Suppression');

const suppressionRoutes = createRouter();

suppressionRoutes.use('*', authMiddleware);

suppressionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    operationId: 'listSuppressions',
    tags: ['Suppressions'],
    summary: 'List suppressed addresses',
    security,
    middleware: [requireScope('suppressions.read')] as const,
    request: { query: PageQuery.extend({ reason: z.enum(SUPPRESSION_REASONS).optional() }) },
    responses: {
      200: json(page(Suppression, 'SuppressionPage'), 'A page of suppressions, newest first'),
      ...errors(400, 401, 403),
    },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { limit, cursor } = parsePage(c.req.query());
    const { reason } = c.req.valid('query');

    const rows = await getDb()
      .select({ suppression: suppressions, cursorTs: cursorTimestamp(suppressions.createdAt) })
      .from(suppressions)
      .where(
        and(
          eq(suppressions.tenantId, auth.tenantId),
          reason ? eq(suppressions.reason, reason) : undefined,
          cursor ? olderThan(suppressions.createdAt, suppressions.address, cursor, 'citext') : undefined,
        ),
      )
      .orderBy(desc(suppressions.createdAt), desc(suppressions.address))
      .limit(limit + 1);

    const result = toPage(rows, limit, (r) => ({ t: r.cursorTs, k: r.suppression.address }));
    return c.json(
      {
        data: result.data.map(({ suppression: s }) => ({
          address: s.address,
          reason: s.reason,
          source_message_id: s.sourceMessageId,
          created_at: s.createdAt.toISOString(),
        })),
        next_cursor: result.next_cursor,
      },
      200,
    );
  },
);

suppressionRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    operationId: 'createSuppression',
    tags: ['Suppressions'],
    summary: 'Suppress an address',
    description: 'Adding an address that is already suppressed is not an error.',
    security,
    middleware: [requireScope('suppressions.write')] as const,
    request: jsonBody(createSuppressionSchema),
    responses: {
      201: json(Suppression.omit({ source_message_id: true }), 'Suppressed'),
      ...errors(400, 401, 403),
    },
  }),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    await getDb()
      .insert(suppressions)
      .values({ tenantId: auth.tenantId, address: input.address, reason: input.reason })
      .onConflictDoNothing();
    return c.json({ address: input.address, reason: input.reason, created_at: new Date().toISOString() }, 201);
  },
);

suppressionRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{address}',
    operationId: 'deleteSuppression',
    tags: ['Suppressions'],
    summary: 'Remove an address from the suppression list',
    security,
    middleware: [requireScope('suppressions.write')] as const,
    request: { params: z.object({ address: z.string().openapi({ description: 'URL-encoded address' }) }) },
    responses: { 204: { description: 'Removed' }, ...errors(401, 403, 404) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const address = decodeURIComponent(c.req.valid('param').address);
    const match = and(eq(suppressions.tenantId, auth.tenantId), eq(suppressions.address, address));

    const [existing] = await getDb().select().from(suppressions).where(match);
    if (!existing) throw notFoundError(`Suppression for '${address}'`);
    await getDb().delete(suppressions).where(match);
    return c.body(null, 204);
  },
);

export { suppressionRoutes };
