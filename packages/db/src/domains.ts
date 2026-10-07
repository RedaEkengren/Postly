import { eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { domains } from './schema.js';

export type DomainCheck = { dkim: boolean; spf: boolean; returnPath: boolean; dmarc: boolean; verified: boolean };

/**
 * Stores the outcome of a DNS check and reports whether verification changed,
 * so the caller can fire `domain.verified` or `domain.verification_failed`.
 */
export async function recordDomainCheck(db: Database, domain: typeof domains.$inferSelect, check: DomainCheck) {
  const wasVerified = domain.verifiedAt !== null && domain.dkimStatus === 'verified';
  const status = (ok: boolean) => (ok ? 'verified' : 'pending');
  const [updated] = await db
    .update(domains)
    .set({
      dkimStatus: status(check.dkim),
      spfStatus: status(check.spf && check.returnPath),
      dmarcStatus: status(check.dmarc),
      verifiedAt: check.verified ? (domain.verifiedAt ?? new Date()) : null,
    })
    .where(eq(domains.id, domain.id))
    .returning();
  return {
    domain: updated!,
    becameVerified: check.verified && !wasVerified,
    becameUnverified: !check.verified && wasVerified,
  };
}
