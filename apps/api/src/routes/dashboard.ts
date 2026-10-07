import { Hono } from 'hono';
import crypto from 'node:crypto';
import { apiKeyEnvironment, generateApiKey } from '../lib/api-keys.js';
import { getCookie, deleteCookie } from 'hono/cookie';
import {
  eq, and, gt, desc, sql, isNull,
  sessions, users, tenants, tenantMembers,
  messages, domains, apiKeys, webhooks, suppressions,
  templates, events,
  reputationCounts,
} from '@postly/db';
import {
  THRESHOLDS,
  judgeReputation,
  createDomainSchema,
  createApiKeySchema,
  createWebhookSchema,
  createSuppressionSchema,
  createTemplateSchema,
} from '@postly/shared';
import { getDb } from '../lib/db.js';
import { domainResponse, newDomainKeys, withKeys } from '../lib/domains.js';
import { verifyDomainNow } from '../lib/domain-verification.js';
import { addVersion, createTemplate } from '../lib/templates.js';
import { ApiError } from '../lib/errors.js';
import { env } from '../env.js';

type SessionContext = {
  userId: string;
  tenantId: string;
  email: string;
  tenantName: string;
  role: string;
};

const dashboard = new Hono<{ Variables: { session: SessionContext } }>();

dashboard.use('*', async (c, next) => {
  const sessionId = getCookie(c, 'postly_session');
  if (!sessionId) {
    throw new ApiError(401, 'unauthorized', 'Unauthorized', 'Not authenticated');
  }

  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));

  if (!session) {
    deleteCookie(c, 'postly_session', { path: '/' });
    throw new ApiError(401, 'unauthorized', 'Unauthorized', 'Session expired');
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, session.tenantId));
  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(and(eq(tenantMembers.userId, session.userId), eq(tenantMembers.tenantId, session.tenantId)));

  if (!user || !tenant) {
    throw new ApiError(401, 'unauthorized', 'Unauthorized', 'Invalid session');
  }

  c.set('session', {
    userId: user.id,
    tenantId: session.tenantId,
    email: user.email,
    tenantName: tenant.name,
    role: membership?.role ?? 'member',
  });

  await next();
});

dashboard.get('/overview', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    [emailCount],
    [deliveredCount],
    [bounceCount],
    [complaintCount],
    [domainCount],
    [keyCount],
    recentMessages,
    domainRows,
    webhookRows,
    templateRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(messages)
      .where(and(eq(messages.tenantId, tenantId), gt(messages.createdAt, thirtyDaysAgo))),
    db.select({ count: sql<number>`count(*)::int` }).from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.status, 'delivered'), gt(messages.createdAt, thirtyDaysAgo))),
    db.select({ count: sql<number>`count(*)::int` }).from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.status, 'bounced'), gt(messages.createdAt, thirtyDaysAgo))),
    db.select({ count: sql<number>`count(*)::int` }).from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.status, 'complained'), gt(messages.createdAt, thirtyDaysAgo))),
    db.select({ count: sql<number>`count(*)::int` }).from(domains)
      .where(and(eq(domains.tenantId, tenantId), eq(domains.dkimStatus, 'verified'))),
    db.select({ count: sql<number>`count(*)::int` }).from(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt))),
    db.select().from(messages)
      .where(eq(messages.tenantId, tenantId))
      .orderBy(desc(messages.createdAt))
      .limit(10),
    db.select().from(domains)
      .where(eq(domains.tenantId, tenantId))
      .orderBy(desc(domains.createdAt))
      .limit(5),
    db.select().from(webhooks)
      .where(and(eq(webhooks.tenantId, tenantId), eq(webhooks.active, true)))
      .limit(3),
    db.select().from(templates)
      .where(eq(templates.tenantId, tenantId))
      .orderBy(desc(templates.createdAt))
      .limit(4),
  ]);

  const total = emailCount?.count ?? 0;
  const delivered = deliveredCount?.count ?? 0;
  const bounces = bounceCount?.count ?? 0;
  const complaints = complaintCount?.count ?? 0;

  return c.json({
    stats: {
      emailsThisMonth: total,
      deliveryRate: total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 0,
      bounceRate: total > 0 ? Number(((bounces / total) * 100).toFixed(1)) : 0,
      complaintRate: total > 0 ? Number(((complaints / total) * 100).toFixed(1)) : 0,
      activeApiKeys: keyCount?.count ?? 0,
      verifiedDomains: domainCount?.count ?? 0,
    },
    recentMessages: recentMessages.map((m) => ({
      id: m.id,
      to: m.toAddrs,
      from: m.fromAddr,
      subject: m.subject,
      status: m.status,
      sentAt: m.createdAt.getTime(),
    })),
    domains: domainRows.map((d) => ({
      id: d.id,
      domain: d.domain,
      returnPath: d.returnPathDomain,
      dkim: d.dkimStatus,
      spf: d.spfStatus,
      dmarc: d.dmarcStatus,
    })),
    webhooks: webhookRows.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
    })),
    templates: templateRows.map((t) => ({
      slug: t.slug,
    })),
  });
});

