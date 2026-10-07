const TRANSIENT_NETWORK_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ESOCKET']);

/**
 * Worth retrying: the relay refused for now (SMTP 4xx) or could not be
 * reached. A 5xx is a decision about this message and will not change.
 */
export function isTransientSendError(err: Error & { code?: string; responseCode?: number }): boolean {
  if (typeof err.responseCode === 'number') return err.responseCode >= 400 && err.responseCode < 500;
  if (err.code && TRANSIENT_NETWORK_CODES.has(err.code)) return true;
  return /Throttling|ServiceUnavailable|ECONNREFUSED|ETIMEDOUT/.test(err.message);
}
