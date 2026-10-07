import nodemailer, { type Transporter } from 'nodemailer';
import { verpSender } from '@postly/shared';
import { env } from '../lib/env.js';
import type { DeliveryEngine, DeliveryResult, OutboundMessage } from './engine.js';

/** KumoMTA answers an accepted injection with `250 OK ids=<spool id>[,<spool id>…]`. */
export function spoolIdFrom(response: string | undefined): string | null {
  return response?.match(/ids=(\S+)/)?.[1] ?? null;
}

/**
 * Injects over SMTP into KumoMTA on the private network. KumoMTA signs with the
 * domain's DKIM key, shapes and delivers; outcomes come back through its log
 * hook (POST /internal/kumo/events).
 */
export class KumoEngine implements DeliveryEngine {
  private readonly transport: Transporter;

  constructor(host = env.KUMO_SMTP_HOST, port = env.KUMO_SMTP_PORT) {
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure: false,
      // Private network hop to our own MTA; KumoMTA does TLS towards the receivers.
      ignoreTLS: true,
      pool: true,
      maxConnections: 5,
    });
  }

  async deliver(message: OutboundMessage): Promise<DeliveryResult> {
    const result = await this.transport.sendMail({
      envelope: {
        from: verpSender(message.messageId, message.returnPathDomain),
        to: [...message.to, ...(message.cc ?? []), ...(message.bcc ?? [])],
      },
      messageId: `<${message.messageId}@${message.returnPathDomain}>`,
      from: message.from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments,
      headers: {
        ...message.headers,
        // Last, so a customer header cannot override them. KumoMTA reads both
        // into metadata and strips X-Postly-Tenant before delivery.
        'X-Postly-Message-Id': message.messageId,
        'X-Postly-Tenant': message.tenantId,
      },
    });
    return { engineId: spoolIdFrom(result.response) };
  }
}

let engine: DeliveryEngine | undefined;

export function getDeliveryEngine(): DeliveryEngine {
  engine ??= new KumoEngine();
  return engine;
}
