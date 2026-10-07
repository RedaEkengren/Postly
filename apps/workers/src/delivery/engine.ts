/**
 * What the send worker hands to whatever delivers mail (ADR-020). KumoMTA is
 * the only implementation; the interface is the seam for replacing it.
 */
export type OutboundMessage = {
  messageId: string;
  tenantId: string;
  /** The customer's return-path domain; asynchronous bounces come back there. */
  returnPathDomain: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{ filename: string; contentType: string; content: Buffer }>;
  headers?: Record<string, string>;
};

export type DeliveryResult = {
  /** The engine's own id for the message, if it reported one. */
  engineId: string | null;
};

export interface DeliveryEngine {
  deliver(message: OutboundMessage): Promise<DeliveryResult>;
}
