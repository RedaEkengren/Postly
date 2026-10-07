# Postly — Technical Specification

**Document status:** Draft v0.1
**Companion to:** `01-PRD.md`
**Last updated:** 2026-09-19 — own delivery through KumoMTA, no Amazon SES (ADR-020). Schema and pipelines below are the target; they land phase by phase (GitHub epic #2).

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  EDGE (Cloudflare in front of all public endpoints)                │
│  - WAF, rate limiting, DDoS protection                             │
│  - TLS termination, HSTS                                           │
└───────────────┬────────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────────┐
│  CONTROL PLANE (Hetzner Helsinki, EU-North-1 latency profile)      │
│                                                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │  API (Hono)  │    │  Dashboard   │    │  Webhooks    │         │
│  │  Node 22 LTS │    │  Vite SPA    │    │  Outbound    │         │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘         │
│         │                   │                    │                 │
│         └────────┬──────────┴────────────────────┘                 │
│                  │                                                 │
│  ┌───────────────▼─────────────────────────────────┐               │
│  │  Postgres 16 (Neon EU → self-host at scale)     │               │
│  │  Redis 7 (BullMQ queue + cache)                 │               │
│  │  Hetzner Object Storage (raw MIME archive)      │               │
│  └─────────────────────────────────────────────────┘               │
└───────────────┬────────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────────┐
│  SENDING PLANE (our own, EU only — ADR-020)                        │
│                                                                    │
│  ┌──────────────────────────────┐   ┌───────────────────────────┐  │
│  │  KumoMTA (kumod)             │   │  tsa-daemon               │  │
│  │  SMTP injection (private)    │◄──┤  traffic-shaping          │  │
│  │  DKIM signing, spool, egress │   │  automation               │  │
│  │  pools on our sending IPs    │   └───────────────────────────┘  │
│  └──────┬─────────────────▲─────┘                                  │
│         │ port 25 out     │ port 25 in: async bounces (DSN),       │
│         ▼                 │ feedback reports (ARF) on the          │
│   Gmail, Outlook, …       │ return-path domain                     │
│                                                                    │
│  Log hook: delivery / bounce / transient / expiration / OOB /      │
│  feedback records, batched, retried on 4xx                         │
└────────────────────────┬───────────────────────────────────────────┘
                         │ POST /internal/kumo/events (token)
              ┌──────────▼──────────┐
              │  Event Worker       │  ← back into Control Plane
              │  (BullMQ consumer)  │     updates Postgres + fires
              └─────────────────────┘     customer webhooks
```

## 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Language** | TypeScript 5.5+ on Node.js 22 LTS | Founder fluency, ecosystem for email (React Email, MJML), Hono's edge-friendliness |
| **API framework** | Hono | 60k req/s on a single node, lightweight, edge-deployable if needed, excellent TS DX |
| **Frontend** | Vite + TanStack Router + React 19 (static SPA) | Exported from Lovable; see ADR-018 (supersedes Next.js 15) |
| **Queue** | BullMQ on Redis 7 | De-facto Node standard, Bull Board UI, supports delayed/scheduled jobs natively |
| **Primary DB** | PostgreSQL 16 | Standard, JSONB for events payload, partitioning for events table |
| **DB hosting (v0)** | Neon EU (Frankfurt) | Branching for dev/staging, generous free tier, auto-scaling |
| **DB hosting (scale)** | Self-host on Hetzner Helsinki | Cost crossover ~3,000 customers; managed Postgres on a CCX server |
| **Cache** | Redis 7 (same instance as queue, separate DB) | One less moving part |
| **Object store** | Hetzner Object Storage (S3-compatible) | EU-only, no AWS dependency for stored data |
| **Email engine** | KumoMTA, self-hosted (ADR-020) | Apache-2.0 MTA built for high-volume senders; no US subprocessor in the sending path. Behind a `DeliveryEngine` interface |
| **Event ingestion** | KumoMTA log hook → internal endpoint → BullMQ | Batched, retried by KumoMTA's own queue on 4xx |
| **DNS lookups** | dns-packet (Node native) | Direct UDP DNS queries to bypass system resolver caching |
| **Templates** | React Email (precompiled) + MJML + Handlebars | MJML compiled when a version is created; variables rendered in the send worker (ADR-022) |
| **Auth (dashboard)** | Lucia v3 or custom (session-based, no JWT) | Founder preference; PASETO if API tokens needed |
| **Billing** | Stripe (primary) + Mollie (fallback) | Stripe Tax for VAT, Stripe Billing for usage metering |
| **Observability** | Better Stack (logs + uptime) + Sentry EU | EU-hosted, generous free tier |
| **CI/CD** | GitHub Actions → Hetzner deploy via SSH or Coolify | Simple, fast, no Vercel dependency for production |
| **IaC** | Ansible and Terraform in benbo-infra; KumoMTA policy in `deploy/kumomta/` | One place for server configuration across the estate |
| **Edge / CDN** | Cloudflare (CNAME proxied) | Free WAF, DDoS, rate limiting; turn off if EU-purity matters to a customer (rare) |

## 3. Region Strategy

| Component | Region | Why |
|---|---|---|
| Control plane (API, dashboard, DB) | Hetzner Helsinki (geographically eu-north-1 equivalent) | Nearest to founder (Sweden), strong EU jurisdiction, no Hetzner Stockholm exists |
| Sending (KumoMTA + sending IPs) | **GleSYS** (Sweden; Stockholm, Falkenberg or Oulu), decided 2026-10-06 (ADR-024) | Port 25 open with no rate limit, own MTA permitted, dedicated /29 or /28 with the abuse contact delegated to us, and free BYOIP without an ASN for the later own-/24 phase |
| Object storage (MIME archive) | Hetzner Object Storage (Falkenstein DE / Helsinki FI) | EU-only, S3-compatible |
| Backups | Cross-EU (Hetzner Nuremberg backup of Helsinki primary) | Geographic separation, same jurisdiction |

There is no customer-facing sending region: all mail leaves from Postly's EU IP pools.

## 4. Data Model

### 4.1 Core tables

```sql
-- Tenants (accounts)
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'payg'
  status          TEXT NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'suspended'
  credit_balance  BIGINT NOT NULL DEFAULT 0,     -- email credits (1 credit = 1 email)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stripe_customer_id TEXT
);

