import crypto from 'node:crypto';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, isNull, apiKeys, desc } from '@postly/db';
import { API_KEY_SCOPES, createApiKeySchema } from '@postly/shared';
import { apiKeyEnvironment, generateApiKey } from '../lib/api-keys.js';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';
import { cursorTimestamp, olderThan, parsePage, toPage } from '../lib/pagination.js';
import { ApiError, notFoundError } from '../lib/errors.js';
import { createRouter, errors, json, jsonBody, page, PageQuery, security, Timestamp } from '../openapi/common.js';
import { env } from '../env.js';

const ApiKey = z
  .object({
    id: z.string(),
    key_prefix: z.string().openapi({ example: 'pst_live_a1b' }),
    name: z.string(),
    scopes: z.array(z.enum(API_KEY_SCOPES)),
    last_used_at: Timestamp.nullable(),
    created_at: Timestamp,
  })
  .openapi('ApiKey');

const CreatedApiKey = z
  .object({
    id: z.string(),
    key: z.string().openapi({ description: 'The full key. Shown once; only its hash is stored.' }),
    key_prefix: z.string(),
    name: z.string(),
    scopes: z.array(z.enum(API_KEY_SCOPES)),
    created_at: Timestamp,
  })
  .openapi('CreatedApiKey');

/**
 * A key can only create keys with scopes it holds itself. Without this, a key
 * limited to `emails.send` could mint a key with every scope.
 */
export function assertScopesHeld(requested: readonly string[], held: readonly string[]) {
  const missing = requested.filter((scope) => !held.includes(scope));
  if (missing.length > 0) {
    throw new ApiError(403, 'forbidden', 'Forbidden', `API key cannot grant scopes it does not hold: ${missing.join(', ')}`);
  }
}

const apiKeyRoutes = createRouter();

apiKeyRoutes.use('*', authMiddleware);

apiKeyRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    operationId: 'createApiKey',
    tags: ['API keys'],
    summary: 'Create an API key',
    description: 'The new key can only hold scopes that the calling key holds.',
    security,
    request: jsonBody(createApiKeySchema),
    responses: { 201: json(CreatedApiKey, 'The key, shown once'), ...errors(400, 401, 403) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    assertScopesHeld(input.scopes, auth.scopes);

    const { rawKey, keyPrefix, keyHash } = await generateApiKey(apiKeyEnvironment(env.NODE_ENV));
    const id = crypto.randomUUID();
    await getDb().insert(apiKeys).values({
      id,
      tenantId: auth.tenantId,
      keyHash,
      keyPrefix,
      name: input.name,
      scopes: input.scopes,
    });

    return c.json(
      { id, key: rawKey, key_prefix: keyPrefix, name: input.name, scopes: input.scopes, created_at: new Date().toISOString() },
      201,
    );
  },
);

apiKeyRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    operationId: 'listApiKeys',
    tags: ['API keys'],
    summary: 'List active API keys',
    security,
    request: { query: PageQuery },
    responses: { 200: json(page(ApiKey, 'ApiKeyPage'), 'A page of keys, newest first'), ...errors(400, 401) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { limit, cursor } = parsePage(c.req.query());

    const rows = await getDb()
      .select({ key: apiKeys, cursorTs: cursorTimestamp(apiKeys.createdAt) })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.tenantId, auth.tenantId),
          isNull(apiKeys.revokedAt),
          cursor ? olderThan(apiKeys.createdAt, apiKeys.id, cursor, 'uuid') : undefined,
        ),
      )
      .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id))
      .limit(limit + 1);

    const result = toPage(rows, limit, (r) => ({ t: r.cursorTs, k: r.key.id }));
    return c.json(
      {
        data: result.data.map(({ key: k }) => ({
          id: k.id,
          key_prefix: k.keyPrefix,
          name: k.name,
          scopes: k.scopes as (typeof API_KEY_SCOPES)[number][],
          last_used_at: k.lastUsedAt?.toISOString() ?? null,
          created_at: k.createdAt.toISOString(),
        })),
        next_cursor: result.next_cursor,
      },
      200,
    );
  },
);

apiKeyRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    operationId: 'revokeApiKey',
    tags: ['API keys'],
    summary: 'Revoke an API key',
    security,
    request: { params: z.object({ id: z.uuid() }) },
    responses: { 204: { description: 'Revoked' }, ...errors(401, 404) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const db = getDb();

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, auth.tenantId)));
    if (!key) throw notFoundError('API key');

    await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
    return c.body(null, 204);
  },
);

export { apiKeyRoutes };
