import crypto from 'node:crypto';

/**
 * Fingerprint of a request body, stored with an Idempotency-Key so a replay
 * with a different body is a conflict. Key order matters: the same fields in a
 * different order hash differently.
 */
export function hashRequestBody(body: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
}
