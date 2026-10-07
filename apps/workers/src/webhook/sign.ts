import crypto from 'node:crypto';

/** Hex HMAC-SHA256 over `<timestamp>.<body>`, the v1 value of X-Postly-Signature. */
export function signPayload(body: string, secret: string, timestamp: number): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function buildSignatureHeader(body: string, secret: string, timestamp: number): string {
  return `t=${timestamp},v1=${signPayload(body, secret, timestamp)}`;
}
