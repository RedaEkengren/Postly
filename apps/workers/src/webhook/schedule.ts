/**
 * Delay before retrying after the n-th failed attempt (1-based): 1m, 5m, 30m,
 * 2h, 6h, 24h. The first attempt plus six retries spans about 32.6 hours.
 */
export const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000, 86_400_000];

export function retryDelayAfter(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt - 1] ?? null;
}

export { deliveryJobId } from '@postly/shared';

export const DELIVERY_JOB_OPTIONS = {
  removeOnComplete: { age: 24 * 3600 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;
