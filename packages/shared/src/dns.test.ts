import { describe, expect, it } from 'vitest';
import { checkDomainDns, domainDnsRecords, messageIdFromVerp, verpSender, type DnsResolver } from './dns.js';

const keys = {
  domain: 'bokflow.se',
  dkimSelector: 'postly202609',
  dkimPublicKey: 'MIIBIjANBgkqh',
  returnPathDomain: 'bounces.bokflow.se',
};
const config = { spfInclude: '_spf.postly.eu', bounceMx: 'mx.postly.eu', dmarcReportAddress: 'dmarc@postly.eu' };

function resolver(txt: Record<string, string[][]>, mx: Record<string, string[]> = {}): DnsResolver {
  return {
    resolveTxt: async (name) => {
      if (!txt[name]) throw Object.assign(new Error('ENODATA'), { code: 'ENODATA' });
      return txt[name]!;
    },
    resolveMx: async (name) => (mx[name] ?? []).map((exchange) => ({ exchange, priority: 10 })),
  };
}

const published = resolver(
  {
    'postly202609._domainkey.bokflow.se': [['v=DKIM1; k=rsa; ', 'p=MIIBIjANBgkqh']],
    'bounces.bokflow.se': [['v=spf1 include:_spf.postly.eu -all']],
    '_dmarc.bokflow.se': [['v=DMARC1; p=quarantine']],
  },
  { 'bounces.bokflow.se': ['MX.postly.eu.'] },
);

describe('domainDnsRecords', () => {
  it('asks for DKIM, the return-path MX and SPF, and recommends DMARC', () => {
    const records = domainDnsRecords(keys, config);
    expect(records.map((r) => [r.purpose, r.type, r.name, r.required])).toEqual([
      ['DKIM', 'TXT', 'postly202609._domainkey.bokflow.se', true],
      ['RETURN_PATH', 'MX', 'bounces.bokflow.se', true],
      ['SPF', 'TXT', 'bounces.bokflow.se', true],
      ['DMARC', 'TXT', '_dmarc.bokflow.se', false],
    ]);
    expect(records[0]!.value).toBe('v=DKIM1; k=rsa; p=MIIBIjANBgkqh');
  });
});

describe('checkDomainDns', () => {
  it('verifies when the records are published, joining split TXT strings and ignoring MX case', async () => {
    expect(await checkDomainDns(keys, config, published)).toEqual({
      dkim: true,
      spf: true,
      returnPath: true,
      dmarc: true,
      verified: true,
    });
  });

  it('does not require DMARC', async () => {
    const noDmarc = resolver(
      {
        'postly202609._domainkey.bokflow.se': [['v=DKIM1; k=rsa; p=MIIBIjANBgkqh']],
        'bounces.bokflow.se': [['v=spf1 include:_spf.postly.eu -all']],
      },
      { 'bounces.bokflow.se': ['mx.postly.eu'] },
    );
    expect(await checkDomainDns(keys, config, noDmarc)).toMatchObject({ dmarc: false, verified: true });
  });

  it('fails on a missing or different DKIM key, or a return path pointing elsewhere', async () => {
    const wrongKey = resolver(
      { 'postly202609._domainkey.bokflow.se': [['v=DKIM1; k=rsa; p=OTHER']] },
      { 'bounces.bokflow.se': ['mx.elsewhere.com'] },
    );
    expect(await checkDomainDns(keys, config, wrongKey)).toMatchObject({ dkim: false, returnPath: false, verified: false });
    expect((await checkDomainDns(keys, config, resolver({}))).verified).toBe(false);
  });
});

describe('VERP', () => {
  it('round-trips the message id through the envelope sender', () => {
    const id = '0b7c6f5e-1111-4000-8000-000000000001';
    expect(messageIdFromVerp(verpSender(id, 'bounces.bokflow.se'))).toBe(id);
    expect(messageIdFromVerp('noreply@bokflow.se')).toBeNull();
  });
});
