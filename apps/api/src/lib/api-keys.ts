import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

/** Characters of the raw key stored in clear, so authentication can find candidates before bcrypt. */
export const API_KEY_PREFIX_LENGTH = 12;

export type ApiKeyEnvironment = 'live' | 'test';

export function apiKeyEnvironment(nodeEnv: string | undefined): ApiKeyEnvironment {
  return nodeEnv === 'production' ? 'live' : 'test';
}

/** The raw key is returned to the caller once and never stored; only its prefix and hash are. */
export async function generateApiKey(environment: ApiKeyEnvironment) {
  const rawKey = `pst_${environment}_${crypto.randomBytes(16).toString('base64url')}`;
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, API_KEY_PREFIX_LENGTH),
    keyHash: await bcrypt.hash(rawKey, 10),
  };
}
