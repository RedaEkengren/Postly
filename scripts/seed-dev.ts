import { createDb, tenants, users, tenantMembers, apiKeys, domains, templates, templateVersions } from '@postly/db';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

async function main() {
  const db = createDb(process.env.DATABASE_URL!);

  const API_KEY = 'pst_test_' + crypto.randomBytes(16).toString('base64url');
  const KEY_PREFIX = API_KEY.slice(0, 12);
  const KEY_HASH = await bcrypt.hash(API_KEY, 10);

  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  await db.insert(tenants).values({
    id: tenantId,
    name: 'Dev Tenant',
    plan: 'payg',
    status: 'active',
  });

  await db.insert(users).values({
    id: userId,
    email: 'reda@postly.dev',
    passwordHash: await bcrypt.hash('devpassword', 10),
  });

  await db.insert(tenantMembers).values({
    tenantId,
    userId,
    role: 'owner',
  });

  await db.insert(apiKeys).values({
    tenantId,
    keyHash: KEY_HASH,
    keyPrefix: KEY_PREFIX,
    name: 'Dev API Key',
    scopes: ['emails.send', 'emails.read', 'domains.read', 'domains.write', 'suppressions.read', 'suppressions.write'],
  });

  await db.insert(domains).values({
    tenantId,
    domain: 'example.com',
    region: 'eu-west-1',
    dkimStatus: 'verified',
    spfStatus: 'verified',
    dmarcStatus: 'verified',
    verifiedAt: new Date(),
  });

  const SEED_TEMPLATES = [
    { slug: 'welcome-email', subject: 'Welcome to {{company}}', format: 'mjml', source: '<mjml><mj-body><mj-section><mj-column><mj-text>Welcome, {{name}}!</mj-text></mj-column></mj-section></mj-body></mjml>' },
    { slug: 'password-reset', subject: 'Reset your password', format: 'html', source: '<p>Hi {{name}}, click <a href="{{reset_url}}">here</a> to reset your password.</p>' },
    { slug: 'invoice-receipt', subject: 'Invoice #{{invoice_id}}', format: 'mjml', source: '<mjml><mj-body><mj-section><mj-column><mj-text>Hi {{name}}, your invoice for {{amount}} is attached.</mj-text></mj-column></mj-section></mj-body></mjml>' },
    { slug: 'weekly-digest', subject: 'Your weekly digest', format: 'html', source: '<p>Hi {{name}}, here is your weekly summary.</p>' },
  ];

  for (const t of SEED_TEMPLATES) {
    const tplId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await db.insert(templates).values({
      id: tplId,
      tenantId,
      slug: t.slug,
      currentVersionId: versionId,
    });
    await db.insert(templateVersions).values({
      id: versionId,
      templateId: tplId,
      version: 1,
      format: t.format,
      source: t.source,
      subject: t.subject,
    });
  }

  console.log('Seeded dev data.');
  console.log(`API Key (save this): ${API_KEY}`);
  console.log(`Tenant ID: ${tenantId}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
