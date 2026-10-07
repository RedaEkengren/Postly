import crypto from 'node:crypto';
import { and, eq, inArray, lt, domains, events, idempotencyKeys, messages, suppressions } from '@postly/db';
import { IDEMPOTENCY_RETENTION_DAYS, SEND_JOB_OPTIONS, type Rendered, type SendEmailInput } from '@postly/shared';
import { getDb } from './db.js';
import { getSendQueue } from './queue.js';
import { withTimeout } from './with-timeout.js';
import { domainNotVerifiedError, idempotencyConflictError, recipientSuppressedError } from './errors.js';
import { renderVersion, resolveVersion } from './templates.js';
import { assertCanSend } from './limits.js';

type Db = ReturnType<typeof getDb>;

export type SendResponse = {
  id: string;
  status: 'queued';
  to: string[];
  subject: string;
  created_at: string;
};

/** What the worker needs to build the email. Stored on the message, not in Redis. */
export type SendPayload = Pick<
  SendEmailInput,
  'from' | 'to' | 'cc' | 'bcc' | 'reply_to' | 'subject' | 'html' | 'text' | 'attachments' | 'headers' | 'template'
>;

/**
 * A stored response for this key, or null if the key is unused or expired.
 * The same key with a different body is a conflict.
 */
export async function findIdempotentResponse(db: Db, tenantId: string, key: string, requestHash: string) {
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.tenantId, tenantId), eq(idempotencyKeys.key, key)));
  if (!existing) return null;
  if (existing.expiresAt < new Date()) {
    await db
      .delete(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenantId, tenantId),
          eq(idempotencyKeys.key, key),
          lt(idempotencyKeys.expiresAt, new Date()),
        ),
      );
    return null;
  }
  if (existing.requestHash !== requestHash) throw idempotencyConflictError();
  return { status: existing.responseStatus, body: existing.responseBody as SendResponse };
}

export async function requireVerifiedDomain(db: Db, tenantId: string, from: string) {
  const fromDomain = from.includes('@') ? from.split('@').pop()!.replace('>', '') : '';
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.tenantId, tenantId), eq(domains.domain, fromDomain)));
  if (!domain || domain.dkimStatus !== 'verified') throw domainNotVerifiedError(fromDomain);
  return domain;
}

export async function assertNotSuppressed(db: Db, tenantId: string, input: SendEmailInput) {
  const recipients = [...input.to, ...(input.cc ?? []), ...(input.bcc ?? [])];
  const [suppressed] = await db
    .select({ address: suppressions.address })
    .from(suppressions)
    .where(and(eq(suppressions.tenantId, tenantId), inArray(suppressions.address, recipients)))
    .limit(1);
  if (suppressed) throw recipientSuppressedError(suppressed.address);
}

type AcceptArgs = {
  tenantId: string;
  domainId: string;
  input: SendEmailInput;
  idempotency: { key: string; requestHash: string } | null;
  /** The template, already validated and rendered, when the send names one. */
  rendered?: Rendered & { version: number };
};

/**
 * Claims the idempotency key and stores the message in one transaction. A
 * concurrent request with the same key waits on the key's primary key and then
 * finds it taken, so only one of them creates a message. Returns null when the
 * key was taken.
 */
