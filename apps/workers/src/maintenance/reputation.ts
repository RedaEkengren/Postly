import { and, eq, inArray, auditLog, reputationCounts, tenants } from '@postly/db';
import { judgeReputation, type ReputationVerdict } from '@postly/shared';
import { getDb } from '../lib/db.js';
import { env } from '../lib/env.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Stops mail that KumoMTA already holds for the tenant. Best effort: the
 * status change already stops new sends, and the suspension expires on its
 * own so a manual un-pause is not undone by a forgotten KumoMTA state.
 */
async function suspendInMta(tenantId: string, reason: string) {
  try {
    const res = await fetch(`${env.KUMO_HTTP_URL}/api/admin/suspend/v1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: tenantId, reason, duration: '24h' }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.error(`KumoMTA suspend for a tenant answered ${res.status}`);
  } catch (err) {
    console.error(`KumoMTA suspend failed: ${(err as Error).name}`);
  }
}

async function applyVerdict(tenantId: string, status: 'paused' | 'suspended', verdict: ReputationVerdict) {
  const db = getDb();
  const from = status === 'suspended' ? ['active', 'paused'] : ['active'];
  const [changed] = await db
    .update(tenants)
    .set({ status })
    .where(and(eq(tenants.id, tenantId), inArray(tenants.status, from)))
    .returning({ id: tenants.id });
  if (!changed) return false;

  const metadata = {
    complaint_rate: verdict.complaintRate,
    hard_bounce_rate: verdict.hardBounceRate,
    sample: verdict.sample,
  };
  await db.insert(auditLog).values({ tenantId, action: `tenant.auto_${status}`, resourceType: 'tenant', resourceId: tenantId, metadata });
  await suspendInMta(tenantId, `postly auto-${status}: ${JSON.stringify(metadata)}`);
  console.warn(`Tenant ${tenantId} ${status}: complaint ${(verdict.complaintRate * 100).toFixed(2)}%, hard bounce ${(verdict.hardBounceRate * 100).toFixed(2)}% of ${verdict.sample}`);
  return true;
}

/**
 * Every 15 minutes: pause or suspend tenants whose last 24 hours cross the
 * thresholds in @postly/shared (Tech Spec §8). Un-pausing is a human decision.
 * TODO(reda): warnings are only logged until there is an alert channel (Slack/email).
 */
export async function reviewReputation(now = new Date()) {
  const rows = await reputationCounts(getDb(), new Date(now.getTime() - WINDOW_MS));
  const changed: string[] = [];
  for (const { tenantId, ...counts } of rows) {
    const verdict = judgeReputation(counts);
    if (verdict.action === 'warn') {
      console.warn(`Tenant ${tenantId} complaint rate ${(verdict.complaintRate * 100).toFixed(2)}% (warning threshold)`);
    } else if (verdict.action === 'pause' || verdict.action === 'suspend') {
      const status = verdict.action === 'pause' ? 'paused' : 'suspended';
      if (await applyVerdict(tenantId, status, verdict)) changed.push(tenantId);
    }
  }
  return { reviewed: rows.length, changed };
}
