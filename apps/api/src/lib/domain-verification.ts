import { Resolver } from 'node:dns/promises';
import { recordDomainCheck, type domains } from '@postly/db';
import { QUEUE_NAMES, checkDomainDns, type DnsCheck } from '@postly/shared';
import { env } from '../env.js';
import { getDb } from './db.js';
import { dnsConfig, type withKeys } from './domains.js';
import { getQueue } from './queue.js';
import { withTimeout } from './with-timeout.js';

type KeyedDomain = Awaited<ReturnType<typeof withKeys>>;

function resolver() {
  // A short timeout: this runs inside an API request.
  return new Resolver({ timeout: 3_000, tries: 2 });
}

/** In development there is no public DNS for test domains, so verification is simulated. */
async function lookup(domain: KeyedDomain): Promise<DnsCheck> {
  if (env.NODE_ENV === 'development') {
    return { dkim: true, spf: true, returnPath: true, dmarc: true, verified: true };
  }
  return checkDomainDns(
    {
      domain: domain.domain,
      dkimSelector: domain.dkimSelector,
      dkimPublicKey: domain.dkimPublicKey,
      returnPathDomain: domain.returnPathDomain,
    },
    dnsConfig(),
    resolver(),
  );
}

/**
 * Checks the domain's DNS now and stores the result. A change in
 * verification is handed to the workers, which own webhook dispatch.
 */
export async function verifyDomainNow(domain: KeyedDomain) {
  const check = await lookup(domain);
  const result = await recordDomainCheck(getDb(), domain as typeof domains.$inferSelect, check);
  const event = result.becameVerified ? 'domain.verified' : result.becameUnverified ? 'domain.verification_failed' : null;
  if (event) {
    await withTimeout(
      getQueue(QUEUE_NAMES.maintenance).add('domain-event', {
        tenantId: domain.tenantId,
        domain: domain.domain,
        event,
      }),
      2_000,
    ).catch((err: Error) => console.error(`Could not enqueue ${event} for a domain: ${err.name}`));
  }
  return { domain: result.domain, check };
}
