# Postly — Product Requirements Document

**Document status:** Draft v0.1
**Owner:** Reda (Benbo.se / future Postly AB)
**Last updated:** 2026-09-19 — no Amazon SES, own delivery infrastructure (ADR-020, ADR-021)
**Working name:** Postly (placeholder — final name TBD, ADR-016)

---

## 1. Summary

Postly is a transactional email API for European developers that runs its own delivery infrastructure in the EU. Nobody but Postly accepts, signs, queues or delivers the mail: no Amazon SES, and no other email provider, sits between the API and the recipient's mail server (ADR-020). Two supporting subprocessors are still US companies and are open items in Compliance §4, so the broader "no US company anywhere" claim is not made until they are settled. It is priced as a utility (€0.40 per 1,000 emails, no subscription tiers).

The product is designed for solo founders and small SaaS teams who already understand SPF/DKIM/DMARC, want great developer experience, and have customers who ask where their data goes. They resent flat-fee subscriptions like Resend ($20/mo for 50k) or Postmark ($15/mo for 10k), and they cannot answer "is a US company involved?" with no when they use either.

## 2. Problem

Three problems exist in the transactional email market in 2026:

1. **Subscription pricing.** Existing providers (Resend, Postmark, SendGrid, Lettermint) charge flat subscriptions that bill a low-volume sender for capacity they do not use. Resend doubled their 200k-emails tier from $80 to $160 in October 2024. SendGrid retired their permanent free plan in May 2025.

2. **EU data residency tradeoff.** The EU-compliant options (Lettermint, MailPace, Scaleway TEM) have weaker developer experience than US-based options (Resend, Postmark). European SaaS founders are forced to choose between GDPR comfort and great DX.

3. **A US company in the sending path cannot be contracted away.** The Data Privacy Framework can fall (Schrems III), and European customers' security questionnaires increasingly ask which subprocessors see message content. A provider whose sending runs on US infrastructure can only answer with a transfer impact assessment.

## 3. Goals & Non-Goals

### Goals

- Ship a usable v0 in 8 weeks that can replace Resend for the founder's own SaaS portfolio (Bokflow, Tallvik, BilRental, Nordvik, BraLeads)
- Reach 50 paying customers and €1,500 MRR within 9 months of public launch
- Set a gross margin target once the infrastructure's real costs are measured (ADR-021)
- Achieve Gmail/Yahoo/Microsoft bulk-sender compliance out of the box for every customer domain
- Be immune to Schrems III: EU-only data residency for all customer data, and no US subprocessor anywhere in the sending path

### Non-Goals (v0–v1)

- Marketing email / broadcast / newsletter features (separate from transactional)
- A drag-and-drop email builder
- ISO 27001 or SOC 2 certification (year 2 work)
- Regulated industry compliance work (fintech-grade DPIA, HIPAA-equivalent) — defer to year 2
- Mobile push notifications, SMS, or any non-email channel
- A web-based template editor with WYSIWYG (CLI + code-first only in v0)

## 4. Target Users

**Primary ICP — Bootstrapped EU SaaS founder (1–5 person team)**
- Already self-hosts or uses Resend/Postmark
- Sends 5,000–500,000 transactional emails/month
- Understands DNS records, configures DKIM themselves
- Cares about GDPR because customers ask in security questionnaires
- Price-sensitive and watches dashboards

**Secondary ICP — EU company whose customers demand no US subprocessors**
- Public sector suppliers, health-adjacent and legal SaaS, companies with works councils or strict procurement
- Needs to list every subprocessor and answer where message content is processed
- Will choose the provider that can say "EU only, end to end" over a cheaper one that cannot

**Tertiary ICP (future) — EU agencies & resellers**
- Manage email for 5–50 client SaaS products
- Want sub-accounts and consolidated billing
- Defer until v2

**Explicit non-targets in v0–v1:**
- Marketing teams sending newsletters (different product, different deliverability profile)
- Regulated industries (fintech, health) requiring DPIA support and audit-ready compliance docs
- High-volume senders (>2M emails/month) until our IP pools are warm and proven; we provide export tooling instead

## 5. User Stories

### Onboarding
- As a developer, I can sign up with email + password (or GitHub OAuth) and get an API key within 60 seconds
- As a developer, I can verify a sending domain by adding DNS records, with auto-detection of which provider hosts my DNS (Cloudflare, Route53, Loopia, Hetzner, Loopia, Glesys)
- As a developer, I get clear, plain-English errors when my DKIM/SPF/DMARC records are wrong, with a fix link

### Sending
- As a developer, I can send a transactional email via a single `POST /v1/emails` call
- As a developer, I can pass an `Idempotency-Key` header and get the same response if I retry within 30 days
- As a developer, I can send a batch of up to 500 emails in one API call with per-recipient idempotency
- As a developer, I can schedule an email for future delivery with `scheduled_at`
- As a developer, I can send raw HTML, MJML, or a pre-rendered React Email output

