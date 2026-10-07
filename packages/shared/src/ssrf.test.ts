import { describe, expect, it } from 'vitest';
import { isPrivateAddress, publicOnlyLookup } from './ssrf.js';

describe('isPrivateAddress', () => {
  it('refuses loopback, private, link-local and metadata addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const ip of ['1.1.1.1', '93.184.216.34', '172.32.0.1', '2a00:1450:4001:80b::200e']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('treats anything that is not an IP as private', () => {
    expect(isPrivateAddress('localhost')).toBe(true);
  });
});

describe('publicOnlyLookup', () => {
  it('refuses a hostname that resolves to loopback', async () => {
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) =>
      publicOnlyLookup('localhost', {}, (err) => resolve(err)),
    );
    expect(error?.code).toBe('EPRIVATEADDRESS');
  });
});