dashboard.get('/messages', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
  const offset = Number(c.req.query('offset')) || 0;

  const [rows, [total]] = await Promise.all([
    db.select().from(messages)
      .where(eq(messages.tenantId, tenantId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(messages)
      .where(eq(messages.tenantId, tenantId)),
  ]);

  return c.json({
    data: rows.map((m) => ({
      id: m.id,
      to: m.toAddrs.join(', '),
      from: m.fromAddr,
      subject: m.subject,
      status: m.status,
      tags: m.tags,
      domain: m.fromAddr.split('@')[1],
      sentAt: m.createdAt.getTime(),
    })),
    total: total?.count ?? 0,
    limit,
    offset,
  });
});

dashboard.get('/messages/:id', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();
  const id = c.req.param('id');

  const [msg] = await db.select().from(messages)
    .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)));

  if (!msg) {
    throw new ApiError(404, 'not_found', 'Not found', 'Message not found');
  }

  const msgEvents = await db.select().from(events)
    .where(eq(events.messageId, id))
    .orderBy(desc(events.ts));

  return c.json({
    ...msg,
    to: msg.toAddrs.join(', '),
    sentAt: msg.createdAt.getTime(),
    events: msgEvents.map((e) => ({
      id: e.id,
      type: e.type,
      timestamp: e.ts.getTime(),
      payload: e.payload,
    })),
  });
});

dashboard.get('/domains', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();

  const rows = await db.select().from(domains)
    .where(eq(domains.tenantId, tenantId))
    .orderBy(desc(domains.createdAt));

  return c.json({
    data: rows.map((d) => ({
      id: d.id,
      domain: d.domain,
      returnPath: d.returnPathDomain,
      dkim: d.dkimStatus,
      spf: d.spfStatus,
      dmarc: d.dmarcStatus,
      createdAt: d.createdAt.getTime(),
    })),
  });
});

dashboard.get('/suppressions', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();
  const reason = c.req.query('reason');

  const where = reason && reason !== 'all'
    ? and(eq(suppressions.tenantId, tenantId), eq(suppressions.reason, reason))
    : eq(suppressions.tenantId, tenantId);

  const rows = await db.select().from(suppressions)
    .where(where)
    .orderBy(desc(suppressions.createdAt));

  return c.json({
    data: rows.map((s) => ({
      address: s.address,
      reason: s.reason,
      source: s.sourceMessageId,
      createdAt: s.createdAt.getTime(),
    })),
  });
});

dashboard.get('/api-keys', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();

  const rows = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.tenantId, tenantId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));

  return c.json({
    data: rows.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.keyPrefix,
      scopes: k.scopes,
      lastUsed: k.lastUsedAt?.getTime() ?? null,
      createdAt: k.createdAt.getTime(),
    })),
  });
});

dashboard.get('/webhooks', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();

  const rows = await db.select().from(webhooks)
    .where(eq(webhooks.tenantId, tenantId))
    .orderBy(desc(webhooks.createdAt));

  return c.json({
    data: rows.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: w.createdAt.getTime(),
    })),
  });
});

dashboard.get('/templates', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();

  const rows = await db.select().from(templates)
    .where(eq(templates.tenantId, tenantId))
    .orderBy(desc(templates.createdAt));

  return c.json({
    data: rows.map((t) => ({
      slug: t.slug,
      currentVersionId: t.currentVersionId,
      createdAt: t.createdAt.getTime(),
    })),
  });
});

dashboard.get('/events', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);

  const rows = await db.select().from(events)
    .where(eq(events.tenantId, tenantId))
    .orderBy(desc(events.ts))
    .limit(limit);

  return c.json({
    data: rows.map((e) => ({
      id: e.id,
      messageId: e.messageId,
      type: e.type,
      timestamp: e.ts.getTime(),
      payload: e.payload,
    })),
  });
});