### Observability
- As a developer, I can search messages by recipient, subject, tag, or status from the dashboard or API
- As a developer, I get webhooks for delivery, bounce and complaint events with HMAC-SHA256 signatures (no open or click tracking at launch; see §10)
- As a developer, I can replay a webhook from the dashboard if my endpoint was down
- As a developer, I can see exactly why an email bounced, with the raw SMTP response and a plain-English explanation

### Deliverability
- As a developer, I get a Slack/Discord/email alert when my complaint rate exceeds 0.1%
- As a developer, I get an automatic pause on a sending domain if bounce rate spikes above 5%
- As a developer, I see my Google Postmaster Tools + Microsoft SNDS reputation in one view

### Pricing & Billing
- As a developer, I can see my exact cost in the dashboard ("You sent 23,400 emails → €9.36")
- As a developer, I can pre-purchase credit packs (10k / 100k / 1M) at a small discount
- As a developer, I can export all my data with a one-command CLI

## 6. Functional Requirements

### 6.1 Sending API
- `POST /v1/emails` — single send, returns `{id, status: "queued"}`
- `POST /v1/emails/batch` — up to 500 messages per call
- `GET /v1/emails/:id` — message status + events
- `GET /v1/emails?to=&from=&tag=&status=&after=&before=` — paginated search
- Support raw HTML, plain text, attachments (up to 10MB combined), inline images, custom headers
- All requests must support `Idempotency-Key` header (30-day retention)
- All requests must accept and return ISO 8601 timestamps in UTC

### 6.2 Domain Management
- `POST /v1/domains` — register a domain
- `GET /v1/domains/:domain` — status of DKIM, SPF, DMARC verification
- DNS auto-detection: provide one-click instructions for Cloudflare, Route53, GoDaddy, Loopia, Hetzner DNS, OVH, Gandi, Namecheap
- Auto-poll DNS every 5 minutes during verification, every 6 hours after

### 6.3 Suppression Management
- `GET /v1/suppressions?reason=&after=`
- `POST /v1/suppressions` — manually add
- `DELETE /v1/suppressions/:address` — remove
- Per-tenant suppression list; one tenant's bounces never suppress an address for another
- Hard bounces and complaints auto-add to suppression; soft bounces do not

### 6.4 Templates
- `POST /v1/templates` — create template with HTML, MJML, or React Email output
- `GET /v1/templates/:slug` — fetch latest version
- `POST /v1/templates/:slug/versions` — create new version (immutable)
- Variable substitution via Handlebars-compatible syntax
- `POST /v1/emails` accepts `template_slug` + `variables` instead of raw HTML

### 6.5 Webhooks
- `POST /v1/webhooks` — register endpoint with subscribed events
- HMAC-SHA256 signature in `X-Postly-Signature` header
- At-least-once delivery with exponential backoff over 24 hours
- Webhook replay from dashboard

