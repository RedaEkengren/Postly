import { describe, expect, it } from 'vitest';
import { classifyRecord, eventTime, messageIdOf, recipientsOf, type KumoLogRecord } from './classify.js';

const ID = '0b7c6f5e-1111-4000-8000-000000000001';
const record = (overrides: Partial<KumoLogRecord>): KumoLogRecord => ({
  type: 'Delivery',
  id: 'spool-1',
  sender: `b-${ID}@bounces.example.se`,
  recipient: 'anna@example.com',
  ...overrides,
});

describe('classifyRecord', () => {
  it('maps a delivery to delivered', () => {
    expect(classifyRecord(record({}))).toEqual({ event: 'delivered', terminal: true, suppress: null });
  });

  it('suppresses only hard bounces', () => {
    expect(classifyRecord(record({ type: 'Bounce', bounce_classification: 'InvalidRecipient' }))).toMatchObject({
      event: 'bounced',
      suppress: 'bounce',
      bounceType: 'hard',
    });
    for (const soft of ['SpamBlock', 'PolicyRelated', 'QuotaIssues', undefined]) {
      expect(classifyRecord(record({ type: 'Bounce', bounce_classification: soft }))).toMatchObject({
        event: 'bounced',
        suppress: null,
        bounceType: 'soft',
      });
    }
  });

  it('treats an asynchronous bounce like a synchronous one', () => {
    expect(classifyRecord(record({ type: 'OOB', bounce_classification: 'BadDomain' }))?.suppress).toBe('bounce');
  });

  it('defers on a transient failure without ending the message', () => {
    expect(classifyRecord(record({ type: 'TransientFailure' }))).toEqual({ event: 'deferred', terminal: false, suppress: null });
  });

  it('suppresses on a complaint and fails on expiry', () => {
    expect(classifyRecord(record({ type: 'Feedback' }))?.suppress).toBe('complaint');
    expect(classifyRecord(record({ type: 'Expiration' }))?.event).toBe('failed');
  });

  it('ignores KumoMTA bookkeeping records', () => {
    expect(classifyRecord(record({ type: 'Reception' }))).toBeNull();
    expect(classifyRecord(record({ type: 'Delayed' }))).toBeNull();
  });
});

describe('messageIdOf', () => {
  it('prefers metadata and falls back to the VERP sender', () => {
    expect(messageIdOf(record({ meta: { x_postly_message_id: 'from-meta' } }))).toBe('from-meta');
    expect(messageIdOf(record({}))).toBe(ID);
    expect(messageIdOf(record({ sender: 'someone@else.com' }))).toBeNull();
  });
});

describe('eventTime', () => {
  it('prefers the sub-second event_time over whole-second timestamp', () => {
    expect(eventTime(record({ event_time: '2026-09-19T19:10:00.123456Z', timestamp: 1 })).toISOString()).toBe(
      '2026-09-19T19:10:00.123Z',
    );
    expect(eventTime(record({ timestamp: 1_758_000_000 })).getTime()).toBe(1_758_000_000_000);
  });
});

describe('recipientsOf', () => {
  it('accepts one recipient or several', () => {
    expect(recipientsOf(record({}))).toEqual(['anna@example.com']);
    expect(recipientsOf(record({ recipient: ['a@x.se', 'b@x.se'] }))).toEqual(['a@x.se', 'b@x.se']);
  });
});
