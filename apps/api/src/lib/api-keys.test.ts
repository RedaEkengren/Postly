import bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { API_KEY_PREFIX_LENGTH, apiKeyEnvironment, generateApiKey } from './api-keys.js';

describe('generateApiKey', () => {
  it('produces a key the auth middleware accepts', async () => {
    const { rawKey, keyPrefix, keyHash } = await generateApiKey('test');
    expect(rawKey).toMatch(/^pst_test_[A-Za-z0-9_-]{22}$/);
    expect(keyPrefix).toBe(rawKey.slice(0, API_KEY_PREFIX_LENGTH));
    expect(await bcrypt.compare(rawKey, keyHash)).toBe(true);
  });

  it('never stores the raw key in the hash or prefix', async () => {
    const { rawKey, keyPrefix, keyHash } = await generateApiKey('live');
    expect(keyHash).not.toContain(rawKey);
    expect(keyPrefix.length).toBeLessThan(rawKey.length);
  });
});

describe('apiKeyEnvironment', () => {
  it('issues live keys only in production', () => {
    expect(apiKeyEnvironment('production')).toBe('live');
    expect(apiKeyEnvironment('development')).toBe('test');
    expect(apiKeyEnvironment(undefined)).toBe('test');
  });
});
