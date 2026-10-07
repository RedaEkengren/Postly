import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  boolean,
  integer,
  jsonb,
  inet,
  primaryKey,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'),
  creditBalance: bigint('credit_balance', { mode: 'number' }).notNull().default(0),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: citext('email').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenantMembers = pgTable(
  'tenant_members',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.userId] })],
);

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  name: text('name').notNull(),
  scopes: text('scopes').array().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  index('api_keys_tenant_created_id_idx').on(table.tenantId, table.createdAt, table.id),
]);

export const domains = pgTable(
  'domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    dkimStatus: text('dkim_status').notNull().default('pending'),
    spfStatus: text('spf_status').notNull().default('pending'),
    dmarcStatus: text('dmarc_status').notNull().default('pending'),
    // Nullable only for domains created before own delivery; the API
    // generates a key the first time such a domain is read.
    dkimSelector: text('dkim_selector'),
    dkimPublicKey: text('dkim_public_key'),
    dkimPrivateKeyEncrypted: bytea('dkim_private_key_encrypted'),
    returnPathDomain: text('return_path_domain'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('domains_tenant_domain_idx').on(table.tenantId, table.domain),
    index('domains_tenant_created_id_idx').on(table.tenantId, table.createdAt, table.id),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => domains.id),
    fromAddr: text('from_addr').notNull(),
    toAddrs: text('to_addrs').array().notNull(),
    ccAddrs: text('cc_addrs').array(),
    bccAddrs: text('bcc_addrs').array(),
    subject: text('subject').notNull(),
    tags: jsonb('tags').default({}),
    mtaQueueId: text('mta_queue_id'),
    status: text('status').notNull(),
    idempotencyKey: text('idempotency_key'),
    templateSlug: text('template_slug'),
    templateVersion: integer('template_version'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    // The send request, kept only until the message reaches a terminal status.
    // Postgres, not the Redis job, is what a lost queue is rebuilt from.
    payload: jsonb('payload'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('messages_tenant_created_id_idx').on(table.tenantId, table.createdAt, table.id),
    index('messages_queued_created_idx')
      .on(table.createdAt)
      .where(sql`${table.status} = 'queued'`),
    index('messages_idempotency_idx').on(table.idempotencyKey),
    index('messages_mta_queue_id_idx').on(table.mtaQueueId),
  ],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id),
    tenantId: uuid('tenant_id').notNull(),
    type: text('type').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    payload: jsonb('payload'),
  },
  (table) => [
    index('events_message_id_idx').on(table.messageId),
    index('events_tenant_ts_idx').on(table.tenantId, table.ts),
    // The reputation review reads every tenant's last 24 hours.
    index('events_ts_idx').on(table.ts),
  ],
);

export const suppressions = pgTable(
  'suppressions',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    address: citext('address').notNull(),
    reason: text('reason').notNull(),
    sourceMessageId: uuid('source_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.address] }),
    index('suppressions_tenant_created_address_idx').on(table.tenantId, table.createdAt, table.address),
  ],
);

export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    currentVersionId: uuid('current_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('templates_tenant_slug_idx').on(table.tenantId, table.slug),
    index('templates_tenant_created_id_idx').on(table.tenantId, table.createdAt, table.id),
  ],
);

export const templateVersions = pgTable(
  'template_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    format: text('format').notNull(),
    source: text('source').notNull(),
    // HTML ready for variable substitution: MJML compiled once at creation,
    // HTML and pre-compiled React Email stored as given. Null only on versions
    // created before rendering existed; those compile on first use.
    compiledHtml: text('compiled_html'),
    varsSchema: jsonb('vars_schema'),
    subject: text('subject').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('template_versions_tmpl_ver_idx').on(table.templateId, table.version)],
);

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events').array().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('webhooks_tenant_created_id_idx').on(table.tenantId, table.createdAt, table.id),
]);

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: uuid('webhook_id')
    .notNull()
    .references(() => webhooks.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull(),
  status: text('status').notNull(),
  attempts: integer('attempts').notNull().default(0),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  eventType: text('event_type'),
  // The signed body, so a delivery can be retried after the queue is lost.
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('webhook_deliveries_status_next_idx').on(table.status, table.nextAttemptAt),
]);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    tenantId: uuid('tenant_id').notNull(),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body').notNull(),
    messageId: uuid('message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.key] }),
    index('idempotency_keys_expires_idx').on(table.expiresAt),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_idx').on(table.expiresAt),
  ],
);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
});
