import { describe, expect, it } from 'vitest';
import { assertScopesHeld } from './api-keys.js';

describe('assertScopesHeld', () => {
  it('allows granting a subset of the caller\'s scopes', () => {
    expect(() => assertScopesHeld(['emails.send'], ['emails.send', 'emails.read'])).not.toThrow();
  });

  it('refuses to grant a scope the caller does not hold', () => {
    expect(() => assertScopesHeld(['emails.send', 'domains.write'], ['emails.send'])).toThrowError(
      expect.objectContaining({ status: 403, detail: expect.stringContaining('domains.write') }),
    );
  });
});