-- Users (humans who log into dashboard)
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT,  -- nullable for OAuth-only
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_members (
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'owner',  -- 'owner' | 'admin' | 'member'
  PRIMARY KEY (tenant_id, user_id)
);

-- API keys (machine credentials)
CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash        TEXT NOT NULL,        -- bcrypt(key)
  key_prefix      TEXT NOT NULL,        -- first 8 chars, for display
  name            TEXT NOT NULL,
  scopes          TEXT[] NOT NULL,      -- ['emails.send', 'emails.read', 'suppressions.write']
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ
);

-- Domains
CREATE TABLE domains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain          TEXT NOT NULL,
  dkim_status     TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'verified' | 'failed'
  spf_status      TEXT NOT NULL DEFAULT 'pending',
  dmarc_status    TEXT NOT NULL DEFAULT 'pending',
  dkim_selector   TEXT NOT NULL,           -- e.g. 'postly202609'
  dkim_public_key TEXT NOT NULL,           -- published as TXT <selector>._domainkey
  dkim_private_key_encrypted BYTEA NOT NULL, -- RSA-2048, AES-256-GCM with DKIM_ENCRYPTION_KEY
  return_path_domain TEXT NOT NULL,        -- MX + SPF point at Postly; VERP bounces land here
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, domain)
);

-- Messages (sent emails)
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  domain_id       UUID NOT NULL REFERENCES domains(id),
  from_addr       TEXT NOT NULL,
  to_addrs        TEXT[] NOT NULL,
  cc_addrs        TEXT[],
  bcc_addrs       TEXT[],
  subject         TEXT NOT NULL,
  tags            JSONB DEFAULT '{}',
  mta_queue_id    TEXT,                 -- KumoMTA spool id
  status          TEXT NOT NULL,        -- 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'canceled'
  payload         JSONB,                -- send request, kept until a terminal status, then cleared
  claimed_at      TIMESTAMPTZ,          -- set by the worker that is sending it
  idempotency_key TEXT,
  template_slug   TEXT,
  template_version INT,
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE messages_2026_06 PARTITION OF messages
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
-- ... script to auto-create future partitions

