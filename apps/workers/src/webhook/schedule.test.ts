import { describe, expect, it } from 'vitest';
import { RETRY_DELAYS_MS, deliveryJobId, retryDelayAfter } from './schedule.js';

describe('webhook retry schedule', () => {
  it('waits 1m after the first failure and 24h after the sixth', () => {
    expect(retryDelayAfter(1)).toBe(60_000);
    expect(retryDelayAfter(6)).toBe(86_400_000);
  });

  it('stops after the first attempt plus six retries, about 32.6 hours', () => {
    expect(retryDelayAfter(7)).toBeNull();
    const hours = RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) / 3_600_000;
    expect(hours).toBeCloseTo(32.6, 1);
  });

  it('gives each attempt its own job id', () => {
    expect(deliveryJobId('d1', 1)).not.toBe(deliveryJobId('d1', 2));
  });
});
