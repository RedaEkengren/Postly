import { describe, expect, it } from 'vitest';
import {
  FAILURE_STREAK_THRESHOLD,
  HEARTBEAT_MAX_AGE_SECONDS,
  MAX_WAIT_SECONDS,
  buildHealthReport,
  type HealthInput,
  type QueueInput,
} from './health.js';

const NOW = Date.parse('2026-09-19T12:00:00Z');
const secondsAgo = (s: number) => NOW - s * 1000;

const idleQueue: QueueInput = {
  waiting: 0,
  active: 0,
  failed: 0,
  oldestWaitingAt: null,
  lastCompletedAt: null,
  consecutiveFailures: 0,
  lastError: null,
};

const healthy: HealthInput = {
  database: true,
  redis: true,
  mta: true,
  heartbeatAt: secondsAgo(10),
  queues: { 'email-send': idleQueue },
};

describe('buildHealthReport', () => {
  it('is healthy when everything answers and nothing waits', () => {
    const report = buildHealthReport(healthy, NOW);
    expect(report.status).toBe('healthy');
    expect(report.stalled_jobs).toEqual([]);
    expect(report.workers.heartbeat_seconds_ago).toBe(10);
  });

  it('treats an idle queue that never succeeded as healthy', () => {
    expect(buildHealthReport(healthy, NOW).jobs['email-send']?.seconds_since_success).toBeNull();
    expect(buildHealthReport(healthy, NOW).status).toBe('healthy');
  });

  it('is unhealthy when the database or redis is down', () => {
    expect(buildHealthReport({ ...healthy, database: false }, NOW).status).toBe('unhealthy');
    expect(buildHealthReport({ ...healthy, redis: false }, NOW).status).toBe('unhealthy');
    expect(buildHealthReport({ ...healthy, mta: false }, NOW).status).toBe('unhealthy');
  });

  it('is unhealthy when no worker has written a heartbeat recently', () => {
    const stale = { ...healthy, heartbeatAt: secondsAgo(HEARTBEAT_MAX_AGE_SECONDS + 1) };
    expect(buildHealthReport(stale, NOW).status).toBe('unhealthy');
    expect(buildHealthReport({ ...healthy, heartbeatAt: null }, NOW).workers.overdue).toBe(true);
  });

  it('is degraded and names the queue when a job waits too long', () => {
    const backedUp = {
      ...healthy,
      queues: { 'email-send': { ...idleQueue, waiting: 3, oldestWaitingAt: secondsAgo(MAX_WAIT_SECONDS + 1) } },
    };
    const report = buildHealthReport(backedUp, NOW);
    expect(report.status).toBe('degraded');
    expect(report.stalled_jobs).toEqual(['email-send']);
  });

  it('is degraded on a failure streak, not on a single failure', () => {
    const withFailures = (n: number) => ({
      ...healthy,
      queues: { 'email-send': { ...idleQueue, consecutiveFailures: n, lastError: 'Error' } },
    });
    expect(buildHealthReport(withFailures(1), NOW).status).toBe('healthy');
    expect(buildHealthReport(withFailures(FAILURE_STREAK_THRESHOLD), NOW).status).toBe('degraded');
  });
});
