import { describe, expect, it } from 'vitest';
import { buildSignatureHeader, signPayload } from './sign.js';

// Same vector as packages/sdk-node/src/webhook.test.ts: the worker signs and
// the SDK verifies, so both must agree on it.
const BODY = '{"type":"email.delivered"}';
const SECRET = 'whsec_test';
const TIMESTAMP = 1_700_000_000;
const EXPECTED = 'd4d4b7b21b35fef2e6cc16378126f64094d119127d0d71bd32b6d7ff75821fc8';

describe('signPayload', () => {
  it('is HMAC-SHA256 over "<timestamp>.<body>"', () => {
    expect(signPayload(BODY, SECRET, TIMESTAMP)).toBe(EXPECTED);
  });

  it('changes with the body', () => {
    expect(signPayload(`${BODY} `, SECRET, TIMESTAMP)).not.toBe(EXPECTED);
  });
});

describe('buildSignatureHeader', () => {
  it('uses the t=<ts>,v1=<hex> format', () => {
    expect(buildSignatureHeader(BODY, SECRET, TIMESTAMP)).toBe(`t=${TIMESTAMP},v1=${EXPECTED}`);
  });
});
