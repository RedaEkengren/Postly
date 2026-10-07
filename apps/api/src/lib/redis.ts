import Redis from 'ioredis';
import { env } from '../env.js';

let redis: Redis;

export function getRedis() {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
}
