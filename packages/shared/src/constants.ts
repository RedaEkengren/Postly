export const API_VERSION = 'v1';

export const PLANS = ['free', 'payg'] as const;
export type Plan = (typeof PLANS)[number];

export const TENANT_STATUSES = ['active', 'paused', 'suspended'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const MESSAGE_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'failed',
  'canceled',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const EVENT_TYPES = [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'opened',
  'clicked',
  'failed',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SUPPRESSION_REASONS = ['bounce', 'complaint', 'manual', 'unsubscribe'] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const API_KEY_SCOPES = [
  'emails.send',
  'emails.read',
  'domains.read',
  'domains.write',
  'suppressions.read',
  'suppressions.write',
  'templates.read',
  'templates.write',
  'webhooks.read',
  'webhooks.write',
  'account.read',
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];


export const FREE_TIER_MONTHLY_LIMIT = 3000;
export const FREE_TIER_DAILY_LIMIT = 100;
export const BATCH_MAX_SIZE = 500;
export const IDEMPOTENCY_RETENTION_DAYS = 30;
export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const PRICE_PER_THOUSAND_EUR_CENTS = 40;

export const QUEUE_NAMES = {
  send: 'email-send',
  event: 'delivery-event',
  webhook: 'webhook-deliver',
  maintenance: 'maintenance',
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Written by the workers, read by the API's /health. Redis is the one store
// both processes already share.
/** A send claim older than this is presumed to belong to a worker that died mid-send. */
export const CLAIM_TTL_MS = 15 * 60 * 1000;

/**
 * One BullMQ job per webhook delivery attempt, so a retry or a replay is a new
 * job instead of colliding with a finished one. BullMQ rejects ":" in ids.
 */
export function deliveryJobId(deliveryId: string, attempt: number): string {
  return `${deliveryId}_${attempt}`;
}

export const WORKER_HEARTBEAT_KEY = 'postly:health:workers:heartbeat';
export const WORKER_HEARTBEAT_INTERVAL_MS = 30_000;
export function queueHealthKey(queue: QueueName): string {
  return `postly:health:queue:${queue}`;
}

/**
 * BullMQ options for send jobs, shared by the API and the sweeper so a
 * re-enqueued message behaves like a fresh one. `type: 'custom'` makes BullMQ
 * use the worker's backoffStrategy, which it otherwise ignores.
 */
export const SEND_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'custom' },
  removeOnComplete: { age: 24 * 3600 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;
