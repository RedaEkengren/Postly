import { domainDnsRecords, type DnsConfig } from '@postly/shared';
import { eq, domains } from '@postly/db';
import { env } from '../env.js';
import { getDb } from './db.js';
import { dkimSelector, encryptPrivateKey, generateDkimKeyPair } from './dkim.js';

type Domain = typeof domains.$inferSelect;

export function dnsConfig(): DnsConfig {
  return {
    spfInclude: env.POSTLY_SPF_INCLUDE,
    bounceMx: env.POSTLY_BOUNCE_MX,
    dmarcReportAddress: env.POSTLY_DMARC_REPORTS,
  };
}

export function newDomainKeys(domain: string, returnPath: string) {
  const { publicKey, privateKeyPem } = generateDkimKeyPair();
  return {
    dkimSelector: dkimSelector(),
    dkimPublicKey: publicKey,
    dkimPrivateKeyEncrypted: encryptPrivateKey(privateKeyPem, env.DKIM_ENCRYPTION_KEY),
    returnPathDomain: `${returnPath}.${domain}`,
  };
}

/** Domains created before own delivery have no key yet; they get one the first time they are read. */
export async function withKeys(domain: Domain): Promise<Domain & { dkimSelector: string; dkimPublicKey: string; returnPathDomain: string }> {
  if (domain.dkimSelector && domain.dkimPublicKey && domain.dkimPrivateKeyEncrypted && domain.returnPathDomain) {
    return domain as Domain & { dkimSelector: string; dkimPublicKey: string; returnPathDomain: string };
  }
  const [updated] = await getDb()
    .update(domains)
    .set({ ...newDomainKeys(domain.domain, 'bounces'), dkimStatus: 'pending', verifiedAt: null })
    .where(eq(domains.id, domain.id))
    .returning();
  return updated as Domain & { dkimSelector: string; dkimPublicKey: string; returnPathDomain: string };
}

export function domainResponse(domain: Awaited<ReturnType<typeof withKeys>>) {
  return {
    id: domain.id,
    domain: domain.domain,
    return_path_domain: domain.returnPathDomain,
    dkim_status: domain.dkimStatus,
    spf_status: domain.spfStatus,
    dmarc_status: domain.dmarcStatus,
    dns_records: domainDnsRecords(
      {
        domain: domain.domain,
        dkimSelector: domain.dkimSelector,
        dkimPublicKey: domain.dkimPublicKey,
        returnPathDomain: domain.returnPathDomain,
      },
      dnsConfig(),
    ),
    verified_at: domain.verifiedAt?.toISOString() ?? null,
    created_at: domain.createdAt.toISOString(),
  };
}
