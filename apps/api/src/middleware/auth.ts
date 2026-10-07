import { createMiddleware } from 'hono/factory';
import bcrypt from 'bcrypt';
import { eq, and, isNull, apiKeys, tenants } from '@postly/db';
import { getDb } from '../lib/db.js';
import { ApiError } from '../lib/errors.js';
import { API_KEY_PREFIX_LENGTH } from '../lib/api-keys.js';

export type AuthContext = {
  tenantId: string;
  apiKeyId: string;
  scopes: string[];
};

export type AppEnv = { Variables: { auth: AuthContext } };

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'unauthorized', 'Unauthorized', 'Missing Authorization header');
  }

  const token = header.slice(7);
  if (!token.startsWith('pst_')) {
    throw new ApiError(401, 'unauthorized', 'Unauthorized', 'Invalid API key format');
  }

  const prefix = token.slice(0, API_KEY_PREFIX_LENGTH);
  const db = getDb();

  const candidates = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), isNull(apiKeys.revokedAt)));

  let matched: (typeof candidates)[0] | undefined;
  for (const candidate of candidates) {
    if (await bcrypt.compare(token, candidate.keyHash)) {
      matched = candidate;
      break;
    }
  }

  if (!matched) {
    throw new ApiError(401, 'unauthorized', 'Unauthorized', 'Invalid API key');
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, matched.tenantId));

  // A paused tenant may still read (its messages, its reputation); the send
  // path refuses it (lib/limits.ts). Suspended is locked out entirely.
  if (!tenant || (tenant.status !== 'active' && tenant.status !== 'paused')) {
    throw new ApiError(403, 'forbidden', 'Account suspended', 'Tenant account is not active');
  }

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, matched.id));

  c.set('auth', {
    tenantId: matched.tenantId,
    apiKeyId: matched.id,
    scopes: matched.scopes,
  });

  await next();
});

export function requireScope(scope: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = c.get('auth');
    if (!auth.scopes.includes(scope)) {
      throw new ApiError(403, 'forbidden', 'Forbidden', `API key lacks required scope: ${scope}`);
    }
    await next();
  });
}
