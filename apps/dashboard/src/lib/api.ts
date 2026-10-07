const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { type?: string; title?: string; detail?: string },
  ) {
    super(body.detail ?? body.title ?? `HTTP ${status}`);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    apiFetch<{ ok: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  signup: (email: string, password: string, orgName: string) =>
    apiFetch<{ ok: boolean }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, orgName }),
    }),

  session: () =>
    apiFetch<{
      authenticated: boolean;
      user?: { id: string; email: string };
      tenant?: { id: string; name: string; plan: string };
      role?: string;
    }>("/auth/session"),

  logout: () =>
    apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};

// Dashboard data
export type OverviewData = {
  stats: {
    emailsThisMonth: number;
    deliveryRate: number;
    bounceRate: number;
    complaintRate: number;
    activeApiKeys: number;
    verifiedDomains: number;
  };
  recentMessages: Array<{
    id: string;
    to: string[];
    from: string;
    subject: string;
    status: string;
    sentAt: number;
  }>;
  domains: Array<{
    id: string;
    domain: string;
    returnPath: string | null;
    dkim: string;
    spf: string;
    dmarc: string;
  }>;
  webhooks: Array<{
    id: string;
    url: string;
    events: string[];
    active: boolean;
  }>;
  templates: Array<{
    slug: string;
  }>;
};

export type MessageRow = {
  id: string;
  to: string;
  from: string;
  subject: string;
  status: string;
  tags: string[];
  domain: string;
  sentAt: number;
};

export type DomainRow = {
  id: string;
  domain: string;
  returnPath: string | null;
  dkim: string;
  spf: string;
  dmarc: string;
  createdAt: number;
};

export type SuppressionRow = {
  address: string;
  reason: string;
  source: string | null;
  createdAt: number;
};

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsed: number | null;
  createdAt: number;
};

export type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: number;
};

export type TemplateRow = {
  slug: string;
  currentVersionId: string | null;
  createdAt: number;
};

export type EventRow = {
  id: string;
  messageId: string;
  type: string;
  timestamp: number;
  payload: unknown;
};

export type DnsRecord = {
  type: "TXT" | "MX";
  name: string;
  value: string;
  purpose: "DKIM" | "RETURN_PATH" | "SPF" | "DMARC";
  /** DMARC is recommended; the others are needed to send. */
  required: boolean;
};

export type DomainDetail = {
  id: string;
  domain: string;
  return_path_domain: string;
  dkim_status: "pending" | "verified";
  spf_status: "pending" | "verified";
  dmarc_status: "pending" | "verified";
  dns_records: DnsRecord[];
  verified_at: string | null;
  created_at: string;
};

export type Reputation = {
  status: string;
  window: string;
  delivered: number;
  bounced: number;
  hardBounced: number;
  complained: number;
  complaintRate: number;
  hardBounceRate: number;
  assessment: "none" | "warn" | "pause" | "suspend";
  thresholds: { complaintWarn: number; complaintPause: number; complaintSuspend: number; hardBouncePause: number };
};

export type CreateApiKeyResult = {
  id: string;
  key: string;
  key_prefix: string;
  name: string;
  scopes: string[];
};

export type CreateWebhookResult = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
};

export type CreateTemplateResult = {
  id: string;
  slug: string;
  current_version: number;
  format: string;
  subject: string;
};

export const dashboard = {
  overview: () => apiFetch<OverviewData>("/dashboard/overview"),
  messages: (limit = 50, offset = 0) =>
    apiFetch<{ data: MessageRow[]; total: number; limit: number; offset: number }>(
      `/dashboard/messages?limit=${limit}&offset=${offset}`,
    ),
  message: (id: string) => apiFetch<MessageRow & { events: EventRow[] }>(`/dashboard/messages/${id}`),
  domains: () => apiFetch<{ data: DomainRow[] }>("/dashboard/domains"),
  domain: (domain: string) => apiFetch<DomainDetail>(`/dashboard/domains/${domain}`),
  reputation: () => apiFetch<Reputation>("/dashboard/reputation"),
  suppressions: (reason?: string) =>
    apiFetch<{ data: SuppressionRow[] }>(
      `/dashboard/suppressions${reason && reason !== "all" ? `?reason=${reason}` : ""}`,
    ),
  apiKeys: () => apiFetch<{ data: ApiKeyRow[] }>("/dashboard/api-keys"),
  webhooks: () => apiFetch<{ data: WebhookRow[] }>("/dashboard/webhooks"),
  templates: () => apiFetch<{ data: TemplateRow[] }>("/dashboard/templates"),
  events: (limit = 50) => apiFetch<{ data: EventRow[] }>(`/dashboard/events?limit=${limit}`),

  createDomain: (domain: string, returnPath = "bounces") =>
    apiFetch<DomainDetail>("/dashboard/domains", {
      method: "POST",
      body: JSON.stringify({ domain, return_path: returnPath }),
    }),
  verifyDomain: (domain: string) =>
    apiFetch<DomainDetail>(`/dashboard/domains/${domain}/verify`, { method: "POST" }),
  deleteDomain: (domain: string) =>
    apiFetch<void>(`/dashboard/domains/${domain}`, { method: "DELETE" }),

  createApiKey: (name: string, scopes: string[]) =>
    apiFetch<CreateApiKeyResult>("/dashboard/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, scopes }),
    }),
  revokeApiKey: (id: string) =>
    apiFetch<void>(`/dashboard/api-keys/${id}`, { method: "DELETE" }),

  createWebhook: (url: string, events: string[]) =>
    apiFetch<CreateWebhookResult>("/dashboard/webhooks", {
      method: "POST",
      body: JSON.stringify({ url, events }),
    }),
  deleteWebhook: (id: string) =>
    apiFetch<void>(`/dashboard/webhooks/${id}`, { method: "DELETE" }),

  addSuppression: (address: string, reason: string) =>
    apiFetch<{ address: string; reason: string }>("/dashboard/suppressions", {
      method: "POST",
      body: JSON.stringify({ address, reason }),
    }),
  removeSuppression: (address: string) =>
    apiFetch<void>(`/dashboard/suppressions/${encodeURIComponent(address)}`, { method: "DELETE" }),

  createTemplate: (slug: string, format: string, source: string, subject: string) =>
    apiFetch<CreateTemplateResult>("/dashboard/templates", {
      method: "POST",
      body: JSON.stringify({ slug, format, source, subject }),
    }),
  createTemplateVersion: (slug: string, format: string, source: string, subject: string) =>
    apiFetch<{ id: string; version: number }>(`/dashboard/templates/${slug}/versions`, {
      method: "POST",
      body: JSON.stringify({ format, source, subject }),
    }),
  deleteTemplate: (slug: string) =>
    apiFetch<void>(`/dashboard/templates/${slug}`, { method: "DELETE" }),

  updateAccount: (name: string) =>
    apiFetch<{ ok: boolean; name: string }>("/dashboard/account", {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  deleteAccount: () =>
    apiFetch<void>("/dashboard/account", { method: "DELETE" }),
};