### 6.6 Delivery infrastructure (ADR-020)
- Postly delivers through self-hosted KumoMTA in the EU, behind a `DeliveryEngine` interface
- Per-domain DKIM keys generated by Postly (RSA-2048), private keys encrypted at rest
- Asynchronous bounces and feedback-loop complaints are received on a Postly return-path domain and matched to the message
- Reputation protection: per-tenant sending limits, warnings and automatic pause on bounce and complaint rates (thresholds in Tech Spec §8), per-tenant egress pools so dedicated IPs can be added
- BYO-SES (customer's own AWS account) was planned and is dropped

### 6.7 Dashboard
- Domains: list, verify, view DKIM/SPF/DMARC status
- Messages: full-text search, filter by recipient/tag/status/date
- Events: real-time stream of delivery events
- Reputation: per-domain complaint rate, bounce rate, Google Postmaster Tools integration
- Templates: list, edit, preview, version history
- API keys: create, revoke, view last used
- Billing: usage, invoices, credit pack purchases

### 6.8 CLI (`postly`)
- `postly init <domain>` — verify domain, auto-add DNS records via DNS provider API
- `postly send <to> -t <template> -v key=val` — send from terminal
- `postly preview <template.tsx>` — render template against test data
- `postly logs --tail` — stream events in terminal
- `postly replay <message_id>` — resend a failed message
- `postly migrate --from resend` — import API keys, domains, suppressions from Resend
- `postly export` — dump everything to a tarball for migration off Postly

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Availability** | 99.9% monthly uptime SLA (43m downtime/mo) for paid customers; 99.95% target |
| **Latency** | API p50 < 50ms, p99 < 200ms (Stockholm region) |
| **Send latency** | p50 < 2s from API call to recipient inbox (matching AhaSend's claim) |
| **Throughput** | Bounded by IP reputation: low during the 4–8 week warm-up of each sending IP, then by pool size and mailbox-provider limits |
| **Data residency** | All customer data and all sending in the EU. No US subprocessor in the sending path |
| **Encryption** | TLS 1.2+ in transit, AES-256 at rest |
| **Retention** | Email content: 30 days default (configurable 7–90 days), Events: 90 days default (configurable 30–365), Audit log: 1 year |
| **GDPR** | Right to erasure within 30 days, DPA auto-signed at signup, full subprocessor list public |
| **Security** | All API keys hashed (bcrypt), no plaintext storage; DKIM private keys encrypted at rest (AES-256-GCM) |

## 8. Pricing

| Tier | Price | Includes |
|---|---|---|
| **Free** | €0/mo | 3,000 emails/mo, 100/day cap, 1 verified domain, 7-day message history |
| **Pay-as-you-go** | €0.40 / 1,000 emails | Unlimited domains, 30-day message history, all features |
| **Prepaid 10k pack** | €3.80 (5% off) | One-time purchase, valid 12 months |
| **Prepaid 100k pack** | €36 (10% off) | One-time purchase, valid 12 months |
| **Prepaid 1M pack** | €340 (15% off) | One-time purchase, valid 12 months |
| **Dedicated IP** | €40/month/IP | Available above 100k/mo |
| **Inbound parsing** | €0.40 / 1,000 inbound | Same rate as outbound |

Free-tier abuse is mitigated by: 100-email/day cap, mandatory domain verification before sending, no IP-based signup batching, payment method required for >1,000 emails/month.

## 9. Success Metrics

**Launch (Months 0–3):**
- 10 paying customers
- €100+ MRR
- Postly sends >50% of founder's own SaaS portfolio email volume

**Year 1 (Month 12):**
- 50 paying customers
- €1,500 MRR
- <0.1% mean complaint rate across all customers
- p50 delivery time <2s to Gmail
- 99.9%+ uptime achieved

**Year 2 (Month 24):**
- 500 paying customers
- €15,000 MRR
- ISO 27001 certification in progress
- Inbound email + dedicated IP SKUs generating >20% of revenue

## 10. Out of Scope (v0)

- Marketing campaigns / drip sequences
- Contact lists / segmentation
- A/B testing
- Email validation API (we will integrate with Mailgun's validator or use ZeroBounce as upstream)
- Mobile apps
- Multi-region active-active deployment (warm failover only)
- Real-time multi-user dashboard collaboration
- White-label / reseller mode
- Open and click tracking (tracking pixels and rewritten links). Unreliable since Apple Mail Privacy Protection, legally sensitive under ePrivacy, and at odds with the privacy positioning. "No tracking by default" is a feature.
- Bring-your-own-SES (dropped with ADR-020)

## 11. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| New sending IPs have no reputation | 4–8 week warm-up plan, founder's own portfolio as first traffic, Google Postmaster Tools, Microsoft SNDS/JMRP, Yahoo CFL, blocklist monitoring |
| One abusive customer torches sender reputation | Per-tenant daily limits, automatic pause on bounce and complaint rates (Tech Spec §8), per-tenant egress pools |
| Port 25 or the hosting provider's IP reputation blocks sending | **Resolved 2026-10-06 (ADR-024):** GleSYS, port 25 open with no rate limit, own MTA permitted, and they guarantee the assigned addresses are not listed in Spamhaus. Other blocklists are checked by us before warm-up starts |
| Resend cuts prices to compete | Margin discipline, differentiate on EU end to end + DX |
| Schrems III invalidates DPF | No US company delivers the mail (ADR-020). Neon and Cloudflare remain open items in Compliance §4 and must be settled before the claim is made more broadly |
| Founder bus factor | Document infra as code, designate technical executor in AB articles |

**Open questions:**
- Final product name + domain (`.eu` and `.se` preferred for positioning)
- Should we offer a self-hosted/open-core edition for max trust? (Decision: not in v0; revisit if it becomes a sales blocker)
- Stripe vs Mollie for billing? (Lean Stripe for DX; document Mollie fallback)
- Do we accept crypto payment for privacy-focused customers? (Defer to v1)

## 12. Timeline

| Milestone | Date | Description |
|---|---|---|
| M0: Setup | Week 0–2 | Register AB, F-skatt, moms, OSS; reserve domain; provision Hetzner + Postgres |
| M1: v0 API | Week 3–6 | `POST /emails`, domain verification, KumoMTA delivery with bounce/complaint loop |
| M2: v0 Dashboard | Week 7–8 | Messages list, domains, API keys, basic billing |
| M3: Private beta | Week 9–10 | 10 hand-picked customers, first paid signups |
| M4: Public launch | Week 11–12 | Show HN, european-alternatives.eu submission |
| M5: Templates + CLI | Month 4 | Templates, CLI, batch API |
| M6: Warm-up complete | Month 5 | Sending IPs at full volume with Gmail, Microsoft and Yahoo |
| M7: Webhooks + Scheduled sends | Month 6 | Production-grade webhook delivery, scheduled_at |
| M8: Inbound parsing | Month 9 | Inbound email → webhook |
| M9: Dedicated IPs | Month 12 | Managed warmup, BIMI |

---

*See accompanying documents: `02-Tech-Spec.md`, `03-API-Contract.md`, `04-GTM-Plan.md`, `05-Compliance-Checklist.md`, `06-ADRs.md`.*
