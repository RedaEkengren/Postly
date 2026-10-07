import crypto from 'node:crypto';
import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, domains } from '@postly/db';
import { createDomainSchema } from '@postly/shared';
import { authMiddleware, requireScope } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';
import { cursorTimestamp, olderThan, parsePage, toPage } from '../lib/pagination.js';
import { ApiError, notFoundError } from '../lib/errors.js';
import { domainResponse, newDomainKeys, withKeys } from '../lib/domains.js';
import { verifyDomainNow } from '../lib/domain-verification.js';
import { createRouter, errors, json, jsonBody, page, PageQuery, security, Timestamp } from '../openapi/common.js';

const Status = z.enum(['pending', 'verified']);

const DnsRecord = z
  .object({
    type: z.enum(['TXT', 'MX']),
    name: z.string(),
    value: z.string(),
    purpose: z.enum(['DKIM', 'RETURN_PATH', 'SPF', 'DMARC']),
    required: z.boolean().openapi({ description: 'DMARC is recommended; the others are needed to send' }),
  })
  .openapi('DnsRecord');

const DomainSummary = z
  .object({
    id: z.string(),
    domain: z.string(),
    return_path_domain: z.string(),
    dkim_status: Status,
    spf_status: Status,
    dmarc_status: Status,
    verified_at: Timestamp.nullable(),
    created_at: Timestamp,
  })
  .openapi('DomainSummary');

const Domain = DomainSummary.extend({ dns_records: z.array(DnsRecord) }).openapi('Domain');

const DomainParam = z.object({ domain: z.string().toLowerCase().openapi({ example: 'bokflow.se' }) });

type DomainBody = z.infer<typeof Domain>;
const asResponse = (domain: Awaited<ReturnType<typeof withKeys>>) => domainResponse(domain) as DomainBody;

async function findDomain(tenantId: string, name: string) {
  const [domain] = await getDb()
    .select()
    .from(domains)
    .where(and(eq(domains.tenantId, tenantId), eq(domains.domain, name)));
  if (!domain) throw notFoundError(`Domain '${name}'`);
  return withKeys(domain);
}

const domainRoutes = createRouter();

domainRoutes.use('*', authMiddleware);

domainRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    operationId: 'createDomain',
    tags: ['Domains'],
    summary: 'Add a sending domain',
    description:
      'Postly generates a 2048-bit DKIM key for the domain and returns the DNS records to publish. Only the public key leaves Postly.',
    security,
    middleware: [requireScope('domains.write')] as const,
    request: jsonBody(createDomainSchema),
    responses: { 201: json(Domain, 'The domain and the DNS records to publish'), ...errors(400, 401, 403, 409) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');

    const [created] = await getDb()
      .insert(domains)
      .values({ id: crypto.randomUUID(), tenantId: auth.tenantId, domain: input.domain, ...newDomainKeys(input.domain, input.return_path) })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      throw new ApiError(409, 'domain_already_exists', 'Domain already exists', `Domain '${input.domain}' is already registered`);
    }
    return c.json(asResponse(await withKeys(created)), 201);
  },
);

domainRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{domain}',
    operationId: 'getDomain',
    tags: ['Domains'],
    summary: 'Get a domain, its verification status and its DNS records',
    security,
    middleware: [requireScope('domains.read')] as const,
    request: { params: DomainParam },
    responses: { 200: json(Domain, 'The domain'), ...errors(401, 403, 404) },
  }),
  async (c) => {
    const domain = await findDomain(c.get('auth').tenantId, c.req.valid('param').domain);
    return c.json(asResponse(domain), 200);
  },
);

domainRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/{domain}/verify',
    operationId: 'verifyDomain',
    tags: ['Domains'],
    summary: 'Check the DNS records now',
    description: 'Pending domains are also checked every 5 minutes. A change fires `domain.verified` or `domain.verification_failed`.',
    security,
    middleware: [requireScope('domains.write')] as const,
    request: { params: DomainParam },
    responses: { 200: json(Domain, 'The domain after the check'), ...errors(401, 403, 404) },
  }),
  async (c) => {
    const domain = await findDomain(c.get('auth').tenantId, c.req.valid('param').domain);
    const { domain: checked } = await verifyDomainNow(domain);
    return c.json(asResponse(await withKeys(checked)), 200);
  },
);

domainRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    operationId: 'listDomains',
    tags: ['Domains'],
    summary: 'List domains',
    security,
    middleware: [requireScope('domains.read')] as const,
    request: { query: PageQuery },
    responses: { 200: json(page(DomainSummary, 'DomainPage'), 'A page of domains, newest first'), ...errors(400, 401, 403) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { limit, cursor } = parsePage(c.req.query());

    const rows = await getDb()
      .select({ domain: domains, cursorTs: cursorTimestamp(domains.createdAt) })
      .from(domains)
      .where(
        and(
          eq(domains.tenantId, auth.tenantId),
          cursor ? olderThan(domains.createdAt, domains.id, cursor, 'uuid') : undefined,
        ),
      )
      .orderBy(desc(domains.createdAt), desc(domains.id))
      .limit(limit + 1);

    const result = toPage(rows, limit, (r) => ({ t: r.cursorTs, k: r.domain.id }));
    const data = await Promise.all(
      result.data.map(async ({ domain }) => {
        const { dns_records: _records, ...summary } = asResponse(await withKeys(domain));
        return summary;
      }),
    );
    return c.json({ data, next_cursor: result.next_cursor }, 200);
  },
);

domainRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{domain}',
    operationId: 'deleteDomain',
    tags: ['Domains'],
    summary: 'Delete a domain and its DKIM key',
    security,
    middleware: [requireScope('domains.write')] as const,
    request: { params: DomainParam },
    responses: { 204: { description: 'Deleted' }, ...errors(401, 403, 404) },
  }),
  async (c) => {
    const domain = await findDomain(c.get('auth').tenantId, c.req.valid('param').domain);
    await getDb().delete(domains).where(eq(domains.id, domain.id));
    return c.body(null, 204);
  },
);

export { domainRoutes };