// Sending reputation over the last 24 hours, judged by the same thresholds
// the workers pause on (packages/shared/src/reputation.ts).
dashboard.get('/reputation', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  const [counts] = await reputationCounts(db, new Date(Date.now() - 24 * 3600 * 1000), tenantId);
  const verdict = judgeReputation(counts ?? { delivered: 0, bounced: 0, hardBounced: 0, complained: 0 });
  return c.json({
    status: tenant?.status ?? 'active',
    window: '24h',
    delivered: counts?.delivered ?? 0,
    bounced: counts?.bounced ?? 0,
    hardBounced: counts?.hardBounced ?? 0,
    complained: counts?.complained ?? 0,
    complaintRate: verdict.complaintRate,
    hardBounceRate: verdict.hardBounceRate,
    assessment: verdict.action,
    thresholds: THRESHOLDS,
  });
});

// ── Write endpoints ──────────────────────────────────────────────

dashboard.post('/domains', async (c) => {
  const { tenantId } = c.get('session');
  const input = createDomainSchema.parse(await c.req.json());

  const [created] = await getDb()
    .insert(domains)
    .values({ id: crypto.randomUUID(), tenantId, domain: input.domain, ...newDomainKeys(input.domain, input.return_path) })
    .onConflictDoNothing()
    .returning();
  if (!created) {
    throw new ApiError(409, 'domain_already_exists', 'Domain already exists', `Domain '${input.domain}' is already registered`);
  }
  return c.json(domainResponse(await withKeys(created)), 201);
});

async function findSessionDomain(tenantId: string, name: string) {
  const [domain] = await getDb()
    .select()
    .from(domains)
    .where(and(eq(domains.tenantId, tenantId), eq(domains.domain, name.toLowerCase())));
  if (!domain) throw new ApiError(404, 'not_found', 'Not found', `Domain '${name}' does not exist`);
  return withKeys(domain);
}

dashboard.get('/domains/:domain', async (c) => {
  const domain = await findSessionDomain(c.get('session').tenantId, c.req.param('domain'));
  return c.json(domainResponse(domain));
});

dashboard.post('/domains/:domain/verify', async (c) => {
  const domain = await findSessionDomain(c.get('session').tenantId, c.req.param('domain'));
  const { domain: checked } = await verifyDomainNow(domain);
  return c.json(domainResponse(await withKeys(checked)));
});

dashboard.delete('/domains/:domain', async (c) => {
  const { tenantId } = c.get('session');
  const domainName = c.req.param('domain');
  const db = getDb();

  const [domain] = await db.select().from(domains)
    .where(and(eq(domains.tenantId, tenantId), eq(domains.domain, domainName)));

  if (!domain) {
    throw new ApiError(404, 'not_found', 'Not found', `Domain '${domainName}' does not exist`);
  }

  await db.delete(domains).where(eq(domains.id, domain.id));
  return c.body(null, 204);
});

dashboard.post('/api-keys', async (c) => {
  const { tenantId } = c.get('session');
  const body = await c.req.json();
  const input = createApiKeySchema.parse(body);
  const db = getDb();

  const { rawKey, keyPrefix, keyHash } = await generateApiKey(apiKeyEnvironment(env.NODE_ENV));
  const id = crypto.randomUUID();

  await db.insert(apiKeys).values({
    id,
    tenantId,
    keyHash,
    keyPrefix,
    name: input.name,
    scopes: input.scopes,
  });

  return c.json({
    id,
    key: rawKey,
    key_prefix: keyPrefix,
    name: input.name,
    scopes: input.scopes,
    created_at: new Date().toISOString(),
  }, 201);
});

dashboard.delete('/api-keys/:id', async (c) => {
  const { tenantId } = c.get('session');
  const id = c.req.param('id');
  const db = getDb();

  const [key] = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));

  if (!key) {
    throw new ApiError(404, 'not_found', 'Not found', 'API key does not exist');
  }

  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
  return c.body(null, 204);
});

dashboard.post('/webhooks', async (c) => {
  const { tenantId } = c.get('session');
  const body = await c.req.json();
  const input = createWebhookSchema.parse(body);
  const db = getDb();

  const id = crypto.randomUUID();
  const secret = `whsec_${crypto.randomBytes(24).toString('base64url')}`;

  await db.insert(webhooks).values({
    id,
    tenantId,
    url: input.url,
    secret,
    events: input.events,
  });

  return c.json({
    id,
    url: input.url,
    secret,
    events: input.events,
    active: true,
    created_at: new Date().toISOString(),
  }, 201);
});

