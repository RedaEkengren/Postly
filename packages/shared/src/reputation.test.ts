import { describe, expect, it } from 'vitest';
import { judgeReputation, sendingLimits } from './reputation.js';

const counts = (delivered: number, hardBounced = 0, complained = 0, softBounced = 0) => ({
  delivered,
  bounced: hardBounced + softBounced,
  hardBounced,
  complained,
});

describe('judgeReputation', () => {
  it('does nothing below the minimum sample', () => {
    expect(judgeReputation(counts(10, 5, 5)).action).toBe('none');
  });

  it('warns, pauses and suspends on complaint rate as Tech Spec §8 says', () => {
    expect(judgeReputation(counts(10_000, 0, 5)).action).toBe('none'); // 0.05%
    expect(judgeReputation(counts(10_000, 0, 15)).action).toBe('warn'); // 0.15%
    expect(judgeReputation(counts(10_000, 0, 25)).action).toBe('pause'); // 0.25%
    expect(judgeReputation(counts(10_000, 0, 35)).action).toBe('suspend'); // 0.35%
  });

  it('pauses on hard bounces above 5% but ignores soft bounces', () => {
    expect(judgeReputation(counts(900, 60)).action).toBe('pause');
    expect(judgeReputation(counts(900, 0, 0, 300)).action).toBe('none');
  });
});

describe('sendingLimits', () => {
  const now = new Date('2026-09-19T12:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

  it('caps the free plan by day and month', () => {
    expect(sendingLimits({ plan: 'free', createdAt: daysAgo(100) }, now)).toEqual({ daily: 100, monthly: 3000 });
  });

  it('caps a new pay-as-you-go account by day only, then lifts it', () => {
    expect(sendingLimits({ plan: 'payg', createdAt: daysAgo(3) }, now)).toEqual({ daily: 1000, monthly: null });
    expect(sendingLimits({ plan: 'payg', createdAt: daysAgo(30) }, now)).toEqual({ daily: null, monthly: null });
  });
});
