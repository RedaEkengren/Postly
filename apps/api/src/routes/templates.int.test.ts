import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, messages } from '@postly/db';
import { app } from '../app.js';
import { getDb } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';
import { getSendQueue } from '../lib/queue.js';
import { createTenant } from '../test/fixtures.js';

let tenant: Awaited<ReturnType<typeof createTenant>>;
const slug = `welcome-${crypto.randomUUID().slice(0, 8)}`;

function call(method: string, path: string, body?: object) {
  return app.request(path, {
    method,
    headers: { Authorization: `Bearer ${tenant.apiKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  tenant = await createTenant();
  const res = await call('POST', '/v1/templates', {
    slug,
    format: 'mjml',
    source: '<mjml><mj-body><mj-section><mj-column><mj-text>Hi {{first_name}}</mj-text></mj-column></mj-section></mj-body></mjml>',
    subject: 'Welcome, {{first_name}}',
    vars_schema: { type: 'object', required: ['first_name'], properties: { first_name: { type: 'string' } } },
  });
  expect(res.status).toBe(201);
});

afterAll(async () => {
  await getSendQueue().obliterate({ force: true });
  await getRedis().quit();
});

describe('templates', () => {
  it('previews exactly what a send would contain', async () => {
    const res = await call('POST', `/v1/templates/${slug}/preview`, { variables: { first_name: 'Anna' } });
    expect(res.status).toBe(200);
    const preview = (await res.json()) as { subject: string; html: string; text: string };
    expect(preview.subject).toBe('Welcome, Anna');
    expect(preview.html).toContain('Hi Anna');
    expect(preview.text).toContain('Hi Anna');
  });

  it('sends a template: the stored message has the rendered content and the resolved version', async () => {
    const res = await call('POST', '/v1/emails', {
      from: `hello@${tenant.domain}`,
      to: ['anna@example.com'],
      template: { slug, variables: { first_name: 'Anna' } },
    });
    expect(res.status).toBe(202);
    const { id, subject } = (await res.json()) as { id: string; subject: string };
    expect(subject).toBe('Welcome, Anna');

    const [row] = await getDb().select().from(messages).where(eq(messages.id, id));
    expect(row!.templateVersion).toBe(1);
    expect((row!.payload as { html: string }).html).toContain('Hi Anna');
    expect((row!.payload as { text: string }).text).toContain('Hi Anna');
  });

  it('refuses variables that do not match vars_schema with 422', async () => {
    const res = await call('POST', '/v1/emails', {
      from: `hello@${tenant.domain}`,
      to: ['anna@example.com'],
      template: { slug, variables: {} },
    });
    expect(res.status).toBe(422);
  });

  it('refuses an unknown template with 404', async () => {
    const res = await call('POST', '/v1/emails', {
      from: `hello@${tenant.domain}`,
      to: ['anna@example.com'],
      template: { slug: 'does-not-exist' },
    });
    expect(res.status).toBe(404);
  });

  it('numbers concurrent new versions consecutively instead of failing', async () => {
    const version = { format: 'html', source: '<p>v</p>', subject: 's' };
    const responses = await Promise.all(Array.from({ length: 4 }, () => call('POST', `/v1/templates/${slug}/versions`, version)));
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    const numbers = await Promise.all(responses.map(async (r) => ((await r.json()) as { version: number }).version));
    expect(numbers.sort()).toEqual([2, 3, 4, 5]);
  });

  it('refuses a second template with the same slug with 409', async () => {
    const res = await call('POST', '/v1/templates', { slug, format: 'html', source: '<p/>', subject: 's' });
    expect(res.status).toBe(409);
  });
});
