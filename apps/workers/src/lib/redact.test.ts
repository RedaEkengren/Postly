import { describe, expect, it } from 'vitest';
import { redactAddress } from './redact.js';

describe('redactAddress', () => {
  it('keeps three characters of the local part and the domain', () => {
    expect(redactAddress('reda@example.se')).toBe('red***@example.se');
  });

  it('does not pad short local parts', () => {
    expect(redactAddress('a@example.se')).toBe('a***@example.se');
  });

  it('hides anything that is not an address', () => {
    expect(redactAddress('not-an-address')).toBe('***');
    expect(redactAddress('@example.se')).toBe('***');
    expect(redactAddress('')).toBe('***');
  });
});
