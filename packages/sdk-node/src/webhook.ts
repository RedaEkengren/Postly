import crypto from 'node:crypto';

export interface VerifyOptions {
  payload: string;
  signature: string;
  secret: string;
  tolerance?: number;
}

export function verifyWebhookSignature(options: VerifyOptions): boolean {
  const { payload, signature, secret, tolerance = 300 } = options;

  const parts = signature.split(',');
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));

  if (!tPart || !v1Part) return false;

  const timestamp = Number(tPart.slice(2));
  const receivedSig = v1Part.slice(3);

  if (isNaN(timestamp)) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > tolerance) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  // timingSafeEqual throws on buffers of different length, and Buffer.from
  // silently drops invalid hex. Reject anything that is not exactly a
  // SHA-256 hex digest before comparing, so a malformed header is `false`.
  if (!/^[0-9a-f]{64}$/i.test(receivedSig)) return false;

  return crypto.timingSafeEqual(
    Buffer.from(receivedSig, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}
