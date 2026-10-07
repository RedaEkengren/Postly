import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyWebhookSignature } from './webhook.js';

// Same vector as apps/workers/src/webhook/sign.test.ts.
const BODY = '{"type":"email.delivered"}';
const SECRET = 'whsec_test';
const TIMESTAMP = 1_700_000_000;
const SIGNATURE = `t=${TIMESTAMP},v1=d4d4b7b21b35fef2e6cc16378126f64094d119127d0d71bd32b6d7ff75821fc8`;

function sign(body: string, secret: string, ts: number): string {
  const hex = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return `t=${ts},v1=${hex}`;
}

describe('verifyWebhookSignature', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts the signature the worker produces', () => {
    vi.useFakeTimers();
    vi.setSystemTime(TIMESTAMP * 1000);
    expect(verifyWebhookSignature({ payload: BODY, signature: SIGNATURE, secret: SECRET })).toBe(true);
  });

  it('rejects a different body or secret', () => {
    const now = Math.floor(Date.now() / 1000);
    const signature = sign(BODY, SECRET, now);
    expect(verifyWebhookSignature({ payload: `${BODY} `, signature, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ payload: BODY, signature, secret: 'whsec_other' })).toBe(false);
  });

  it('rejects a timestamp outside the tolerance', () => {
    const old = Math.floor(Date.now() / 1000) - 301;
    expect(verifyWebhookSignature({ payload: BODY, signature: sign(BODY, SECRET, old), secret: SECRET })).toBe(false);
  });

  it('returns false instead of throwing on a malformed v1 value', () => {
    const now = Math.floor(Date.now() / 1000);
    for (const v1 of ['abc', 'zz', '', 'd4d4'.repeat(17)]) {
      expect(verifyWebhookSignature({ payload: BODY, signature: `t=${now},v1=${v1}`, secret: SECRET })).toBe(false);
    }
  });

  it('returns false for a header without both parts', () => {
    expect(verifyWebhookSignature({ payload: BODY, signature: 'garbage', secret: SECRET })).toBe(false);
  });
});
