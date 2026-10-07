import crypto from 'node:crypto';
import { apiKeys, domains, tenants } from '@postly/db';
import { getDb } from '../lib/db.js';
import { generateApiKey } from '../lib/api-keys.js';

/** A fresh tenant with a verified domain and a key that can send and read. */
export async function createTenant() {
  const db = getDb();
  const [tenant] = await db.insert(tenants).values({ name: `test-${crypto.randomUUID()}` }).returning();
  const domain = `${crypto.randomUUID().slice(0, 8)}.test`;
  const [row] = await db
    .insert(domains)
    .values({ tenantId: tenant!.id, domain, dkimStatus: 'verified', spfStatus: 'verified', dmarcStatus: 'verified' })
    .returning();
  const key = await generateApiKey('test');
  await db.insert(apiKeys).values({
    tenantId: tenant!.id,
    keyHash: key.keyHash,
    keyPrefix: key.keyPrefix,
    name: 'integration',
    scopes: ['emails.send', 'emails.read', 'suppressions.read', 'suppressions.write', 'templates.read', 'templates.write', 'webhooks.read', 'webhooks.write'],
  });
  return { tenantId: tenant!.id, domainId: row!.id, domain, apiKey: key.rawKey };
}