CREATE INDEX ON messages (tenant_id, created_at DESC);
CREATE INDEX ON messages (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ON messages (mta_queue_id) WHERE mta_queue_id IS NOT NULL;
CREATE INDEX ON messages (created_at) WHERE status = 'queued';  -- sweeper
CREATE INDEX ON messages USING GIN (tags);

-- Events (delivery events)
CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES messages(id),
  tenant_id       UUID NOT NULL,    -- denormalized for fast tenant queries
  type            TEXT NOT NULL,    -- 'queued' | 'sent' | 'delivered' | 'deferred' | 'bounced' | 'complained' | 'failed' | 'canceled'
  ts              TIMESTAMPTZ NOT NULL,
  payload         JSONB
) PARTITION BY RANGE (ts);

CREATE INDEX ON events (message_id);
CREATE INDEX ON events (tenant_id, ts DESC);

-- Suppressions (per-tenant)
CREATE TABLE suppressions (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  address         CITEXT NOT NULL,
  reason          TEXT NOT NULL,    -- 'bounce' | 'complaint' | 'manual' | 'unsubscribe'
  source_message_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, address)
);

-- Templates
CREATE TABLE templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  current_version_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE template_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  format          TEXT NOT NULL,    -- 'html' | 'mjml' | 'react'
  source          TEXT NOT NULL,    -- raw HTML, MJML source, or compiled React HTML
  vars_schema     JSONB,
  subject         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, version)
);

-- Webhooks
CREATE TABLE webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,    -- HMAC secret, encrypted at rest
  events          TEXT[] NOT NULL,  -- subscribed event types
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL,
  status          TEXT NOT NULL,    -- 'pending' | 'delivered' | 'failed'
  attempts        INT NOT NULL DEFAULT 0,
  response_status INT,
  response_body   TEXT,
  next_attempt_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency
CREATE TABLE idempotency_keys (
  tenant_id       UUID NOT NULL,
  key             TEXT NOT NULL,
  request_hash    TEXT NOT NULL,    -- hash of request body for collision detection
  response_status INT NOT NULL,
  response_body   JSONB NOT NULL,
  message_id      UUID,             -- if successful, the created message
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, key)
);

CREATE INDEX ON idempotency_keys (expires_at);  -- for cleanup job

-- Audit log
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID,
  action          TEXT NOT NULL,    -- 'api_key.created', 'domain.verified', etc.
  resource_type   TEXT,
  resource_id     UUID,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Retention

- `messages`: 30 days default, configurable per tenant (7–90 days). Drop old partitions monthly.
- `events`: 90 days default, configurable per tenant (30–365 days).
- `idempotency_keys`: 30 days fixed, cleanup job runs hourly.
- `webhook_deliveries`: 30 days.
- `audit_log`: 365 days.
- Raw MIME archive in object storage: 30 days default.

## 5. Send Pipeline

```
Customer POST /v1/emails
        │
        ▼
┌────────────────────────┐
│ 1. Authenticate        │  API key lookup → tenant
│ 2. Authorize           │  scope check, plan check
│ 3. Validate            │  schema, recipient suppression check
│ 4. Idempotency claim   │  insert-or-return, in the same transaction
│ 5. Template variables  │  validated against vars_schema (422)
│ 6. Persist             │  message + payload + event, one transaction
│ 7. Enqueue             │  after commit, job = {messageId}; the
│                        │  sweeper re-enqueues if this step fails
└──────────┬─────────────┘
           │
           ▼ (returns {id, status: "queued"} to customer)
           │
┌──────────▼─────────────┐
│ Send worker            │
│ (BullMQ consumer)      │
└──────────┬─────────────┘
           │
           ▼
┌────────────────────────┐
│ 1. Claim               │  claimed_at, only if still 'queued'
│ 2. Check limits        │  per-tenant daily limit, tenant not paused
│ 3. Render              │  template variables (Handlebars)
│ 4. DeliveryEngine      │  KumoEngine: SMTP injection to kumod;
│                        │  Message-ID, X-Postly-Message-Id,
│                        │  VERP return-path b-<msgid>@<rp-domain>
│ 5. Update message      │  status='sent', mta_queue_id, clear payload
│ 6. Emit 'sent' event   │  → events table → webhook queue
└────────────────────────┘
```

