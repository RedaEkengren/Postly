export interface PostlyConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface PostlyError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
}

export interface SendEmailParams {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    content_base64: string;
  }>;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  scheduled_at?: string;
  template?: {
    slug: string;
    version?: number | null;
    variables?: Record<string, unknown>;
  };
}

export interface SendEmailResponse {
  id: string;
  status: string;
  to: string[];
  subject: string;
  created_at: string;
}

export interface EmailEvent {
  type: string;
  ts: string;
  payload: Record<string, unknown> | null;
}

export interface GetEmailResponse {
  id: string;
  tenant_id: string;
  status: string;
  from: string;
  to: string[];
  subject: string;
  tags: Record<string, string>;
  created_at: string;
  sent_at: string | null;
  events: EmailEvent[];
}

export interface ListEmailsResponse {
  data: Array<{
    id: string;
    status: string;
    to: string[];
    subject: string;
    created_at: string;
  }>;
  next_cursor: string | null;
}

export interface CreateDomainParams {
  domain: string;
  /** Envelope-sender subdomain whose MX points at Postly. Default `bounces`. */
  return_path?: string;
}

export interface DnsRecord {
  type: 'TXT' | 'MX';
  name: string;
  value: string;
  purpose: 'DKIM' | 'RETURN_PATH' | 'SPF' | 'DMARC';
  /** DMARC is recommended; the others are needed to send. */
  required: boolean;
}

export interface DomainSummary {
  id: string;
  domain: string;
  return_path_domain: string;
  dkim_status: 'pending' | 'verified';
  spf_status: 'pending' | 'verified';
  dmarc_status: 'pending' | 'verified';
  verified_at: string | null;
  created_at: string;
}

export interface DomainResponse extends DomainSummary {
  dns_records: DnsRecord[];
}

export interface ListDomainsResponse {
  data: DomainSummary[];
  next_cursor: string | null;
}

export interface CreateSuppressionParams {
  address: string;
  reason: 'bounce' | 'complaint' | 'manual' | 'unsubscribe';
  note?: string;
}

export interface SuppressionResponse {
  address: string;
  reason: string;
  created_at: string;
}

export interface ListSuppressionsResponse {
  data: SuppressionResponse[];
  next_cursor: string | null;
}

export interface CreateApiKeyParams {
  name: string;
  scopes: string[];
}

export interface ApiKeyResponse {
  id: string;
  key?: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  created_at: string;
}

export interface ListApiKeysResponse {
  data: ApiKeyResponse[];
  next_cursor: string | null;
}

export interface CreateWebhookParams {
  url: string;
  events: string[];
  description?: string;
}

export interface WebhookResponse {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export interface ListWebhooksResponse {
  data: WebhookResponse[];
  next_cursor: string | null;
}

export interface CreateTemplateParams {
  slug: string;
  format: 'html' | 'mjml' | 'react';
  source: string;
  subject: string;
  vars_schema?: Record<string, unknown>;
}

export interface TemplateResponse {
  id: string;
  slug: string;
  current_version?: {
    id: string;
    version: number;
    format: string;
    source: string;
    subject: string;
    vars_schema: Record<string, unknown> | null;
    created_at: string;
  } | null;
  created_at: string;
}

export interface ListTemplatesResponse {
  data: Array<{
    id: string;
    slug: string;
    created_at: string;
  }>;
  next_cursor: string | null;
}

export interface AccountResponse {
  id: string;
  name: string;
  plan: string;
  status: string;
  credit_balance: number;
  created_at: string;
}

/** Every list endpoint pages with an opaque cursor, newest first. */
export interface ListOptions {
  /** 1–100, default 25. */
  limit?: number;
  /** `next_cursor` from the previous page. */
  cursor?: string;
}

export type BatchResult =
  | { index: number; status: 'queued'; id: string }
  | { index: number; status: 'rejected'; error: { type: string; title: string; detail: string } };

export interface SendBatchResponse {
  /** One per message, in the order sent. A rejected message does not fail the others. */
  results: BatchResult[];
}

export interface ReplayWebhookParams {
  /** Redeliver failed deliveries created at or after this time (ISO 8601). */
  after?: string;
  /** Redeliver exactly these events, whatever their status. */
  event_ids?: string[];
}

export interface TemplatePreview {
  subject: string;
  html: string;
  text: string;
}
