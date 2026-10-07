/** Where Postly's own sending infrastructure answers. Set per environment (see .env.example). */
export type DnsConfig = {
  /** Domain whose SPF record lists Postly's sending IPs, e.g. `_spf.postly.eu`. */
  spfInclude: string;
  /** Host that receives asynchronous bounces and feedback reports, e.g. `mx.postly.eu`. */
  bounceMx: string;
  /** Mailbox for DMARC aggregate reports in the recommended record. */
  dmarcReportAddress: string;
};

export type DomainKeys = {
  domain: string;
  dkimSelector: string;
  /** Base64 of the DER-encoded SubjectPublicKeyInfo, as it appears after `p=`. */
  dkimPublicKey: string;
  returnPathDomain: string;
};

export type DnsRecord = {
  type: 'TXT' | 'MX';
  name: string;
  value: string;
  purpose: 'DKIM' | 'RETURN_PATH' | 'SPF' | 'DMARC';
  required: boolean;
};

export function dkimRecordName(keys: Pick<DomainKeys, 'domain' | 'dkimSelector'>): string {
  return `${keys.dkimSelector}._domainkey.${keys.domain}`;
}

/** The records a customer publishes to send through Postly. */
export function domainDnsRecords(keys: DomainKeys, config: DnsConfig): DnsRecord[] {
  return [
    {
      type: 'TXT',
      name: dkimRecordName(keys),
      value: `v=DKIM1; k=rsa; p=${keys.dkimPublicKey}`,
      purpose: 'DKIM',
      required: true,
    },
    { type: 'MX', name: keys.returnPathDomain, value: `10 ${config.bounceMx}`, purpose: 'RETURN_PATH', required: true },
    {
      type: 'TXT',
      name: keys.returnPathDomain,
      value: `v=spf1 include:${config.spfInclude} -all`,
      purpose: 'SPF',
      required: true,
    },
    {
      type: 'TXT',
      name: `_dmarc.${keys.domain}`,
      value: `v=DMARC1; p=none; rua=mailto:${config.dmarcReportAddress}`,
      purpose: 'DMARC',
      required: false,
    },
  ];
}

/** The subset of node:dns/promises the check needs, so tests can pass a fake. */
export type DnsResolver = {
  resolveTxt(name: string): Promise<string[][]>;
  resolveMx(name: string): Promise<{ exchange: string; priority: number }[]>;
};

export type DnsCheck = { dkim: boolean; spf: boolean; returnPath: boolean; dmarc: boolean; verified: boolean };

// A TXT record can be split into several strings; they are one value.
async function txtRecords(resolver: DnsResolver, name: string): Promise<string[]> {
  try {
    return (await resolver.resolveTxt(name)).map((chunks) => chunks.join(''));
  } catch {
    return [];
  }
}

const normaliseHost = (host: string) => host.toLowerCase().replace(/\.$/, '');

/**
 * Looks the records up as the world sees them. A domain is verified when DKIM,
 * the return-path MX and its SPF are in place; DMARC is recommended only.
 */
export async function checkDomainDns(keys: DomainKeys, config: DnsConfig, resolver: DnsResolver): Promise<DnsCheck> {
  const [dkimTxt, returnPathTxt, dmarcTxt, mx] = await Promise.all([
    txtRecords(resolver, dkimRecordName(keys)),
    txtRecords(resolver, keys.returnPathDomain),
    txtRecords(resolver, `_dmarc.${keys.domain}`),
    resolver.resolveMx(keys.returnPathDomain).catch(() => []),
  ]);

  const dkim = dkimTxt.some((value) => value.replace(/\s+/g, '').includes(`p=${keys.dkimPublicKey}`));
  const spf = returnPathTxt.some((value) => value.startsWith('v=spf1') && value.includes(`include:${config.spfInclude}`));
  const returnPath = mx.some((record) => normaliseHost(record.exchange) === normaliseHost(config.bounceMx));
  const dmarc = dmarcTxt.some((value) => value.startsWith('v=DMARC1'));

  return { dkim, spf, returnPath, dmarc, verified: dkim && spf && returnPath };
}

/** VERP envelope sender: the message id rides in the local part so an asynchronous bounce finds its message. */
export function verpSender(messageId: string, returnPathDomain: string): string {
  return `b-${messageId}@${returnPathDomain}`;
}

const VERP = /^b-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i;

export function messageIdFromVerp(address: string): string | null {
  return VERP.exec(address)?.[1]?.toLowerCase() ?? null;
}
