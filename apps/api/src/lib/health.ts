import type { QueueName } from '@postly/shared';

/** A worker process that has not written its heartbeat for this long is presumed dead. */
export const HEARTBEAT_MAX_AGE_SECONDS = 90;
/** A job still waiting after this long means the queue is not being worked. */
export const MAX_WAIT_SECONDS = 300;
/** Repeated failures in a row, as opposed to one bad message. */
export const FAILURE_STREAK_THRESHOLD = 5;

export type QueueInput = {
  waiting: number;
  active: number;
  failed: number;
  oldestWaitingAt: number | null;
  lastCompletedAt: number | null;
  consecutiveFailures: number;
  lastError: string | null;
};

export type HealthInput = {
  database: boolean;
  redis: boolean;
  /** KumoMTA's liveness: 503 there means it is shedding load and refusing mail. */
  mta: boolean;
  heartbeatAt: number | null;
  queues: Partial<Record<QueueName, QueueInput>>;
};

const secondsSince = (at: number | null, now: number) =>
  at === null ? null : Math.max(0, Math.round((now - at) / 1000));

function reportQueue(q: QueueInput, now: number) {
  const oldestWaiting = secondsSince(q.oldestWaitingAt, now);
  return {
    waiting: q.waiting,
    active: q.active,
    failed: q.failed,
    oldest_waiting_seconds: oldestWaiting,
    max_wait_seconds: MAX_WAIT_SECONDS,
    seconds_since_success: secondsSince(q.lastCompletedAt, now),
    consecutive_failures: q.consecutiveFailures,
    last_error: q.lastError,
    overdue: oldestWaiting !== null && oldestWaiting > MAX_WAIT_SECONDS,
  };
}

/**
 * Reports on the work, not the process (BenboStandard 03): is anything
 * picking jobs up, is a queue backing up, is a queue failing repeatedly.
 * seconds_since_success is informational only: an idle queue is healthy.
 */
export function buildHealthReport(input: HealthInput, now: number) {
  const heartbeatAge = secondsSince(input.heartbeatAt, now);
  const workersOverdue = heartbeatAge === null || heartbeatAge > HEARTBEAT_MAX_AGE_SECONDS;

  const jobs = Object.fromEntries(
    Object.entries(input.queues).map(([name, q]) => [name, reportQueue(q, now)]),
  );
  const stalled = Object.entries(jobs).filter(([, q]) => q.overdue).map(([name]) => name);
  const failing = Object.values(jobs).some((q) => q.consecutive_failures >= FAILURE_STREAK_THRESHOLD);

  const status =
    !input.database || !input.redis || !input.mta || workersOverdue
      ? 'unhealthy'
      : stalled.length > 0 || failing
        ? 'degraded'
        : 'healthy';

  return {
    status,
    checked_at: new Date(now).toISOString(),
    database: input.database ? 'connected' : 'unreachable',
    redis: input.redis ? 'connected' : 'unreachable',
    mta: input.mta ? 'connected' : 'unreachable',
    workers: {
      heartbeat_seconds_ago: heartbeatAge,
      max_age_seconds: HEARTBEAT_MAX_AGE_SECONDS,
      overdue: workersOverdue,
    },
    jobs,
    stalled_jobs: stalled,
  } as const;
}