dashboard.delete('/webhooks/:id', async (c) => {
  const { tenantId } = c.get('session');
  const id = c.req.param('id');
  const db = getDb();

  const [webhook] = await db.select().from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.tenantId, tenantId)));

  if (!webhook) {
    throw new ApiError(404, 'not_found', 'Not found', 'Webhook does not exist');
  }

  await db.delete(webhooks).where(eq(webhooks.id, id));
  return c.body(null, 204);
});

dashboard.post('/suppressions', async (c) => {
  const { tenantId } = c.get('session');
  const body = await c.req.json();
  const input = createSuppressionSchema.parse(body);
  const db = getDb();

  await db.insert(suppressions).values({
    tenantId,
    address: input.address,
    reason: input.reason,
  }).onConflictDoNothing();

  return c.json({
    address: input.address,
    reason: input.reason,
    created_at: new Date().toISOString(),
  }, 201);
});

dashboard.delete('/suppressions/:address', async (c) => {
  const { tenantId } = c.get('session');
  const address = decodeURIComponent(c.req.param('address'));
  const db = getDb();

  const [existing] = await db.select().from(suppressions)
    .where(and(eq(suppressions.tenantId, tenantId), eq(suppressions.address, address)));

  if (!existing) {
    throw new ApiError(404, 'not_found', 'Not found', `Suppression for '${address}' does not exist`);
  }

  await db.delete(suppressions)
    .where(and(eq(suppressions.tenantId, tenantId), eq(suppressions.address, address)));

  return c.body(null, 204);
});

dashboard.post('/templates', async (c) => {
  const { tenantId } = c.get('session');
  const input = createTemplateSchema.parse(await c.req.json());
  const created = await createTemplate(tenantId, input);
  if (!created) {
    throw new ApiError(409, 'conflict', 'Template slug already exists', `Slug "${input.slug}" is taken`);
  }
  return c.json({
    id: created.template.id,
    slug: created.template.slug,
    current_version: 1,
    format: input.format,
    subject: input.subject,
    created_at: created.template.createdAt.toISOString(),
  }, 201);
});

dashboard.post('/templates/:slug/versions', async (c) => {
  const { tenantId } = c.get('session');
  const input = createTemplateSchema.omit({ slug: true }).parse(await c.req.json());
  const version = await addVersion(tenantId, c.req.param('slug'), input);
  if (!version) throw new ApiError(404, 'not_found', 'Not found', 'Template does not exist');
  return c.json({
    id: version.id,
    template_id: version.templateId,
    version: version.version,
    format: version.format,
    subject: version.subject,
    created_at: version.createdAt.toISOString(),
  }, 201);
});

dashboard.delete('/templates/:slug', async (c) => {
  const { tenantId } = c.get('session');
  const slug = c.req.param('slug');
  const db = getDb();

  const [template] = await db.select().from(templates)
    .where(and(eq(templates.tenantId, tenantId), eq(templates.slug, slug)));

  if (!template) {
    throw new ApiError(404, 'not_found', 'Not found', 'Template does not exist');
  }

  await db.delete(templates).where(eq(templates.id, template.id));
  return c.body(null, 204);
});

dashboard.put('/account', async (c) => {
  const { tenantId } = c.get('session');
  const body = await c.req.json();
  const { name } = body;
  const db = getDb();

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ApiError(400, 'validation', 'Validation error', 'Name is required');
  }

  await db.update(tenants).set({ name: name.trim() }).where(eq(tenants.id, tenantId));
  return c.json({ ok: true, name: name.trim() });
});

dashboard.delete('/account', async (c) => {
  const { tenantId } = c.get('session');
  const db = getDb();

  await db.delete(sessions).where(eq(sessions.tenantId, tenantId));
  await db.delete(events).where(eq(events.tenantId, tenantId));
  await db.delete(messages).where(eq(messages.tenantId, tenantId));
  await db.delete(suppressions).where(eq(suppressions.tenantId, tenantId));
  await db.delete(webhooks).where(eq(webhooks.tenantId, tenantId));
  await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId));
  await db.delete(templates).where(eq(templates.tenantId, tenantId));
  await db.delete(domains).where(eq(domains.tenantId, tenantId));
  await db.delete(tenantMembers).where(eq(tenantMembers.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));

  deleteCookie(c, 'postly_session', { path: '/' });
  return c.body(null, 204);
});

export { dashboard as dashboardRoutes };
