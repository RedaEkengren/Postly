import crypto from 'node:crypto';

/**
 * Per-domain DKIM keys. Postly generates the pair, publishes only the public
 * half (the customer adds it as a TXT record), and keeps the private half
 * encrypted at rest. KumoMTA fetches it over the private network to sign.
 */

export function generateDkimKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey: publicKey.toString('base64'), privateKeyPem: privateKey };
}

/** Selectors are dated, so a rotated key gets a new name and both can be live during the switch. */
export function dkimSelector(now = new Date()): string {
  return `postly${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('DKIM_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return key;
}

/** AES-256-GCM; the stored value is iv ‖ auth tag ‖ ciphertext. */
export function encryptPrivateKey(pem: string, base64Key: string): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(base64Key), iv);
  const ciphertext = Buffer.concat([cipher.update(pem, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptPrivateKey(stored: Buffer, base64Key: string): string {
  const iv = stored.subarray(0, IV_BYTES);
  const tag = stored.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(base64Key), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(stored.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
}
