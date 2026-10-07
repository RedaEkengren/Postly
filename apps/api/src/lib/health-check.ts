import { sql } from '@postly/db';
import { QUEUE_NAMES, WORKER_HEARTBEAT_KEY, queueHealthKey, type QueueName } from '@postly/shared';
import { getDb } from './db.js';
import { env } from '../env.js';
import { getRedis } from './redis.js';
import { getQueue } from './queue.js';
import type { HealthInput, QueueInput } from './health.js';
import { withTimeout as withTimeoutMs } from './with-timeout.js';

const CHECK_TIMEOUT_MS = 2_000;

const withTimeout = <T>(promise: Promise<T>) => withTimeoutMs(promise, CHECK_TIMEOUT_MS);

async function succeeds(check: () => Promise<unknown>): Promise<boolean> {
  try {
    await withTimeout(check());
    return true;
  } catch {
    return false;
  }
}

const toNumber = (value: string | null | undefined) => (value ? Number(value) : null);

async function readQueue(name: QueueName): Promise<QueueInput> {
  const queue = getQueue(name);
  const [counts, [oldest], recorded] = await Promise.all([
    queue.getJobCounts('waiting', 'active', 'failed'),
    queue.getJobs(['waiting'], 0, 0, true),
    getRedis().hgetall(queueHealthKey(name)),
  ]);
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    failed: counts.failed ?? 0,
    oldestWaitingAt: oldest?.timestamp ?? null,
    lastCompletedAt: toNumber(recorded.last_completed_at),
    consecutiveFailures: toNumber(recorded.consecutive_failures) ?? 0,
    lastError: recorded.last_error ?? null,
  };
}

export async function gatherHealthInput(): Promise<HealthInput> {
  const [database, redis, mta] = await Promise.all([
    succeeds(() => getDb().execute(sql`select 1`)),
    succeeds(() => getRedis().ping()),
    succeeds(async () => {
      const res = await fetch(`${env.KUMO_HTTP_URL}/api/check-liveness/v1`);
      if (!res.ok) throw new Error(`KumoMTA liveness ${res.status}`);
    }),
  ]);

  if (!redis) return { database, redis, mta, heartbeatAt: null, queues: {} };

  const names = Object.values(QUEUE_NAMES);
  try {
    const [heartbeat, ...queues] = await withTimeout(
      Promise.all([getRedis().get(WORKER_HEARTBEAT_KEY), ...names.map(readQueue)]),
    );
    return {
      database,
      redis,
      mta,
      heartbeatAt: toNumber(heartbeat as string | null),
      queues: Object.fromEntries(names.map((name, i) => [name, queues[i]])),
    };
  } catch {
    // Redis answered ping but not the queue reads: report it as unreachable
    // rather than letting /health itself fail with a 500.
    return { database, redis: false, mta, heartbeatAt: null, queues: {} };
  }
}
