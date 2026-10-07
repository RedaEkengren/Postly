/**
 * Sender reputation protection (PRD §6.6, Tech Spec §8). On our own IPs one
 * tenant's bad list hurts every tenant, so limits apply before the first
 * customer and pauses happen automatically.
 */

export const SENDING_LIMITS = {
  free: { daily: 100, monthly: 3_000 },
  /** Pay-as-you-go accounts younger than NEW_ACCOUNT_DAYS. */
  newAccount: { daily: 1_000 },
} as const;

export const NEW_ACCOUNT_DAYS = 14;

/** Below this many outcomes in the window, one bounce is noise, not a rate. */
export const MIN_SAMPLE = 100;

export const THRESHOLDS = {
  complaintWarn: 0.001,
  complaintPause: 0.002,
  complaintSuspend: 0.003,
  hardBouncePause: 0.05,
} as const;

export type ReputationCounts = { delivered: number; bounced: number; hardBounced: number; complained: number };

export type ReputationVerdict = {
  action: 'none' | 'warn' | 'pause' | 'suspend';
  complaintRate: number;
  hardBounceRate: number;
  sample: number;
};

/**
 * Complaint rate is per delivered message (as Gmail and Yahoo count it); the
 * hard-bounce rate is per attempted recipient. Soft bounces are about us or
 * the moment and are not counted against the sender.
 */
export function judgeReputation(counts: ReputationCounts): ReputationVerdict {
  const sample = counts.delivered + counts.bounced;
  const complaintRate = counts.delivered > 0 ? counts.complained / counts.delivered : 0;
  const hardBounceRate = sample > 0 ? counts.hardBounced / sample : 0;
  const verdict = { complaintRate, hardBounceRate, sample };

  if (sample < MIN_SAMPLE) return { action: 'none', ...verdict };
  if (complaintRate > THRESHOLDS.complaintSuspend) return { action: 'suspend', ...verdict };
  if (complaintRate > THRESHOLDS.complaintPause || hardBounceRate > THRESHOLDS.hardBouncePause) {
    return { action: 'pause', ...verdict };
  }
  if (complaintRate > THRESHOLDS.complaintWarn) return { action: 'warn', ...verdict };
  return { action: 'none', ...verdict };
}

/** The daily and monthly caps for a tenant, or null where there is none. */
export function sendingLimits(tenant: { plan: string; createdAt: Date }, now = new Date()) {
  if (tenant.plan === 'free') return SENDING_LIMITS.free;
  const ageDays = (now.getTime() - tenant.createdAt.getTime()) / 86_400_000;
  if (ageDays < NEW_ACCOUNT_DAYS) return { daily: SENDING_LIMITS.newAccount.daily, monthly: null };
  return { daily: null, monthly: null };
}
