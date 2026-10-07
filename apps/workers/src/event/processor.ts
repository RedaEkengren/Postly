import type { Job } from 'bullmq';
import { eq, messages, events, suppressions } from '@postly/db';
import { getDb } from '../lib/db.js';
import { redactAddress } from '../lib/redact.js';
import { dispatchWebhooks } from '../webhook/dispatcher.js';
import { classifyRecord, eventTime, messageIdOf, recipientsOf, type KumoLogRecord } from './classify.js';

export type EventJobData = KumoLogRecord;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function processEventJob(job: Job<EventJobData>) {
  const record = job.data;
  const outcome = classifyRecord(record);
  if (!outcome) return;

  const messageId = messageIdOf(record);
  if (!messageId || !UUID.test(messageId)) return;

  const db = getDb();
  const [message] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!message) {
    console.warn(`No message for a ${record.type} record (${record.id})`);
    return;
  }

  // A forged bounce would need a real message id; also require the recipient
  // to be one the message was actually sent to.
  const sentTo = new Set(
    [...message.toAddrs, ...(message.ccAddrs ?? []), ...(message.bccAddrs ?? [])].map((a) => a.toLowerCase()),
  );
  const recipients = recipientsOf(record).filter((r) => sentTo.has(r.toLowerCase()));
  if (recipients.length === 0) return;

  const ts = eventTime(record);
  const smtpResponse = record.response ? `${record.response.code} ${record.response.content}` : null;

  const [inserted] = await db
    .insert(events)
    .values({
      messageId: message.id,
      tenantId: message.tenantId,
      type: outcome.event,
      ts,
      payload: {
        recipients,
        smtp_response: smtpResponse,
        bounce_classification: record.bounce_classification ?? null,
        bounce_type: outcome.bounceType ?? null,
        mta_id: record.id,
      },
    })
    .returning({ id: events.id });

  if (outcome.terminal) {
    // TODO(reda): a message to several recipients gets the status of the last terminal record.
    await db.update(messages).set({ status: outcome.event }).where(eq(messages.id, message.id));
  }

  if (outcome.suppress) {
    for (const address of recipients) {
      await db
        .insert(suppressions)
        .values({ tenantId: message.tenantId, address, reason: outcome.suppress, sourceMessageId: message.id })
        .onConflictDoNothing();
      console.log(`Suppressed ${redactAddress(address)} (${outcome.suppress})`);
    }
  }

  await dispatchWebhooks(message.tenantId, inserted!.id, `email.${outcome.event}`, {
    id: inserted!.id,
    type: `email.${outcome.event}`,
    created_at: ts.toISOString(),
    data: {
      message_id: message.id,
      to: message.toAddrs,
      from: message.fromAddr,
      subject: message.subject,
      tags: message.tags ?? {},
      recipients,
      smtp_response: smtpResponse,
      ...(outcome.bounceType ? { bounce_type: outcome.bounceType } : {}),
    },
  });
}
