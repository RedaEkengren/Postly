import type { Job } from 'bullmq';
import { and, eq, isNull, lt, or, domains, events, messages } from '@postly/db';
import { CLAIM_TTL_MS } from '@postly/shared';
import { getDb } from '../lib/db.js';
import { redactAddress } from '../lib/redact.js';
import { getDeliveryEngine } from '../delivery/kumo.js';
import { dispatchWebhooks } from '../webhook/dispatcher.js';
import { isTransientSendError } from './errors.js';

export interface SendJobData {
  messageId: string;
  tenantId: string;
}

/** What the API stored on the message (apps/api/src/lib/send-email.ts, SendPayload). */
interface SendPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: Array<{ filename: string; content_type: string; content_base64: string }>;
  headers?: Record<string, string>;
}

/**
 * Takes the message for this worker, or returns null if it is no longer
 * queued (already sent, failed or canceled) or another worker holds a live
 * claim. This is what makes a duplicate job — from a retry or the sweeper —
 * harmless.
 */
export async function claimMessage(messageId: string) {
  const [message] = await getDb()
    .update(messages)
    .set({ claimedAt: new Date() })
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.status, 'queued'),
        or(isNull(messages.claimedAt), lt(messages.claimedAt, new Date(Date.now() - CLAIM_TTL_MS))),
      ),
    )
    .returning();
  return message ?? null;
}

async function releaseClaim(messageId: string) {
  await getDb().update(messages).set({ claimedAt: null }).where(eq(messages.id, messageId));
}

async function recordOutcome(
  message: { id: string; tenantId: string; fromAddr: string; toAddrs: string[]; subject: string; tags: unknown },
  outcome: { type: 'sent'; mtaId: string | null } | { type: 'failed'; error: string },
) {
  const db = getDb();
  const now = new Date();
  await db
    .update(messages)
    .set({
      status: outcome.type,
      sentAt: outcome.type === 'sent' ? now : null,
      mtaQueueId: outcome.type === 'sent' ? outcome.mtaId : null,
      // The content is only needed until delivery; do not keep it.
      payload: null,
      claimedAt: null,
    })
    .where(eq(messages.id, message.id));

  const eventPayload = outcome.type === 'sent' ? { mta_id: outcome.mtaId } : { error: outcome.error };
  const [event] = await db
    .insert(events)
    .values({ messageId: message.id, tenantId: message.tenantId, type: outcome.type, ts: now, payload: eventPayload })
    .returning({ id: events.id });

  await dispatchWebhooks(message.tenantId, event!.id, `email.${outcome.type}`, {
    id: event!.id,
    type: `email.${outcome.type}`,
    created_at: now.toISOString(),
    data: {
      message_id: message.id,
      to: message.toAddrs,
      from: message.fromAddr,
      subject: message.subject,
      tags: message.tags ?? {},
      ...(outcome.type === 'failed' ? { error: outcome.error } : {}),
    },
  });
}

export async function processSendJob(job: Job<SendJobData>) {
  const message = await claimMessage(job.data.messageId);
  if (!message) return;

  const payload = message.payload as SendPayload | null;
  if (!payload) {
    await recordOutcome(message, { type: 'failed', error: 'Message content is missing' });
    return;
  }

  try {
    const [domain] = await getDb().select().from(domains).where(eq(domains.id, message.domainId));
    const result = await getDeliveryEngine().deliver({
      messageId: message.id,
      tenantId: message.tenantId,
      // Domains created before own delivery get their key and return path
      // the first time the API reads them; `bounces.` is the same default.
      returnPathDomain: domain?.returnPathDomain ?? `bounces.${domain?.domain ?? 'invalid'}`,
      from: payload.from,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      replyTo: payload.reply_to,
      subject: payload.subject ?? '',
      html: payload.html,
      text: payload.text,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.content_type,
        content: Buffer.from(a.content_base64, 'base64'),
      })),
      headers: payload.headers,
    });
    await recordOutcome(message, { type: 'sent', mtaId: result.engineId });
    console.log(`Sent message ${message.id} to ${payload.to.map(redactAddress).join(', ')}`);
  } catch (err) {
    const error = err as Error;
    const attemptsLeft = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
    if (isTransientSendError(error) && attemptsLeft) {
      await releaseClaim(message.id);
      throw err;
    }
    await recordOutcome(message, { type: 'failed', error: error.message });
    console.error(`Failed message ${message.id}: ${error.name}`);
  }
}