**Retry strategy:**
- Injection into KumoMTA fails transiently (connection refused, 4xx): BullMQ retries, 5 attempts with exponential backoff; the claim is released first
- Injection rejected permanently (5xx): no retry, mark `failed`, emit event
- After injection, retries towards the receiving server are KumoMTA's job (shaping, backoff, `max_age`); the outcome comes back as an event
- A message still `queued` with no job (Redis lost, enqueue failed) is re-enqueued by the sweeper every minute. Delivery is at-least-once

## 6. Event Pipeline

```
KumoMTA log hook (custom constructor, batches, 4xx = retry)
        │
        ▼
POST /internal/kumo/events  (bearer token, private network only)
        │
        ▼
delivery-event queue (BullMQ) → event worker
        │
        ▼
1. Find the message: meta x_postly_message_id, or the VERP envelope sender for OOB records
2. Map the record:
   Delivery → delivered
   Bounce, hard by bounce_classification → bounced + suppress
   Bounce, soft → deferred event, no suppression
   TransientFailure → deferred event
   Expiration → failed
   OOB → as Bounce
   Feedback (ARF) → complained + suppress
3. Insert event row, update message status if terminal
4. Enqueue webhook delivery jobs with a fixed Postly payload (never the raw MTA record)
```

## 7. Webhook Delivery

- At-least-once delivery
- HMAC-SHA256 signature in `X-Postly-Signature: t={timestamp},v1={hex}` header
- Retry schedule after each failed attempt: 1m, 5m, 30m, 2h, 6h, 24h — the first attempt plus six retries, about 32.6h
- The attempt count and the signed payload live on the `webhook_deliveries` row; each attempt is its own delayed job, so a lost Redis loses no deliveries (the sweeper re-enqueues)
- Webhook is considered delivered on 2xx response within 10s timeout
- Customer can disable an endpoint or replay events from dashboard

## 8. Deliverability Autopilot

**Per-tenant monitoring:**
- Sliding 24h window: complaint rate, bounce rate, send volume
- Sliding 7d window: same metrics + reputation trend

**Alerts (Slack/Discord/email):**
- Complaint rate >0.1% over 24h → warning
- Bounce rate >5% over 24h → warning
- Complaint rate >0.2% over 24h → auto-pause domain + page founder

**Auto-actions:**
- Complaint rate >0.3% over 24h → suspend tenant, manual review required
- Domain bounce rate >10% in 1h → pause domain for 30 minutes

**Google Postmaster Tools integration (v1):**
- Customer authorizes Postly to read their domain's reputation data via Postmaster Tools API
- Daily ingestion, surface in dashboard

## 9. Security

| Concern | Mitigation |
|---|---|
| API key theft | Hashed at rest (bcrypt), shown once at creation, support immediate revocation |
| DKIM private key leak | AES-256-GCM at rest with `DKIM_ENCRYPTION_KEY`; served to KumoMTA only over an internal, token-protected endpoint on the private network |
| Tenant isolation | Row-level security in Postgres, scoped queries, per-tenant KumoMTA queues and egress pools |
| Account takeover | Bcrypt passwords, optional TOTP 2FA, magic-link login for password-less |
| Webhook secrets | Generated server-side, encrypted at rest, rotation supported |
| Outbound abuse | AUP enforcement, automated kill-switch on complaint rate, manual review for new accounts at >10k/day |
| Inbound DDoS | Cloudflare in front of all public endpoints, BullMQ as backpressure |
| Insider risk | Audit log for all admin actions, no production DB shell access without break-glass |

## 10. Operations

### 10.1 Deployment

Superseded by ADR-019 (BenboStandard archetype D). In short:

- CI builds one SHA-tagged image for the API and workers and Trivy-scans it
- A self-hosted runner on the Hetzner VM deploys with Docker Compose
- Drizzle migrations run in a one-shot `migrate` service before the API and workers start
- The deploy is gated on `/health`; a compose restart has a few seconds of downtime (no blue/green yet)
- Current state and launch gates: `DEPLOY.md` at the repository root

### 10.2 Monitoring

