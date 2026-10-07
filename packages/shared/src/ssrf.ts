import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { BlockList, isIP } from 'node:net';

/**
 * Webhook URLs are chosen by customers and fetched from inside Postly's
 * network, where the API's /internal endpoints and KumoMTA's admin API
 * listen. Private, loopback, link-local and other reserved ranges are refused.
 */
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv6');
}

// An IPv4-mapped IPv6 address (::ffff:a.b.c.d) is judged by its IPv4 part.
// It is not a BlockList subnet: Node's BlockList treats ::ffff:0:0/96 as
// matching every IPv4 address, which would refuse all of them.
const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export function isPrivateAddress(ip: string): boolean {
  const mapped = IPV4_MAPPED.exec(ip)?.[1];
  if (mapped) return isPrivateAddress(mapped);
  const family = isIP(ip);
  if (family === 0) return true;
  return BLOCKED.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * Drop-in `lookup` for http.request: resolves, then refuses if any address is
 * private. Checking at connect time, not before, leaves no window for a DNS
 * answer to change between the check and the connection.
 */
export function publicOnlyLookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const blocked = addresses.find((a) => isPrivateAddress(a.address));
    if (blocked) {
      const error: NodeJS.ErrnoException = new Error(`Refusing to connect to ${hostname}: resolves to a private address`);
      error.code = 'EPRIVATEADDRESS';
      return callback(error, []);
    }
    if (options.all) return callback(null, addresses);
    const [first] = addresses;
    return callback(null, first!.address, first!.family);
  });
}
