import { messageIdFromVerp } from '@postly/shared';

/** The parts of a KumoMTA log record (docs.kumomta.com/reference/log_record) this worker uses. */
export type KumoLogRecord = {
  type: string;
  id: string;
  sender: string;
  recipient: string | string[];
  response?: { code: number; content: string; enhanced_code?: unknown };
  bounce_classification?: string;
  meta?: Record<string, unknown>;
  /** Whole seconds. */
  timestamp?: number;
  /** RFC 3339 with sub-second precision; newer KumoMTA versions send it. */
  event_time?: string;
};

export type Outcome = {
  event: 'delivered' | 'deferred' | 'bounced' | 'complained' | 'failed';
  /** Changes the message's status; a deferral does not. */
  terminal: boolean;
  suppress: 'bounce' | 'complaint' | null;
  bounceType?: 'hard' | 'soft';
};

/**
 * Classifications that say the address itself is bad. Anything else — a spam
 * block, a policy rejection, a full mailbox — is about us or the moment, and
 * suppressing the address would punish the customer for it.
 */
const HARD_BOUNCES = new Set(['InvalidRecipient', 'BadDomain', 'InactiveMailbox']);

export function classifyRecord(record: KumoLogRecord): Outcome | null {
  switch (record.type) {
    case 'Delivery':
      return { event: 'delivered', terminal: true, suppress: null };
    case 'TransientFailure':
      return { event: 'deferred', terminal: false, suppress: null };
    case 'Bounce':
    case 'OOB': {
      const hard = HARD_BOUNCES.has(record.bounce_classification ?? '');
      return { event: 'bounced', terminal: true, suppress: hard ? 'bounce' : null, bounceType: hard ? 'hard' : 'soft' };
    }
    case 'Feedback':
      return { event: 'complained', terminal: true, suppress: 'complaint' };
    case 'Expiration':
    case 'AdminBounce':
      return { event: 'failed', terminal: true, suppress: null };
    default:
      // Reception, Delayed, Rejection and the rest describe KumoMTA's own work.
      return null;
  }
}

/**
 * Which message the record belongs to. Records for mail we sent carry the id
 * in metadata; an asynchronous bounce is a new message whose envelope sender
 * is our VERP return path, so the id comes from there.
 */
export function messageIdOf(record: KumoLogRecord): string | null {
  const fromMeta = record.meta?.x_postly_message_id;
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta;
  return messageIdFromVerp(record.sender);
}

export function eventTime(record: KumoLogRecord): Date {
  if (record.event_time && !Number.isNaN(Date.parse(record.event_time))) return new Date(record.event_time);
  if (record.timestamp) return new Date(record.timestamp * 1000);
  return new Date();
}

export function recipientsOf(record: KumoLogRecord): string[] {
  return (Array.isArray(record.recipient) ? record.recipient : [record.recipient]).filter(Boolean);
}
