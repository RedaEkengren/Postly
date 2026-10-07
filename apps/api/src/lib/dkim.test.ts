import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptPrivateKey, dkimSelector, encryptPrivateKey, generateDkimKeyPair } from './dkim.js';

const KEY = crypto.randomBytes(32).toString('base64');

describe('DKIM keys', () => {
  it('generates a 2048-bit pair whose halves sign and verify', () => {
    const { publicKey, privateKeyPem } = generateDkimKeyPair();
    const pub = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    expect(pub.asymmetricKeyDetails?.modulusLength).toBe(2048);
    const signature = crypto.sign('sha256', Buffer.from('mail'), privateKeyPem);
    expect(crypto.verify('sha256', Buffer.from('mail'), pub, signature)).toBe(true);
  });

  it('round-trips the private key through encryption', () => {
    const { privateKeyPem } = generateDkimKeyPair();
    const stored = encryptPrivateKey(privateKeyPem, KEY);
    expect(stored.toString('utf8')).not.toContain('PRIVATE KEY');
    expect(decryptPrivateKey(stored, KEY)).toBe(privateKeyPem);
  });

  it('refuses a tampered ciphertext or the wrong key', () => {
    const stored = encryptPrivateKey('secret', KEY);
    const tampered = Buffer.from(stored);
    tampered[tampered.length - 1]! ^= 1;
    expect(() => decryptPrivateKey(tampered, KEY)).toThrow();
    expect(() => decryptPrivateKey(stored, crypto.randomBytes(32).toString('base64'))).toThrow();
  });

  it('dates selectors by month', () => {
    expect(dkimSelector(new Date('2026-09-19T00:00:00Z'))).toBe('postly202609');
  });
});