export async function acceptMessage(db: Db, { tenantId, domainId, input, idempotency, rendered }: AcceptArgs) {
  const messageId = crypto.randomUUID();
  const now = new Date();
  // An explicit subject overrides the template's.
  const subject = input.subject ?? rendered?.subject ?? '';
  const response: SendResponse = {
    id: messageId,
    status: 'queued',
    to: input.to,
    subject,
    created_at: now.toISOString(),
  };
  const payload: SendPayload = {
    from: input.from,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    reply_to: input.reply_to,
    subject,
    html: rendered?.html ?? input.html,
    text: rendered?.text ?? input.text,
    attachments: input.attachments,
    headers: input.headers,
    template: input.template,
  };

  const accepted = await db.transaction(async (tx) => {
    if (idempotency) {
      const claimed = await tx
        .insert(idempotencyKeys)
        .values({
          tenantId,
          key: idempotency.key,
          requestHash: idempotency.requestHash,
          responseStatus: 202,
          responseBody: response,
          messageId,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_RETENTION_DAYS * 24 * 3600 * 1000),
        })
        .onConflictDoNothing()
        .returning({ key: idempotencyKeys.key });
      if (claimed.length === 0) return false;
    }
    await tx.insert(messages).values({
      id: messageId,
      tenantId,
      domainId,
      fromAddr: input.from,
      toAddrs: input.to,
      ccAddrs: input.cc ?? null,
      bccAddrs: input.bcc ?? null,
      subject,
      tags: input.tags ?? {},
      status: 'queued',
      idempotencyKey: idempotency?.key ?? null,
      templateSlug: input.template?.slug ?? null,
      templateVersion: rendered?.version ?? null,
      scheduledAt: input.scheduled_at ? new Date(input.scheduled_at) : null,
      payload,
      createdAt: now,
    });
    await tx.insert(events).values({ messageId, tenantId, type: 'queued', ts: now });
    return true;
  });

  return accepted ? response : null;
}

/** Renders when the send is accepted, so a missing template or bad variables fail the request (ADR-023). */
async function renderSendTemplate(
  tenantId: string,
  template: { slug: string; version?: number | null; variables?: Record<string, unknown> },
) {
  const version = await resolveVersion(tenantId, template.slug, template.version);
  return { ...(await renderVersion(version, template.variables ?? {})), version: version.version };
}

export type Accepted = {
  response: SendResponse;
  /** False when an idempotent replay answered; nothing new to enqueue. */
  created: boolean;
  scheduledAt?: string;
};

/**
 * Everything a single send goes through before it is queued: idempotency,
 * domain, suppression, template. Shared by POST /v1/emails and the batch
 * endpoint; the caller enqueues.
 */
export async function acceptSend(
  db: Db,
  tenantId: string,
  input: SendEmailInput,
  idempotency: { key: string; requestHash: string } | null,
): Promise<Accepted> {
  if (idempotency) {
    const replay = await findIdempotentResponse(db, tenantId, idempotency.key, idempotency.requestHash);
    if (replay) return { response: replay.body, created: false };
  }

  await assertCanSend(db, tenantId);
  const domain = await requireVerifiedDomain(db, tenantId, input.from);
  await assertNotSuppressed(db, tenantId, input);
  const rendered = input.template ? await renderSendTemplate(tenantId, input.template) : undefined;

  const response = await acceptMessage(db, { tenantId, domainId: domain.id, input, idempotency, rendered });
  if (response) return { response, created: true, scheduledAt: input.scheduled_at };

  // A concurrent request with the same key committed first; answer as it did.
  const replay = await findIdempotentResponse(db, tenantId, idempotency!.key, idempotency!.requestHash);
  if (!replay) throw idempotencyConflictError();
  return { response: replay.body, created: false };
}

/**
 * Best effort: the messages are already durable in Postgres. If Redis is
 * down, the sweeper in the workers enqueues them within a few minutes.
 */
export async function enqueueSends(tenantId: string, accepted: Accepted[]) {
  const jobs = accepted
    .filter((a) => a.created)
    .map(({ response, scheduledAt }) => ({
      name: 'send',
      data: { messageId: response.id, tenantId },
      opts: {
        ...SEND_JOB_OPTIONS,
        delay: scheduledAt ? Math.max(0, new Date(scheduledAt).getTime() - Date.now()) : 0,
        jobId: response.id,
      },
    }));
  if (jobs.length === 0) return;
  try {
    await withTimeout(getSendQueue().addBulk(jobs), 5_000);
  } catch (err) {
    console.error(`Enqueue failed for ${jobs.length} messages, the sweeper will retry: ${(err as Error).name}`);
  }
}
