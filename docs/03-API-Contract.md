# Postly — API Contract v1

**Document status:** Draft v0.2 (2026-09-19): own delivery infrastructure, no Amazon SES (ADR-020). Endpoints marked *not built yet* are the target for launch (GitHub epic #2).
**Base URL:** `https://api.postly.eu/v1`
**Authentication:** Bearer token in `Authorization` header

---

## 1. Authentication

All requests require an API key:

```
Authorization: Bearer pst_live_a1b2c3d4...
```

Key format: `pst_<env>_<32 random base62 chars>`
- `pst_test_*` — test environment (no real sends, free)
- `pst_live_*` — production

Keys are shown once at creation and stored hashed. Revocation is immediate.

## 2. Conventions

- All requests/responses are JSON unless noted
- Timestamps are ISO 8601 UTC: `"2026-05-25T14:32:11Z"`
- IDs are UUID v4
- Pagination: cursor-based via `?cursor=` + `?limit=` (1–100, default 25), newest first. Every list responds `{ "data": [...], "next_cursor": "..." | null }`. The cursor is opaque; pass it back unchanged
- Errors return RFC 7807-style problem details:
  ```json
  {
    "type": "https://docs.postly.eu/errors/domain_not_verified",
    "title": "Domain not verified",
    "status": 400,
    "detail": "The sending domain 'bokflow.se' has not completed DKIM verification.",
    "instance": "req_01HXYZ...",
    "docs_url": "https://docs.postly.eu/guides/domain-setup"
  }
  ```
- Rate limits in headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Idempotency: any `POST` accepts `Idempotency-Key` header (30-day retention)

## 3. Errors

| Status | Type | Meaning |
|---|---|---|
| 400 | validation_error | Request body failed validation |
| 400 | domain_not_verified | Sending domain not DKIM-verified |
| 400 | recipient_suppressed | Recipient on tenant suppression list |
| 400 | invalid_cursor | Pagination cursor is malformed |
| 401 | unauthorized | Invalid or missing API key |
| 403 | forbidden | API key lacks required scope |
| 403 | tenant_paused | Sending paused after bounce or complaint rates crossed a threshold; see the dashboard |
| 404 | not_found | Resource does not exist |
| 409 | idempotency_conflict | Idempotency key reused with different body |
| 409 | not_cancelable | Message is no longer scheduled |
| 422 | template_variables_invalid | Variables do not match the template's `vars_schema` |
| 422 | quota_exceeded | Plan quota exceeded or insufficient credits |
| 429 | rate_limited | Too many requests; retry after `Retry-After` header |
| 500 | internal_error | Server-side issue; safe to retry with same idempotency key |
| 502 | upstream_error | Delivery engine unavailable; safe to retry |
| 503 | maintenance | Planned maintenance; retry after `Retry-After` |

## 4. Endpoints

### 4.1 Emails

#### `POST /v1/emails` — Send a single email

**Required scope:** `emails.send`

**Request:**
```json
{
  "from": "Reda <reda@bokflow.se>",
  "to": ["customer@example.com"],
  "cc": [],
  "bcc": [],
  "reply_to": "support@bokflow.se",
  "subject": "Your invoice from Bokflow",
  "html": "<p>Hi Anna, your invoice is ready.</p>",
  "text": "Hi Anna, your invoice is ready.",
  "attachments": [
    {
      "filename": "invoice-2026-05.pdf",
      "content_type": "application/pdf",
      "content_base64": "JVBERi0xLjQKJ..."
    }
  ],
  "headers": {
    "X-Bokflow-Invoice-Id": "inv_01HXYZ"
  },
  "tags": {
    "category": "invoice",
    "customer_id": "cus_abc123"
  },
  "scheduled_at": null
}
```

**Response 202 Accepted:**
```json
{
  "id": "msg_01HXYZ123ABC",
  "status": "queued",
  "to": ["customer@example.com"],
  "subject": "Your invoice from Bokflow",
  "created_at": "2026-05-25T14:32:11Z"
}
```

**Notes:**
- `from` must be a verified address on a verified domain
- One of `html`, `text` or `template` required; `html` and `text` together recommended
- `subject` required unless `template` is given (the template supplies it)
- `scheduled_at` (ISO 8601) sends in the future, up to 7 days ahead
- Postly does not track opens or clicks: no tracking pixel, no rewritten links
- `Idempotency-Key` header makes the request safe to retry; returns the same response for 30 days

#### `POST /v1/emails` with template

```json
{
  "from": "Reda <reda@bokflow.se>",
  "to": ["customer@example.com"],
  "template": {
    "slug": "welcome-v2",
    "version": null,
    "variables": {
      "first_name": "Anna",
      "activation_url": "https://bokflow.se/activate?t=xyz"
    }
  },
  "tags": {"category": "transactional"}
}
```

If `version` is null, uses the template's current version. The template is rendered when the request is accepted (ADR-023): variables are validated against the version's `vars_schema` (a mismatch returns 422 `template_variables_invalid`), an unknown template or version returns 404, and a `subject` on the request overrides the template's. A scheduled send keeps the content it was accepted with, even if the template changes before it goes out.

#### `POST /v1/emails/batch` — Send up to 500 emails in one call

**Request:**
```json
{
  "messages": [
    {
      "to": ["a@example.com"],
      "from": "Reda <reda@bokflow.se>",
      "template": {
        "slug": "weekly-summary",
        "variables": {"name": "Anna", "total": "€420"}
      },
      "idempotency_key": "weekly-2026-W21-a@example.com"
    },
    { /* ... up to 500 */ }
  ]
}
```

**Response 202:**
```json
{
  "results": [
    {"index": 0, "status": "queued", "id": "msg_01HXYZ..."},
    {"index": 1, "status": "queued", "id": "msg_01HXYZ..."},
    {"index": 2, "status": "rejected", "error": {"type": "recipient_suppressed", "title": "Recipient on suppression list"}}
  ]
}
```

#### `GET /v1/emails/:id` — Get message details

**Required scope:** `emails.read`

**Response 200:**
```json
{
  "id": "msg_01HXYZ123ABC",
  "tenant_id": "ten_...",
  "status": "delivered",
  "from": "reda@bokflow.se",
  "to": ["customer@example.com"],
  "subject": "Your invoice from Bokflow",
  "tags": {"category": "invoice"},
  "created_at": "2026-05-25T14:32:11Z",
  "sent_at": "2026-05-25T14:32:12Z",
  "delivered_at": "2026-05-25T14:32:14Z",
  "events": [
    {"type": "queued", "ts": "2026-05-25T14:32:11Z"},
    {"type": "sent", "ts": "2026-05-25T14:32:12Z"},
    {"type": "deferred", "ts": "2026-05-25T14:32:13Z", "smtp_response": "421 4.7.0 Try again later"},
    {"type": "delivered", "ts": "2026-05-25T14:32:14Z", "smtp_response": "250 2.0.0 OK"}
  ]
}
```

Query parameter `?expand=events` is the default. Set `?expand=` to exclude events.

#### `GET /v1/emails` — Search messages

**Query parameters:**
- `to`, `from`, `subject_contains`, `tag.<key>=<value>`, `status`, `domain`
- `after`, `before` (ISO 8601)
- `cursor`, `limit` (1–100, default 25)

**Response 200:**
```json
{
  "data": [
    {"id": "msg_...", "status": "delivered", "to": [...], "subject": "...", "created_at": "..."}
  ],
  "next_cursor": "eyJpZCI6Im1zZ18uLi4ifQ=="
}
```

#### `DELETE /v1/emails/:id` — Cancel a message that has not been handed to delivery

Typically a scheduled message. The status becomes `canceled`, the stored content is deleted and `email.canceled` fires. Returns 204, or 409 `not_cancelable` once a worker has taken it.

**Message statuses:** `queued`, `sent`, `delivered`, `bounced`, `complained`, `failed`, `canceled`.

#### `POST /v1/emails/:id/replay` — Resend a failed message (*after launch*)

Re-enqueues a message that previously failed. Same content, new message ID. Deferred until after launch because of the duplicate-send risk.

### 4.2 Domains

#### `POST /v1/domains` — Add a domain

**Request:**
```json
{
  "domain": "bokflow.se",
  "return_path": "bounces"
}
```

`return_path` is the subdomain used as the envelope sender (default `bounces`). Asynchronous bounces and feedback reports are sent there, so its MX points at Postly.

**Response 201:**
```json
{
  "id": "dom_...",
  "domain": "bokflow.se",
  "return_path_domain": "bounces.bokflow.se",
  "dkim_status": "pending",
  "spf_status": "pending",
  "dmarc_status": "pending",
  "dns_records": [
    {
      "type": "TXT",
      "name": "postly202609._domainkey.bokflow.se",
      "value": "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
      "purpose": "DKIM",
      "required": true
    },
    {
      "type": "MX",
      "name": "bounces.bokflow.se",
      "value": "10 mx.postly.eu",
      "purpose": "RETURN_PATH",
      "required": true
    },
    {
      "type": "TXT",
      "name": "bounces.bokflow.se",
      "value": "v=spf1 include:_spf.postly.eu -all",
      "purpose": "SPF",
      "required": true
    },
    {
      "type": "TXT",
      "name": "_dmarc.bokflow.se",
      "value": "v=DMARC1; p=none; rua=mailto:dmarc@postly.eu",
      "purpose": "DMARC",
      "required": false
    }
  ],
  "verified_at": null,
  "created_at": "2026-09-19T12:00:00.000Z"
}
```

`dns_provider_hint` (which DNS host the domain uses, with a setup link) is planned, not built.

Postly generates a 2048-bit DKIM key per domain and publishes only the public half. SPF is checked on the return-path subdomain, which aligns with the From domain under DMARC's relaxed alignment. The DMARC record is recommended, not required; skip it if the domain already has one.

#### `GET /v1/domains` — List domains

#### `GET /v1/domains/:domain` — Status and the same `dns_records` as on creation

#### `POST /v1/domains/:domain/verify` — Force a DNS re-check

Pending domains are also re-checked every 5 minutes. A change fires `domain.verified` or `domain.verification_failed`.

#### `DELETE /v1/domains/:domain`

### 4.3 Suppressions

#### `GET /v1/suppressions`

Query: `?reason=bounce|complaint|manual|unsubscribe&after=&limit=&cursor=`

#### `POST /v1/suppressions`

```json
{
  "address": "bad@example.com",
  "reason": "manual",
  "note": "customer requested removal"
}
```

#### `DELETE /v1/suppressions/:address`

### 4.4 Templates

#### `POST /v1/templates`

```json
{
  "slug": "welcome-v2",
  "format": "mjml",
  "source": "<mjml>...</mjml>",
  "subject": "Welcome to {{product_name}}, {{first_name}}",
  "vars_schema": {
    "type": "object",
    "required": ["first_name", "activation_url"],
    "properties": {
      "first_name": {"type": "string"},
      "activation_url": {"type": "string", "format": "uri"}
    }
  }
}
```

**Formats supported:** `html`, `mjml`, `react` (pre-compiled HTML from React Email)

#### `GET /v1/templates` — List templates

#### `GET /v1/templates/:slug` — Returns current version

#### `POST /v1/templates/:slug/versions` — Create a new immutable version

#### `POST /v1/templates/:slug/preview` — Render without sending

```json
{
  "variables": {"first_name": "Anna", "activation_url": "https://example.com"},
  "version": null
}
```

Returns `{ "subject", "html", "text" }` rendered exactly as a send would. Invalid variables return 422. Client screenshots (Litmus-style) are out of scope.

#### `DELETE /v1/templates/:slug` — Delete a template and its versions (204)

### 4.5 Webhooks

#### `POST /v1/webhooks`

```json
{
  "url": "https://api.bokflow.se/webhooks/postly",
  "events": ["email.delivered", "email.bounced", "email.complained"],
  "description": "Bokflow production webhook"
}
```

**Response includes `secret`** — shown once.

**Subscribable events:**
- `email.queued`
- `email.sent`
- `email.delivered`
- `email.deferred` (a temporary failure; delivery is still being retried)
- `email.bounced`
- `email.complained`
- `email.failed`
- `email.canceled`
- `domain.verified`
- `domain.verification_failed`

#### `GET /v1/webhooks` / `GET /v1/webhooks/:id`

#### `DELETE /v1/webhooks/:id`

#### `POST /v1/webhooks/:id/replay` — Redeliver events

```json
{
  "after": "2026-05-25T00:00:00Z",
  "event_ids": ["evt_...", "evt_..."]
}
```

Redelivers this endpoint's failed deliveries since `after`, and the listed `event_ids` whatever their status; at most 1,000 per call, and deliveries still being retried are left alone. Each redelivery is signed with a fresh timestamp and gets one attempt. Returns 202 `{ "replayed": n }`.

#### Webhook payload format

```json
POST https://api.bokflow.se/webhooks/postly
X-Postly-Signature: t=1716643831,v1=5f8c9d7e...
X-Postly-Event-Id: evt_01HXYZ...
Content-Type: application/json

{
  "id": "evt_01HXYZ...",
  "type": "email.delivered",
  "created_at": "2026-05-25T14:32:14Z",
  "data": {
    "message_id": "msg_01HXYZ...",
    "to": ["customer@example.com"],
    "from": "reda@bokflow.se",
    "subject": "Your invoice from Bokflow",
    "tags": {"category": "invoice"},
    "smtp_response": "250 2.0.0 OK"
  }
}
```

**Signature verification (Node.js):**
```js
import crypto from 'node:crypto';

function verify(req, secret) {
  const header = req.headers['x-postly-signature'];
  const [tPart, v1Part] = header.split(',');
  const timestamp = tPart.split('=')[1];
  const signature = v1Part.split('=')[1];
  const payload = `${timestamp}.${req.rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### 4.6 API Keys

#### `POST /v1/api-keys`

```json
{
  "name": "Bokflow production",
  "scopes": ["emails.send", "emails.read", "suppressions.read"]
}
```

**Response includes `key` — shown once.**

#### `GET /v1/api-keys` — List (no secrets)

#### `DELETE /v1/api-keys/:id` — Revoke

### 4.7 Account & Billing

#### `GET /v1/account` — Tenant info

```json
{
  "id": "ten_...",
  "name": "Bokflow",
  "plan": "payg",
  "credit_balance": 8420,
  "current_month_volume": 12300,
  "current_month_cost_eur": "4.92"
}
```

#### `POST /v1/account/credits` — Purchase credit pack (*after launch*, with billing)

```json
{"pack": "100k"}
```

Returns a Stripe Checkout session URL.

## 5. Rate Limits

| Tier | Per-second | Daily | Monthly cap |
|---|---|---|---|
| Free | 5/s | 100 | 3,000 |
| Pay-as-you-go default | 50/s | unlimited | unlimited |
| Pay-as-you-go (after request) | 200/s | unlimited | unlimited |

429 responses include `Retry-After` in seconds. New accounts start below these limits while their sending reputation is established.

## 6. SDKs

Officially supported (released alongside v0):
- **TypeScript / JavaScript** (`@postly/node`) — zero deps, tree-shakeable
- **PHP** (`postly/postly-php`) — composer
- **Python** (`postly`) — pip
- **Go** (`github.com/postly/postly-go`)

Each SDK includes:
- Typed request/response
- Automatic retries with exponential backoff
- Idempotency key auto-generation
- Webhook signature verification helper
- React Email / MJML compile helpers (Node only)

**Node SDK quickstart:**
```ts
import { Postly } from '@postly/node';

const postly = new Postly({ apiKey: process.env.POSTLY_API_KEY });

const { id } = await postly.emails.send({
  from: 'Reda <reda@bokflow.se>',
  to: ['customer@example.com'],
  subject: 'Welcome',
  html: '<p>Hi there.</p>',
});
```

## 7. Versioning

- URL versioning (`/v1`)
- Breaking changes get a new major version (`/v2`)
- Old versions supported for 18 months minimum
- Deprecation notices via response header: `X-Postly-Deprecation: <ISO date>`
- Changelog at `docs.postly.eu/changelog`

## 8. SMTP Compatibility (*not built yet*)

For libraries that don't speak our REST API:

```
Host:     smtp.postly.eu
Port:     587 (STARTTLS) or 465 (TLS)
Username: postly
Password: <API key>
```

Same scopes apply. Idempotency via `X-Postly-Idempotency-Key` header in the SMTP message.

---

*The OpenAPI 3.1 spec is generated from the code and served at `/v1/openapi.json`; `docs/openapi.json` is the reviewed snapshot. It is the source of truth for request and response shapes as they are today. This document keeps the intent, the examples and the endpoints that are not built yet.*
