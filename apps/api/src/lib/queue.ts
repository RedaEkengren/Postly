import { Queue } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from '@postly/shared';
import { getRedis } from './redis.js';

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: getRedis() });
    queues.set(name, queue);
  }
  return queue;
}

export function getSendQueue(): Queue {
  return getQueue(QUEUE_NAMES.send);
}
