import { describe, expect, it } from 'vitest';
import { batchEmailSchema, createWebhookSchema, paginationSchema, sendEmailSchema } from './validators.js';
import { BATCH_MAX_SIZE } from './constants.js';

const VALID_EMAIL = { from: 'hello@example.se', to: ['reda@example.se'], subject: 'Hi', text: 'Hej' };

describe('sendEmailSchema', () => {
  it('accepts a minimal message', () => {
    expect(sendEmailSchema.safeParse(VALID_EMAIL).success).toBe(true);
  });

  it('requires at least one valid recipient', () => {
    expect(sendEmailSchema.safeParse({ ...VALID_EMAIL, to: [] }).success).toBe(false);
    expect(sendEmailSchema.safeParse({ ...VALID_EMAIL, to: ['not-an-address'] }).success).toBe(false);
  });

  it('caps the subject at the RFC 5322 line length', () => {
    expect(sendEmailSchema.safeParse({ ...VALID_EMAIL, subject: 'x'.repeat(999) }).success).toBe(false);
  });

  it('lets a template supply subject and body', () => {
    const { subject: _subject, text: _text, ...withoutContent } = VALID_EMAIL;
    expect(sendEmailSchema.safeParse({ ...withoutContent, template: { slug: 'welcome' } }).success).toBe(true);
  });

  it('requires subject and a body when there is no template', () => {
    const { subject: _subject, ...noSubject } = VALID_EMAIL;
    const { text: _text, ...noBody } = VALID_EMAIL;
    expect(sendEmailSchema.safeParse(noSubject).success).toBe(false);
    expect(sendEmailSchema.safeParse(noBody).success).toBe(false);
  });

  it('ignores open/click tracking: Postly does not track', () => {
    const parsed = sendEmailSchema.parse({ ...VALID_EMAIL, tracking: { opens: true } });
    expect(parsed).not.toHaveProperty('tracking');
  });
});

describe('batchEmailSchema', () => {
  it(`allows at most ${BATCH_MAX_SIZE} messages`, () => {
    const messages = (n: number) => Array.from({ length: n }, () => VALID_EMAIL);
    expect(batchEmailSchema.safeParse({ messages: messages(BATCH_MAX_SIZE) }).success).toBe(true);
    expect(batchEmailSchema.safeParse({ messages: messages(BATCH_MAX_SIZE + 1) }).success).toBe(false);
  });
});

describe('createWebhookSchema', () => {
  it('accepts known event types only', () => {
    expect(createWebhookSchema.safeParse({ url: 'https://x.se/hook', events: ['email.delivered'] }).success).toBe(true);
    expect(createWebhookSchema.safeParse({ url: 'https://x.se/hook', events: ['delivered'] }).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('defaults to 25 and caps at 100', () => {
    expect(paginationSchema.parse({}).limit).toBe(25);
    expect(paginationSchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});
