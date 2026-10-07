import { and, count, eq, gte, ne, messages, tenants } from '@postly/db';
import { sendingLimits } from '@postly/shared';
import type { getDb } from './db.js';
import { ApiError } from './errors.js';

type Db = ReturnType<typeof getDb>;

function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function sentSince(db: Db, tenantId: string, since: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), gte(messages.createdAt, since), ne(messages.status, 'canceled')));
  return row?.n ?? 0;
}

/**
 * A paused tenant can read but not send; the plan's daily and monthly caps
 * apply per UTC day and month. Counted from messages, so a batch that crosses
 * the cap is cut off message by message.
 */
export async function assertCanSend(db: Db, tenantId: string, now = new Date()) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (tenant?.status === 'paused') {
    throw new ApiError(
      403,
      'tenant_paused',
      'Sending paused',
      'Sending is paused because bounce or complaint rates crossed a threshold. Contact support.',
    );
  }
  if (!tenant) return;

  const limits = sendingLimits(tenant, now);
  if (limits.daily !== null && (await sentSince(db, tenantId, startOfUtcDay(now))) >= limits.daily) {
    throw new ApiError(422, 'quota_exceeded', 'Quota exceeded', `Daily limit of ${limits.daily} emails reached; it resets at 00:00 UTC`);
  }
  if (limits.monthly !== null && (await sentSince(db, tenantId, startOfUtcMonth(now))) >= limits.monthly) {
    throw new ApiError(422, 'quota_exceeded', 'Quota exceeded', `Monthly limit of ${limits.monthly} emails reached`);
  }
}
