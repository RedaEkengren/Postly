import { describe, expect, it } from 'vitest';
import { hashRequestBody } from './idempotency.js';

describe('hashRequestBody', () => {
  it('is stable for the same body', () => {
    expect(hashRequestBody({ to: ['a@x.se'] })).toBe(hashRequestBody({ to: ['a@x.se'] }));
  });

  it('differs when the body differs', () => {
    expect(hashRequestBody({ to: ['a@x.se'] })).not.toBe(hashRequestBody({ to: ['b@x.se'] }));
  });

  it('is a SHA-256 hex digest', () => {
    expect(hashRequestBody({})).toMatch(/^[0-9a-f]{64}$/);
  });
});
