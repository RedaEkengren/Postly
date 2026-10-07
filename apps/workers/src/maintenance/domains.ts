import crypto from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { and, isNotNull, isNull, domains, recordDomainCheck } from '@postly/db';
import { checkDomainDns, type DnsConfig } from '@postly/shared';
import { getDb } from '../lib/db.js';
import { env } from '../lib/env.js';
import { dispatchWebhooks } from '../webhook/dispatcher.js';

export type DomainEvent = { tenantId: string; domain: string; event: 'domain.verified' | 'domain.verification_failed' };

export async function dispatchDomainEvent({ tenantId, domain, event }: DomainEvent) {
  const id = crypto.randomUUID();
  await dispatchWebhooks(tenantId, id, event, {
    id,
    type: event,
    created_at: new Date().toISOString(),
    data: { domain },
  });
}

function dnsConfig(): DnsConfig {
  return { spfInclude: env.POSTLY_SPF_INCLUDE, bounceMx: env.POSTLY_BOUNCE_MX, dmarcReportAddress: env.POSTLY_DMARC_REPORTS };
}

/**
 * Checks every domain still waiting for verification. Customers add DNS
 * records at their own pace; this is what notices.
 * TODO(reda): re-check verified domains every 6 hours (PRD §6.2) once there is a last-checked column.
 */
export async function verifyPendingDomains(resolver = new Resolver({ timeout: 5_000, tries: 2 })) {
  const pending = await getDb()
    .select()
    .from(domains)
    .where(and(isNull(domains.verifiedAt), isNotNull(domains.dkimPublicKey)))
    .limit(200);

  let verified = 0;
  for (const domain of pending) {
    const check = await checkDomainDns(
      {
        domain: domain.domain,
        dkimSelector: domain.dkimSelector!,
        dkimPublicKey: domain.dkimPublicKey!,
        returnPathDomain: domain.returnPathDomain!,
      },
      dnsConfig(),
      resolver,
    );
    const result = await recordDomainCheck(getDb(), domain, check);
    if (result.becameVerified) {
      verified++;
      await dispatchDomainEvent({ tenantId: domain.tenantId, domain: domain.domain, event: 'domain.verified' });
    }
  }
  return { checked: pending.length, verified };
}
