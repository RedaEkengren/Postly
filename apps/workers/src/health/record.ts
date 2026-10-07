import type Redis from 'ioredis';
import {
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_HEARTBEAT_KEY,
  queueHealthKey,
  type QueueName,
} from '@postly/shared';

/**
 * What the API's /health reports on. Only the error class is kept: SMTP and
 * HTTP error messages can contain recipient addresses.
 */
export async function recordCompleted(redis: Redis, queue: QueueName, now = Date.now()) {
  await redis.hset(queueHealthKey(queue), {
    last_completed_at: String(now),
    consecutive_failures: '0',
  });
}

export async function recordFailed(redis: Redis, queue: QueueName, err: Error) {
  const key = queueHealthKey(queue);
  await redis.multi().hincrby(key, 'consecutive_failures', 1).hset(key, 'last_error', err.name).exec();
}

export function startHeartbeat(redis: Redis): NodeJS.Timeout {
  const beat = () => {
    redis.set(WORKER_HEARTBEAT_KEY, String(Date.now())).catch((err: Error) => {
      console.error('Heartbeat write failed:', err.name);
    });
  };
  beat();
  return setInterval(beat, WORKER_HEARTBEAT_INTERVAL_MS);
}
