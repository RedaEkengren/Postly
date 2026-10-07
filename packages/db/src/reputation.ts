import { and, eq, gte, sql, type SQL } from 'drizzle-orm';
import type { Database } from './client.js';
import { events } from './schema.js';

/** Outcome counts per tenant since `since`, straight from the events table. */
export async function reputationCounts(db: Database, since: Date, tenantId?: string) {
  const n = (condition: SQL) => sql<number>`(count(*) filter (where ${condition}))::int`;
  return db
    .select({
      tenantId: events.tenantId,
      delivered: n(sql`${events.type} = 'delivered'`),
      bounced: n(sql`${events.type} = 'bounced'`),
      hardBounced: n(sql`${events.type} = 'bounced' and ${events.payload}->>'bounce_type' = 'hard'`),
      complained: n(sql`${events.type} = 'complained'`),
    })
    .from(events)
    .where(and(gte(events.ts, since), tenantId ? eq(events.tenantId, tenantId) : undefined))
    .groupBy(events.tenantId);
}