- Better Stack: logs, uptime, status page (EU instance)
- Sentry (EU region): error tracking
- Postgres metrics via `pg_stat_statements` + Grafana
- BullMQ queue depth, latency via Bull Board
- Custom dashboard: complaint rate, bounce rate, send latency per mailbox provider
- KumoMTA: `/metrics` (Prometheus), queue states, `check-liveness` included in `/health`
- Sending reputation: Google Postmaster Tools, Microsoft SNDS, blocklist monitoring

### 10.3 Backups

- Postgres: daily snapshot + WAL archiving to Hetzner Object Storage (EU)
- Cross-region: replicated nightly from Helsinki to Falkenstein
- Retention: 30 days
- Tested restore: monthly

### 10.4 Incident Response

- On-call: founder is solo, Better Stack pages via Telegram + email
- Status page: status.postly.eu (or chosen domain) on a separate host (not on the same Hetzner)
- Postmortem template in `/incidents/` git repo
- Customer comms: prepared templates for outages and for a sending IP being blocklisted

## 11. Performance Budgets

| Metric | Budget |
|---|---|
| API p50 latency | <50ms |
| API p99 latency | <200ms |
| Send queue → accepted by KumoMTA | <500ms p50 |
| End-to-end (API → Gmail inbox) | <2s p50, <5s p95 |
| Dashboard page load | <1s p50 |
| Webhook delivery success on first attempt | >95% |
| Postgres query p99 | <50ms |

## 12. Cost Model (Infrastructure)

### Stage 1: 0–100 customers (~500k emails/month)
- Hetzner CPX31 (1 server): €25/mo
- Neon EU (Pro): €25/mo
- Redis: included on the Hetzner server (Docker)
- Hetzner Object Storage: €5/mo
- Cloudflare: €0 (free tier)
- Better Stack + Sentry: €15/mo
- GleSYS sending host + dedicated /29: 523 SEK/mo (2 vCPU / 2 GB / 50 GB at 298 SEK plus 225 SEK). A /28 instead costs 450 SEK, and a 4 GB machine 472 SEK, so the upper variant is 922 SEK/mo (ADR-024)
- **Total: ~€70/mo for the control plane plus 523 to 922 SEK/mo for sending, roughly €115 to €150/mo all in**
- At €0.40 per 1,000 that is covered by about 290,000 to 375,000 billable emails per month. See 04-GTM-Plan.md for what that means in customers

### Stage 2: 100–1,000 customers (~10M emails/month)
- Hetzner CCX23 (2 servers, app + queue): €120/mo
- Managed Postgres (DigitalOcean EU or Aiven): €80/mo
- Redis: separate small server: €10/mo
- Object Storage: €15/mo
- Cloudflare Pro: €18/mo
- Better Stack + Sentry: €40/mo
- Sending hosts + IP pools: to be measured
- **Total infra excluding sending: ~€280/mo (revenue at €0.40/k = €4,000/mo)**

### Stage 3: 1,000–10,000 customers (~100M emails/month)
- 4× Hetzner CCX or dedicated AX (~€600/mo)
- Self-hosted Postgres on dedicated AX52 (€100/mo)
- Redis cluster: €60/mo
- Object Storage: €100/mo
- Sending hosts + IP pools: to be measured
- **Total infra excluding sending: ~€860/mo (revenue €40,000/mo)**

## 13. Open Technical Questions

- SES or our own MTAs? **Decision (2026-09-19): our own, KumoMTA behind a `DeliveryEngine` interface (ADR-020). A home-grown engine only if KumoMTA blocks a real need.**
- Reputation isolation between tenants? **Decision: shared pool with per-tenant limits and automatic pause; per-tenant egress pools so dedicated IPs can be added.**
- React Email server-side compilation? **Decision: customers precompile (`postly compile`); MJML compiles at version creation, variables render in the send worker (ADR-022).**
- DNS provider API auto-config: build native integrations or just deep-link to each provider's add-record page? **Decision: deep-links for v0, native integrations (Cloudflare, Route53) for v1.**
- Open and click tracking? **Decision (2026-09-19): not at launch.** If added later: per-tenant CNAME (e.g., `clicks.bokflow.se` → Postly), off by default.

---

*See `03-API-Contract.md` for the public API specification, `06-ADRs.md` for architecture decisions.*
