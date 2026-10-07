import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Job } from 'bullmq';
import { publicOnlyLookup } from '@postly/shared';
import { and, eq, webhooks, webhookDeliveries } from '@postly/db';
import { getDb } from '../lib/db.js';
import { buildSignatureHeader } from './sign.js';
import { enqueueDelivery } from './dispatcher.js';
import { retryDelayAfter } from './schedule.js';

export interface WebhookDeliveryJobData {
  deliveryId: string;
}

type PostResult = { ok: boolean; status: number | null; body: string };

const TIMEOUT_MS = 10_000;

/**
 * Never throws: a network error, timeout or refused address is a failed
 * attempt like any other. Uses node:http(s) rather than fetch so the lookup
 * can refuse private addresses at connect time (SSRF), and so redirects are
 * not followed.
 */
function postWebhook(url: string, secret: string, payload: unknown): Promise<PostResult> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return resolve({ ok: false, status: null, body: 'Invalid URL' });
    }
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(
      target,
      {
        method: 'POST',
        lookup: publicOnlyLookup,
        timeout: TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Postly-Signature': buildSignatureHeader(body, secret, timestamp),
          'User-Agent': 'Postly-Webhook/1.0',
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          if (size < 1024) chunks.push(chunk);
          size += chunk.length;
        });
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            body: Buffer.concat(chunks).toString('utf8').slice(0, 1024),
          });
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error(`Timed out after ${TIMEOUT_MS / 1000}s`)));
    request.on('error', (err) => resolve({ ok: false, status: null, body: err.message.slice(0, 1024) }));
    request.end(body);
  });
}

export async function processWebhookDelivery(job: Job<WebhookDeliveryJobData>) {
  const db = getDb();
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.id, job.data.deliveryId), eq(webhookDeliveries.status, 'pending')));
  if (!delivery) return;

  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, delivery.webhookId), eq(webhooks.active, true)));
  if (!webhook) {
    await db
      .update(webhookDeliveries)
      .set({ status: 'failed', responseBody: 'Webhook disabled or deleted', nextAttemptAt: null })
      .where(eq(webhookDeliveries.id, delivery.id));
    return;
  }

  const attempt = delivery.attempts + 1;
  const result = await postWebhook(webhook.url, webhook.secret, delivery.payload);
  const retryIn = result.ok ? null : retryDelayAfter(attempt);

  await db
    .update(webhookDeliveries)
    .set({
      status: result.ok ? 'delivered' : retryIn ? 'pending' : 'failed',
      attempts: attempt,
      responseStatus: result.status,
      responseBody: result.body,
      nextAttemptAt: retryIn ? new Date(Date.now() + retryIn) : null,
    })
    .where(eq(webhookDeliveries.id, delivery.id));

  if (retryIn) {
    // If this enqueue fails, the sweeper picks the delivery up once next_attempt_at passes.
    await enqueueDelivery(delivery.id, attempt + 1, retryIn).catch(() => {});
  } else if (!result.ok) {
    console.error(`Webhook ${webhook.id} failed permanently after ${attempt} attempts (${result.status ?? 'no response'})`);
  }
}
