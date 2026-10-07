import { describe, expect, it } from 'vitest';
import { spoolIdFrom } from './kumo.js';

describe('spoolIdFrom', () => {
  it('reads the spool id from KumoMTA\'s 250 reply', () => {
    expect(spoolIdFrom('250 OK ids=a1b2c3d4e5')).toBe('a1b2c3d4e5');
    expect(spoolIdFrom('250 OK ids=one,two')).toBe('one,two');
  });

  it('is null when the reply has no ids', () => {
    expect(spoolIdFrom('250 2.0.0 Ok: queued')).toBeNull();
    expect(spoolIdFrom(undefined)).toBeNull();
  });
});
