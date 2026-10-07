import type {
  PostlyConfig,
  PostlyError,
  SendEmailParams,
  SendEmailResponse,
  GetEmailResponse,
  ListEmailsResponse,
  CreateDomainParams,
  DomainResponse,
  ListDomainsResponse,
  CreateSuppressionParams,
  SuppressionResponse,
  ListSuppressionsResponse,
  CreateApiKeyParams,
  ApiKeyResponse,
  ListApiKeysResponse,
  CreateWebhookParams,
  WebhookResponse,
  ListWebhooksResponse,
  CreateTemplateParams,
  TemplateResponse,
  ListTemplatesResponse,
  AccountResponse,
  ListOptions,
  ReplayWebhookParams,
  SendBatchResponse,
  TemplatePreview,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.postly.eu';

export class PostlyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: PostlyError,
  ) {
    super(body.detail ?? body.title);
    this.name = 'PostlyApiError';
  }
}

export class Postly {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  readonly emails: EmailsResource;
  readonly domains: DomainsResource;
  readonly suppressions: SuppressionsResource;
  readonly apiKeys: ApiKeysResource;
  readonly webhooks: WebhooksResource;
  readonly templates: TemplatesResource;
  readonly account: AccountResource;

  constructor(config: PostlyConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');

    this.emails = new EmailsResource(this);
    this.domains = new DomainsResource(this);
    this.suppressions = new SuppressionsResource(this);
    this.apiKeys = new ApiKeysResource(this);
    this.webhooks = new WebhooksResource(this);
    this.templates = new TemplatesResource(this);
    this.account = new AccountResource(this);
  }

  async request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': '@postly/node/0.0.1',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({
        type: 'unknown',
        title: res.statusText,
        status: res.status,
        detail: `HTTP ${res.status}`,
      }));
      throw new PostlyApiError(res.status, errorBody as PostlyError);
    }

    // DELETE endpoints answer 204 No Content; there is no body to parse.
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }
}

function withPage(path: string, options?: ListOptions & { reason?: string }): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options ?? {}) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

class EmailsResource {
  constructor(private client: Postly) {}

  async send(params: SendEmailParams, options?: { idempotencyKey?: string }): Promise<SendEmailResponse> {
    const headers: Record<string, string> = {};
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    return this.client.request<SendEmailResponse>('POST', '/v1/emails', params, headers);
  }

  async get(id: string): Promise<GetEmailResponse> {
    return this.client.request<GetEmailResponse>('GET', `/v1/emails/${id}`);
  }

  /** Up to 500 messages; each may carry its own `idempotency_key`. */
  async sendBatch(
    messages: Array<SendEmailParams & { idempotency_key?: string }>,
  ): Promise<SendBatchResponse> {
    return this.client.request<SendBatchResponse>('POST', '/v1/emails/batch', { messages });
  }

  /** Cancels an email that has not been handed to delivery yet, typically a scheduled one. */
  async cancel(id: string): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/emails/${id}`);
  }

  async list(options?: ListOptions): Promise<ListEmailsResponse> {
    return this.client.request<ListEmailsResponse>('GET', withPage('/v1/emails', options));
  }
}

class DomainsResource {
  constructor(private client: Postly) {}

  async create(params: CreateDomainParams): Promise<DomainResponse> {
    return this.client.request<DomainResponse>('POST', '/v1/domains', params);
  }

  async get(domain: string): Promise<DomainResponse> {
    return this.client.request<DomainResponse>('GET', `/v1/domains/${domain}`);
  }

  async list(options?: ListOptions): Promise<ListDomainsResponse> {
    return this.client.request<ListDomainsResponse>('GET', withPage('/v1/domains', options));
  }

  async verify(domain: string): Promise<DomainResponse> {
    return this.client.request<DomainResponse>('POST', `/v1/domains/${domain}/verify`);
  }

  async delete(domain: string): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/domains/${domain}`);
  }
}

class SuppressionsResource {
  constructor(private client: Postly) {}

  async create(params: CreateSuppressionParams): Promise<SuppressionResponse> {
    return this.client.request<SuppressionResponse>('POST', '/v1/suppressions', params);
  }

  async list(options?: ListOptions & { reason?: string }): Promise<ListSuppressionsResponse> {
    return this.client.request<ListSuppressionsResponse>('GET', withPage('/v1/suppressions', options));
  }

  async delete(address: string): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/suppressions/${encodeURIComponent(address)}`);
  }
}

class ApiKeysResource {
  constructor(private client: Postly) {}

  async create(params: CreateApiKeyParams): Promise<ApiKeyResponse> {
    return this.client.request<ApiKeyResponse>('POST', '/v1/api-keys', params);
  }

  async list(options?: ListOptions): Promise<ListApiKeysResponse> {
    return this.client.request<ListApiKeysResponse>('GET', withPage('/v1/api-keys', options));
  }

  async revoke(id: string): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/api-keys/${id}`);
  }
}

class WebhooksResource {
  constructor(private client: Postly) {}

  async create(params: CreateWebhookParams): Promise<WebhookResponse> {
    return this.client.request<WebhookResponse>('POST', '/v1/webhooks', params);
  }

  async get(id: string): Promise<WebhookResponse> {
    return this.client.request<WebhookResponse>('GET', `/v1/webhooks/${id}`);
  }

  async list(options?: ListOptions): Promise<ListWebhooksResponse> {
    return this.client.request<ListWebhooksResponse>('GET', withPage('/v1/webhooks', options));
  }

  async delete(id: string): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/webhooks/${id}`);
  }

  /** Redelivers failed deliveries since `after`, or exactly `event_ids`. */
  async replay(id: string, params: ReplayWebhookParams): Promise<{ replayed: number }> {
    return this.client.request<{ replayed: number }>('POST', `/v1/webhooks/${id}/replay`, params);
  }
}

class TemplatesResource {
  constructor(private client: Postly) {}

  async create(params: CreateTemplateParams): Promise<TemplateResponse> {
    return this.client.request<TemplateResponse>('POST', '/v1/templates', params);
  }

  async get(slug: string): Promise<TemplateResponse> {
    return this.client.request<TemplateResponse>('GET', `/v1/templates/${slug}`);
  }

  async list(options?: ListOptions): Promise<ListTemplatesResponse> {
    return this.client.request<ListTemplatesResponse>('GET', withPage('/v1/templates', options));
  }

  async createVersion(slug: string, params: Omit<CreateTemplateParams, 'slug'>): Promise<{ id: string; version: number }> {
    return this.client.request('POST', `/v1/templates/${slug}/versions`, params);
  }

  async delete(slug: string): Promise<void> {
    await this.client.request<void>('DELETE', `/v1/templates/${slug}`);
  }

  /** Renders the template as a send would, without sending. */
  async preview(slug: string, params: { variables?: Record<string, unknown>; version?: number | null } = {}): Promise<TemplatePreview> {
    return this.client.request<TemplatePreview>('POST', `/v1/templates/${slug}/preview`, params);
  }
}

class AccountResource {
  constructor(private client: Postly) {}

  async get(): Promise<AccountResponse> {
    return this.client.request<AccountResponse>('GET', '/v1/account');
  }
}
