# Postly — Architecture Decision Records

**Document status:** Draft v0.1
**Companion to:** `02-Tech-Spec.md`
**Last updated:** 2026-09-19

ADRs follow Michael Nygard's format: Title, Status, Context, Decision, Consequences.

---

## ADR-001: Use Amazon SES as the sending engine

**Status:** Accepted

**Context:**
Building a transactional email API requires either running our own MTAs (Postfix, Haraka, PowerMTA) or using a hosted sending service (Amazon SES, Sparkpost, Mailgun). Self-hosting on Hetzner is blocked because most VPS providers including Hetzner block outbound port 25 by default and require justification to unblock. Even with port 25 access, IP warming takes months and shared IP ranges from Hetzner are widely Spamhaus-listed.

**Decision:**
Use Amazon SES as the sole sending engine for v0–v1. Operate in eu-west-1 (Ireland) as primary and eu-central-1 (Frankfurt) as failover.

**Consequences:**

*Positive:*
- Cheapest sending cost at $0.10 per 1,000 emails
- Best deliverability without IP warmup overhead
- Mature SDK and APIs
- Multiple EU regions with strong jurisdiction profile
- VDM (Virtual Deliverability Manager) provides built-in analytics

*Negative:*
- SES account suspension is catastrophic and account-wide
- AWS is a US-headquartered subprocessor (DPF-mitigated but not eliminated)
- Region capacity ceilings require explicit increase requests
- Less control over IP pool reputation than self-hosted

*Reviewed when:*
- Customer volume exceeds 50M emails/month per tenant (then BYO-SES or dedicated infrastructure)
- Schrems III invalidates DPF (then evaluate EU-native MTAs like PowerMTA on Hetzner)

---

## ADR-002: Hono on Node.js as the API framework

**Status:** Accepted

**Context:**
The API layer must handle high request volume, be edge-deployable for future expansion, and have an ecosystem that supports email-specific libraries (React Email, MJML, mailparser). Candidate stacks: Hono on Node, Fastify on Node, Echo on Go, Phoenix on Elixir, Axum on Rust.

**Decision:**
Hono on Node.js 22 LTS with TypeScript 5.5+ strict mode.

**Consequences:**

*Positive:*
- Founder fluency in TypeScript
- Excellent DX (Hono's API is minimal and type-safe)
- ~60k req/s on a single node (more than enough at our scale)
- React Email and MJML compile natively in Node
- Easy hire/contractor market in Node
- Optional future edge deployment (Cloudflare Workers, Bun)

*Negative:*
- Slightly slower than Go/Rust at high concurrency (acceptable below 100k req/s)
- Node's single-threaded model requires clustering at scale (PM2 or native cluster)
- npm dependency tree adds supply-chain surface

*Rejected alternatives:*
- **Go (Echo/Fiber):** faster and cheaper to run but adds friction for React Email rendering (would need a separate Node service anyway)
- **Elixir (Phoenix):** elegant for fan-out but small hiring pool, founder less fluent
- **Rust (Axum):** premature optimization for v0
- **Fastify:** equally good but Hono has better TypeScript support and edge runtime story

---

## ADR-003: BullMQ on Redis for queueing

**Status:** Accepted

**Context:**
Send pipeline must decouple API acceptance from actual SES delivery for: retries, rate limiting, scheduled sends, backpressure during SES throttling. Options: BullMQ (Redis), AWS SQS, RabbitMQ, NATS JetStream.

**Decision:**
BullMQ on Redis 7 for both send queue and webhook delivery queue.

**Consequences:**

*Positive:*
- De-facto Node standard with excellent dashboards (Bull Board, Taskforce)
- Supports delayed jobs natively (for scheduled_at)
- Single moving part (Redis serves cache + queue)
- Easy local development
- Mature retry/backoff primitives

*Negative:*
- Redis durability is weaker than SQS (AOF + replication mitigate)
- Single point of failure unless Redis is HA from day 1 (acceptable risk in v0)
- Scaling beyond ~10k jobs/sec may require sharding

*Rejected alternatives:*
- **AWS SQS:** cheaper at high scale but ties us further to AWS, higher latency for queue operations
- **RabbitMQ:** more operational overhead for a solo founder
- **NATS JetStream:** elegant but smaller Node ecosystem

---

## ADR-004: PostgreSQL as the primary database

**Status:** Accepted

**Context:**
Need a primary database for tenants, messages, events, suppressions, templates, webhooks. Workload is mixed OLTP (sending) and analytical (dashboard queries). Candidates: PostgreSQL, MySQL, CockroachDB, DynamoDB.

**Decision:**
PostgreSQL 16 with monthly partitioning on `messages` and `events` tables.

**Consequences:**

*Positive:*
- Industry standard with excellent tooling
- JSONB for event payloads (avoids schema migrations for new event types)
- Native partitioning for time-series data
- Row-level security for tenant isolation
- CITEXT for case-insensitive email addresses
- Strong consistency

*Negative:*
- Partitioning requires operational discipline (cron to create future partitions, drop old ones)
- Horizontal scaling requires explicit sharding or Citus

*Hosting decision:*
- **v0 (0–1,000 customers):** Neon EU (Frankfurt) for branching and managed ops
- **Scale (>1,000 customers):** Self-host on Hetzner CCX with daily backups to object storage. Cost crossover ≈ 3,000 customers.

---

## ADR-005: Pay-as-you-go pricing at €0.40 per 1,000 emails

**Status:** Accepted

**Context:**
Existing wrappers price as flat subscriptions (Resend $20/mo for 50k, Postmark $15/mo for 10k, Lettermint €10/mo for 10k). This creates arbitrage between SES base cost ($0.10/k) and customer-facing price. Customer research and competitor analysis (see research artifact) shows price-sensitive EU buyers prefer transparent unit economics.

**Decision:**
- Free tier: 3,000 emails/month, 100/day cap
- Pay-as-you-go: €0.40 per 1,000 emails
- Optional prepaid credit packs at 5/10/15% discount
- BYO-SES: €9/project/month flat

**Consequences:**

*Positive:*
- Predictable for customers (no tier surprises)
- ~60% gross margin (€0.40 retail − €0.16 COGS = €0.24/k)
- Beats Resend ($0.40/k effective at 50k tier) at every volume
- Differentiates from subscription competitors

*Negative:*
- Lower revenue per low-volume customer (a 1k/mo sender pays nothing vs Resend's $20)
- Cannot bundle "premium features" into a tier
- Stripe metering costs slightly more than flat-fee billing

*Reviewed when:*
- ARPU drops below €5/mo on average → introduce optional plan with bundled features
- Resend or AhaSend matches our price → emphasize BYO-SES SKU more aggressively

---

## ADR-006: EU-only data residency, accept AWS as DPF subprocessor

**Status:** Accepted

**Context:**
Three positioning options for EU compliance:
1. "Pure EU" (no US subprocessors, no SES) — requires self-hosted MTA
2. "EU control plane + EU sending via DPF-certified subprocessor" (SES)
3. "Multi-region" (no EU promises) — like Resend

**Decision:**
Option 2: EU control plane on Hetzner, SES sending in EU regions, AWS documented as DPF-certified subprocessor.

**Consequences:**

*Positive:*
- Lowest cost (SES is the cheapest sending option)
- Defensible legal position: EU General Court upheld DPF in Case T-553/23 (Latombe v Commission, 3 Sep 2025)
- Architectural option to swap SES later if needed
- Honest positioning vs Lettermint's "no US providers" which forecloses SES

*Negative:*
- Cannot claim "no US company ever touches your data"
- Schrems III is a 2–3 year horizon risk
- Requires careful messaging to avoid GDPR theater accusations

*Mitigation:*
- Pre-write transfer impact assessment
- Architect for SES swap (queue and event abstractions, not direct SES calls in business logic)
- Customer data + email logs in EU only (Hetzner + Hetzner Object Storage); SES only sees in-flight email

---

## ADR-007: Per-tenant SES configuration sets (shared SES account)

**Status:** Accepted

**Context:**
SES sending can be organized in three ways: (a) shared AWS account + shared config set, (b) shared AWS account + per-tenant config set, (c) separate AWS accounts per tenant. Each has tradeoffs for reputation isolation, complexity, and operational overhead.

**Decision:**
Shared AWS account with per-tenant configuration sets in v0. Move large tenants (>1M emails/month) to isolated AWS accounts in v2.

**Consequences:**

*Positive:*
- Single AWS account to manage in v0–v1
- Per-tenant event destinations (SNS topics) for isolation
- Per-tenant dedicated IPs available when needed
- Reputation tracking per config set via SES VDM

*Negative:*
- One tenant's complaint spike can affect overall account reputation
- Auto-quarantine logic must be aggressive (kill switch at 0.2% complaint rate)
- Future migration of large tenants to separate accounts requires data path changes

*Mitigation:*
- VDM Optimized Shared Delivery enabled by default
- Dedicated IPs offered at €40/month above 100k/month volume
- Automated kill switch + manual review queue ready before public launch

---

## ADR-008: Build BYO-SES as a first-class product

**Status:** Accepted

**Context:**
No competitor offers a clean way for customers to use their own SES account. AWS Console is operationally painful; Resend, Postmark, Lettermint, AhaSend, MailPace all force customers onto their SES account. Customers with AWS credits, Reserved Capacity, or Enterprise Support are locked out.

**Decision:**
Offer BYO-SES as a paid SKU at €9 per project per month. Customer provides scoped IAM credentials; Postly handles dashboard, suppression, webhooks, templates, deliverability monitoring. AWS bill goes directly to customer.

**Consequences:**

*Positive:*
- Unique differentiator no major competitor offers
- High-margin SKU (near-zero marginal cost per email)
- Attracts technical customers who would otherwise build their own
- Sticky: customers won't churn to a competitor who can't offer this
- Demonstrates honesty about our role (we're a wrapper, here are the tools)

*Negative:*
- Encryption + key management complexity (libsodium + KMS-equivalent)
- Customer's AWS quota issues become support burden (must document escalation clearly)
- Cross-account assume-role would be cleaner than IAM keys but adds setup friction (defer to v1)

*Implementation notes:*
- Validate credentials with GetSendQuota on save
- Periodic health check every 6 hours
- IAM policy template provided in docs (minimum scope: SendEmail, SendRawEmail, GetSendQuota, GetIdentityDkimAttributes)
- v1: switch to cross-account assume-role for better security posture

---

## ADR-009: React Email + MJML + raw HTML as supported template formats

**Status:** Accepted

**Context:**
Template input format choices: raw HTML only (simplest), MJML (responsive but learning curve), React Email (modern DX but Node-only), Liquid (Shopify-style), all of the above. Compiling React server-side requires bundling the React runtime in our process.

**Decision:**
Support three input formats: raw HTML, MJML (server-compiled), and pre-compiled React Email output. Provide a Node CLI (`postly compile`) that converts React Email .tsx files to HTML for customers who want to author in React.

**Consequences:**

*Positive:*
- Customers can use the tool they already have
- React Email integration appeals to React/Next.js customers (Resend's main audience)
- MJML covers PHP/Laravel/Python users who don't want React
- Raw HTML is the escape hatch

*Negative:*
- Three rendering paths to maintain
- MJML compilation is CPU-intensive (offload to separate render worker)
- React Email's design system updates require us to track versions

*Implementation:*
- Render worker is a separate BullMQ consumer (isolated dep tree)
- Templates stored as source + compiled HTML (latter regenerated on read if source changes)

---

## ADR-010: Webhooks signed with HMAC-SHA256 in Stripe-style header

**Status:** Accepted

**Context:**
Webhook security options: shared secret in body, HMAC signature in header, mTLS, OAuth2 client credentials. Different providers use different conventions (Stripe: timestamp + sig, GitHub: HMAC in X-Hub-Signature, Resend: similar to Stripe).

**Decision:**
HMAC-SHA256 signature in `X-Postly-Signature: t=<unix_ts>,v1=<hex>` header. Verification helper included in every SDK. Webhook secret shown once at creation, encrypted at rest.

**Consequences:**

*Positive:*
- Standard pattern customers already know from Stripe
- Includes timestamp to prevent replay attacks
- Versioned (`v1=`) for future algorithm changes
- Easy to verify in any language

*Negative:*
- Requires customers to verify (some won't, accept this risk)
- Clock skew between Postly and customer can cause false negatives (5-minute tolerance)

---

## ADR-011: Hetzner for compute, not a managed PaaS

**Status:** Accepted

**Context:**
Deployment options: managed PaaS (Railway, Fly.io, Render), Kubernetes (EKS, GKE, self-managed k3s), VPS providers (Hetzner, OVH, Scaleway), bare metal. EU-incorporated providers are preferred for GDPR positioning.

**Decision:**
Hetzner (German GmbH, EU-incorporated) for compute. Deploy via Docker Compose initially, migrate to Coolify or k3s at scale.

**Consequences:**

*Positive:*
- EU-incorporated, strong jurisdiction
- Lowest cost (€8/mo CX22, €25/mo CPX31, €60/mo CCX23)
- Reliable track record
- Helsinki location is geographically eu-north-1 equivalent (Stockholm-adjacent)
- April 2026 price hike of 30–37% acknowledged but still cheaper than managed PaaS

*Negative:*
- Operational overhead (we manage servers)
- No managed Postgres on Hetzner (use Neon EU or self-host)
- Solo founder dependency on infrastructure operability

*Reviewed when:*
- Hetzner repeats April 2026 price hike → consider OVH, Scaleway, UpCloud
- Founder bandwidth becomes blocker → managed PaaS (Sliplane, Northflank EU)

---

## ADR-012: Cloudflare in front of public endpoints

**Status:** Accepted

**Context:**
Edge layer for DDoS protection, WAF, rate limiting, TLS termination, caching of static assets. Options: Cloudflare, Fastly, Bunny.net (EU-based), bare nginx.

**Decision:**
Cloudflare in proxy mode (orange cloud) for all public endpoints including API. Allow customers to bypass via direct DNS for the rare "we cannot use any US infrastructure" customer.

**Consequences:**

*Positive:*
- Free tier covers v0 needs (WAF, DDoS, rate limiting)
- Industry-standard edge protection
- Bot Fight Mode helps with signup abuse
- Page Rules for caching docs site

*Negative:*
- US-incorporated company (similar DPF/SCC position as AWS)
- Some EU customers may object on principle
- Cloudflare outages affect availability

*Mitigation:*
- Document Cloudflare as subprocessor
- Provide bypass option for special-case customers (direct DNS, accept-the-risk)
- Bunny.net (EU) as v1 alternative if customer demand justifies

---

## ADR-013: Idempotency keys with 30-day retention and request-body hashing

**Status:** Accepted

**Context:**
Idempotency is critical for transactional email — duplicate "password reset" emails are user-facing bugs. Existing services handle this poorly: Resend doesn't have it, Postmark added it recently with 24h retention, AhaSend has it but scoped narrowly.

**Decision:**
- All POST endpoints accept `Idempotency-Key` header
- Retention: 30 days (industry-leading)
- Collision detection via SHA-256 hash of request body
- Same key + same body → return cached response
- Same key + different body → 409 Conflict with `idempotency_conflict` error
- Cleanup job runs hourly to expire old keys

**Consequences:**

*Positive:*
- Survives crashes, retries, and at-least-once delivery semantics
- 30-day window beats every competitor
- Marketing point: "Idempotency that actually works"

*Negative:*
- Storage cost: ~1KB per request, 30 days × 100M req/month = 3TB (acceptable)
- Slight write overhead on every POST

---

## ADR-014: Open-core question deferred

**Status:** Open / Deferred

**Context:**
Some EU customers strongly prefer open-source or self-hostable software for trust. Options: closed source, open core (free for self-host, paid hosted), fully open (AGPL).

**Decision:**
Closed source in v0–v1. Revisit at month 12 if: (a) self-hosted demand becomes a sales blocker, (b) we have bandwidth to maintain open-source community, (c) competitor moves first.

**Consequences:**

*Positive:*
- Faster iteration without community management overhead
- Simpler licensing
- No risk of competitors forking

*Negative:*
- Some customers will choose competitors purely on open-source preference
- Cannot claim full source transparency

---

## ADR-015: Defer SOC 2 / ISO 27001 to year 2

**Status:** Accepted

**Context:**
Compliance certifications are increasingly demanded in security questionnaires. ISO 27001 costs €15–25k. SOC 2 Type II costs €20k+. Both take 6–12 months.

**Decision:**
- Year 1: Self-attest GDPR compliance, publish security overview, lawyer-reviewed legal docs
- Year 2: ISO 27001 (start with Drata/Vanta for evidence collection)
- Year 3+: SOC 2 Type II if US/UK expansion warrants

**Consequences:**

*Positive:*
- Saves €15k+ in year 1
- Allows founder bandwidth for product

*Negative:*
- Cannot serve customers requiring ISO 27001 (regulated industries, enterprise procurement)
- Lose deals to competitors with cert

*Mitigation:*
- Document "ISO 27001 in progress" once Drata/Vanta engagement starts
- Provide a security questionnaire prefill (CAIQ-Lite, SIG Lite)

---

## ADR-016: The product name is decided before the first production resource

**Status:** Accepted

**Context:**
"Postly" has been a working name since the PRD (`01-PRD.md`: "placeholder — final name TBD"). It is already load-bearing in code and contract: the `@postly/*` packages, the `X-Postly-Signature` header, the `pst_` key prefix, `api.postly.eu` in the API Contract, the database name in development. BenboStandard's `NEW-PROJECT.md` ("name things once") records what a late rename costs: Braleads.ai still answers to three names in production because renaming was cheaper to avoid than to finish. Here, a published SDK and signed webhooks make the name part of what customers integrate against.

**Decision:**
The final name is chosen before any of these exist: the production database, the production domain and its DNS, a published SDK or CLI package, the GHCR image name, or the first customer integration. Until then the working name stays and no new identifiers are added that embed it where a neutral one would do. The rename is a launch gate in `DEPLOY.md`.

**Consequences:**

*Positive:*
- The rename is a global search-and-replace in one repository, not a migration across customers' code
- The deadline is concrete, so the decision cannot drift past launch by default

*Negative:*
- Launch waits on a naming and domain decision that is not engineering work
- Work done before the decision still says "Postly" and must be revisited

---

## ADR-017: pnpm workspaces and Turborepo

**Status:** Accepted

**Context:**
The repository was bootstrapped as a pnpm workspace with Turborepo (`CLAUDE.md` said "decide in ADR"; no ADR was written). BenboStandard (`standard/03-ci.md`) chooses npm for new projects, and states that existing pnpm and bun projects are not rewritten; its shared workflows take a `package-manager` input for that reason.

**Decision:**
Keep pnpm (version pinned by `packageManager` in `package.json`) and Turborepo. One lockfile, `pnpm-lock.yaml`. CI calls BenboStandard's `node-ci.yml` with `package-manager: pnpm`.

**Consequences:**

*Positive:*
- No migration of a working seven-package workspace
- Turborepo caches per package; root files that affect every package (`eslint.config.mjs`, `tsconfig.base.json`) are declared as `globalDependencies` so a change to them invalidates the cache

*Negative:*
- Postly differs from the estate's npm default
- pnpm 11 enforces a minimum release age for new versions; a dependency published in the last day cannot be installed without an exception, which should not be added

---

## ADR-018: Vite + TanStack Router dashboard instead of Next.js

**Status:** Accepted

**Context:**
Tech Spec §2 chose Next.js 15 for the dashboard. The dashboard and marketing site were instead built in Lovable, which exports a Vite + TanStack Router + React 19 single-page application. Commit `b09deac` replaced the Next.js dashboard with that export and wired it to the API. No ADR recorded the change.

**Decision:**
The dashboard (and the marketing pages, which live in the same app, not in `apps/marketing/`) is a static Vite SPA. It calls the API under `/api` on its own origin, so the session cookie stays first-party with `SameSite=Lax`. In development the Vite proxy strips the prefix; in production a reverse proxy must do the same (ADR-019).

**Consequences:**

*Positive:*
- The Lovable design is used as exported
- Static output: no Node server for the dashboard in production

*Negative:*
- No server-side rendering for the marketing pages
- Production needs a reverse-proxy rule the dev proxy currently hides

---

## ADR-019: Deployment follows BenboStandard archetype D

**Status:** Accepted

**Context:**
ADR-011 chose Hetzner compute with Docker Compose, and ADR-004 Neon EU for Postgres in v0. BenboStandard (`standard/01-archetypes.md`) defines archetype D, a container on a machine we control, and the pattern its projects deploy with. It also says paying customers get managed Postgres with point-in-time recovery, which Neon provides.

**Decision:**
Postly is archetype D on a Hetzner VM (refines ADR-011):
- One image for the API and the workers, built in CI, tagged with the commit SHA, published to GHCR, Trivy-scanned. Production runs the SHA tag recorded as `APP_IMAGE` in the host's `.env`, never `latest`.
- A self-hosted GitHub runner on the VM (label `postly-prod`) deploys; nothing connects in and no deploy credential is stored.
- `docker-compose.yml` at the root runs `migrate` (Drizzle migrations, to completion) before `api` and `workers`, and Redis with `noeviction`.
- PostgreSQL is Neon EU (ADR-004), with its point-in-time recovery. A restore is rehearsed and timed before launch.
- The dashboard's static build is a CI artifact served by the host's nginx, which also proxies `/api/` to the API (the invelle pattern).
- The deploy is gated on `/health`, which reports on the database, Redis, the workers' heartbeat and the queues.
- `deploy.yml` is written when the VM and runner exist, not before.

**Consequences:**

*Positive:*
- The same pattern as the rest of the estate: one place to look, reusable workflows, monitored by benbo-infra's estate check
- No stored credential for deploys

*Negative:*
- A single VM: the 99.9% SLA in the PRD depends on one machine until there is a second
- Tech Spec §10.1's blue/green and `node-pg-migrate` are superseded; a compose restart has a few seconds of downtime

---

## ADR-020: Own delivery infrastructure with KumoMTA, no Amazon SES

**Status:** Accepted (2026-09-19). Supersedes ADR-001, ADR-007 and ADR-008, and the AWS half of ADR-006.

**Context:**
ADR-001 chose SES because running our own MTAs meant port 25 restrictions and months of IP warm-up. That made Postly a control plane in front of Amazon: every email transited a US-headquartered subprocessor (ADR-006), the positioning rested on SES price arbitrage (ADR-005), and the business was one SES account suspension away from stopping. ADR-006 itself listed "Pure EU, self-hosted MTA" as option 1 and "Schrems III" as the trigger to revisit. The founder decided on 2026-09-19 that Postly is not an Amazon wrapper, and takes option 1 now rather than as a contingency.

Writing an MTA from scratch was considered and rejected for now: per-destination connection limits, retry classification, a crash-safe spool, TLS policy, provider throttling and IP pool routing are months of work, and their failures are silent (mail accepted, then junked or throttled) and damage IP reputation for every customer. [KumoMTA](https://github.com/KumoCorp/kumomta) is an Apache-2.0 MTA in Rust built for high-volume senders by the architect of Momentum, with scriptable policy (Lua), an HTTP admin API, bounce classification and traffic-shaping rules for the large mailbox providers.

**Decision:**
- Postly delivers its own mail through self-hosted KumoMTA in the EU. No AWS in the sending path; BYO-SES is dropped.
- Postly owns everything customer-facing: the API, tenant isolation, per-domain DKIM keys (generated by Postly, RSA-2048, private keys encrypted at rest), suppression, bounce and complaint handling, webhooks and reputation protection. KumoMTA only moves bytes to receiving servers.
- The workers talk to a `DeliveryEngine` interface; `KumoEngine` injects over SMTP on the private network. Replacing KumoMTA with our own engine later means a new adapter, not a rewrite.
- Delivery events come back through a KumoMTA log hook to an internal, token-protected endpoint. Asynchronous bounces and ARF feedback reports are received by KumoMTA on a return-path domain and correlated through a VERP envelope sender.
- Open and click tracking are not offered at launch.

**Consequences:**

*Positive:*
- No US subprocessor in the sending path: customer data and email stay in the EU end to end
- No single vendor can suspend the business
- Full control over IP pools, shaping, bounce policy and data retention
- A positioning competitors built on SES cannot copy without rebuilding

*Negative:*
- IP reputation is ours to build: sending IPs start with none, and warm-up takes 4–8 weeks of gradually increasing real traffic
- Port 25: Hetzner blocks it by default and decides unblocking case by case after a month and a paid invoice. Where the sending IPs live is a launch decision (issue #11)
- One abusive customer can damage shared IPs, so reputation protection (per-tenant limits, automatic pause) is required before the first customer
- Registration with Google Postmaster Tools, Microsoft SNDS/JMRP and Yahoo CFL, blocklist monitoring and a warm-up plan become operational work
- A second system to run (KumoMTA plus its traffic-shaping daemon) in a language (Rust, Lua config) the rest of the codebase does not use

*Reviewed when:*
- KumoMTA blocks a product need that its policy hooks cannot meet: write our own engine behind the same interface
- Volume justifies dedicated IP pools per large tenant

---

## ADR-021: Pricing without SES as the cost basis

**Status:** Accepted (2026-09-19). Supersedes the cost basis and the BYO-SES tier of ADR-005; the rest of ADR-005 stands.

**Context:**
ADR-005 derived €0.40 per 1,000 emails from SES's $0.10 per 1,000. Without SES the cost is mostly fixed: servers, sending IPs, monitoring. Market check on 2026-09-19, per 1,000 emails: Scaleway TEM €0.25 (EU, pay as you go), Resend Pro about $0.40 at full use of 50k then $0.80, Mailgun Foundation about $0.70 then $1.30, Lettermint €1.00 (€10 for 10k), Postmark $1.50.

**Decision:**
- Keep €0.40 per 1,000 emails, pay as you go, and the free tier of 3,000 per month capped at 100 per day.
- Remove the BYO-SES tier (€9/project/month).
- Dedicated IPs remain a paid add-on once there is a pool to offer them from.
- Revisit the price once real infrastructure costs are known, before public launch.

**Consequences:**

*Positive:*
- Competitive with every major provider except Scaleway, without a subscription
- The margin grows with volume instead of being a fixed markup on a vendor price

*Negative:*
- At low volume the fixed costs exceed revenue; the gross margin in ADR-005 no longer holds and is unknown until the infrastructure runs
- The free tier invites abuse, which now lands on our own IPs (see ADR-020)

*Reviewed when:*
- **A market check on 2026-09-26 found Sweego (France) at €0.20 per 1,000**, below Scaleway TEM's €0.25. The positive consequence above, "competitive with every major provider except Scaleway", no longer holds: €0.40 is now third cheapest of the EU providers we compare against. The decision itself stands, since it was never argued on being cheapest and the revisit is already tied to real infrastructure costs. What changed is the comparison it was argued against. The full field is in 04-GTM-Plan.md §3.

---

## ADR-022: Templates render in the send worker

**Status:** Accepted (2026-09-19). Supersedes the separate render worker in ADR-009; the formats in ADR-009 stand.

**Context:**
ADR-009 put rendering in a separate BullMQ consumer because MJML compilation is CPU-heavy. Nothing renders today: a send that references a template goes out with an empty body.

**Decision:**
- MJML compiles once, when a template version is created, and the result is stored as `compiled_html`.
- Variable substitution (Handlebars-compatible syntax, per the PRD) happens in the send worker, which is cheap once MJML is precompiled.
- `vars_schema` is validated when the send is accepted, so a bad payload fails with 422 instead of in the worker.

**Consequences:**

*Positive:*
- One fewer queue and process
- A template send is rendered from the version that was current when it was accepted

*Negative:*
- Heavy rendering would compete with sending in the same process. Split it out again if CPU becomes the bottleneck.

---

## ADR-023: Templates render when the send is accepted

**Status:** Accepted (2026-09-19). Supersedes where ADR-022 renders (the send worker); the rest of ADR-022 stands.

**Context:**
ADR-022 moved rendering from a separate worker into the send worker. Building it showed that rendering in the worker turns every template problem into an asynchronous failure: a missing template, a deleted version or variables that fail `vars_schema` would be accepted with 202 and fail later as `email.failed`. The message row would also carry the template slug as its subject until the worker ran.

**Decision:**
- The API resolves the version (`null` means the current one), validates the variables against its `vars_schema`, and renders subject, HTML and a derived plain-text part when it accepts the send. Problems are answered synchronously: 404 for an unknown template or version, 422 for variables that do not match.
- The rendered content is what is stored in `messages.payload` and delivered; the send worker never sees a template. An explicit `subject` on the send overrides the template's.
- MJML still compiles once, when a version is created (ADR-022), so rendering at accept time is only Handlebars substitution.
- `POST /v1/templates/:slug/preview` uses the same function, so a preview is exactly what a send would contain.

**Consequences:**

*Positive:*
- A template send that returns 202 has content that is known to render
- The stored subject and body are the ones delivered, which is what the dashboard and support need to see
- The worker stays template-agnostic

*Negative:*
- Rendering adds to the API's response time for template sends (Handlebars on precompiled HTML; small)
- A scheduled send renders when it is accepted, not when it goes out: editing the template afterwards does not change it. That is the same guarantee a pinned `version` gives, and is documented in the API Contract.

---

## ADR-024: Where the sending infrastructure runs, and whose IP addresses it sends from

**Status:** Accepted (2026-10-06). GleSYS, after they answered the four criteria below in writing. Refines ADR-011 for the sending side; Hetzner stays for the control plane.

**Context:**
ADR-020 moved delivery onto our own MTAs but deliberately left open where they run, and ADR-011 chose Hetzner for compute before there was any mail in the picture. Two questions were researched on 2026-09-20 and are recorded here so the decision is not re-derived from scratch.

*Outbound port 25 decides the provider.* What the providers document:

| Provider | Port 25 outbound | Own IPv4 announced (BYOIP) | EU-owned |
|---|---|---|---|
| Hetzner | Blocked by default. Cloud: request after ~1 month plus a paid first invoice, decided case by case. Dedicated: self-unblock in Robot after the same period | Only as BGP transit on colocation or bare metal, EUR 300 setup plus EUR 200/month, and it requires your own ASN | German GmbH, but the group rents US colocation |
| GleSYS | Nothing published, but **answered on 2026-09-29: "Alla portar är öppna och det finns ingen hastighetsbegränsning."** | Nothing published, but **answered: they announce a customer prefix without the customer holding an ASN, normally free** | Swedish, majority owner Cube Infrastructure Managers (Luxembourg) since 2023 |
| OVHcloud | **Open by default** on dedicated and VPS. Blocked on Public Cloud. Reactive antispam block with self-service unblock | Yes, documented and free, /24 to /19, on VPS, bare metal and public cloud. Ownership proven by a token in the whois object | Euronext Paris, Klaba family majority voting control |
| Scaleway | Blocked, self-service per security group, gated on identity verification rather than account age | No. Their FAQ states BYOIP is not available | ~96% Iliad SA, French |
| Elastx | Blocked platform-wide with no published unblock path. Their answer is their own relay product | Not documented | Swedish |
| Netcup | Blocked by a removable firewall policy, deleted by the customer, applies immediately | No. Staff answer in their own forum | netcup GmbH, part of Austrian Anexia |

Reputation cuts the other way from openness. OVH's AS16276 has been listed by UCEPROTECT level 3 since March 2021 and they refuse to pay for delisting; Spamhaus names both OVH and Hetzner among the networks hosting the most botnet C&Cs, and since February 2025 applies a Hetzner-specific error code to legacy DNSBL queries from their space. The Nordic providers have no published blocklist history at all, good or bad, which mostly reflects their size.

*What owning IP addresses actually buys.* Checked against vendor documentation rather than deliverability folklore:
- Spamhaus CSS, the automated list that reaches ordinary senders, lists single IPv4 addresses. Range and ASN escalation under SBL is triggered by operator negligence, and DROP with ASN-DROP targets criminal networks. A clean IP is not listed for being adjacent to a dirty one in any documented policy.
- Google documents reputation for IPs and domains only. The Postmaster API models unique IPs with no prefix or ASN object. Yahoo states reputation is per IP and per DKIM domain.
- Two real benefits do require holding the range: Spamhaus PBL self-management needs a /24 identifiable by whois or rDNS, and Microsoft SNDS needs a range you can prove you own, at most a /23. AWS says in its own documentation that it supplies SNDS data to SES customers with dedicated IPs precisely because those customers do not own the range.
- An ASN is not one of those benefits. RIPE policy requires the network to be multihomed and the request to name two peering partners with a routing policy in RPSL. Nothing Google, Microsoft or Spamhaus publishes rewards holding one. Among smaller senders the common pattern is a /24 registered in your own name with rDNS you control, announced inside someone else's ASN: Postmark inside Deft, Mailtrap and Purelymail inside AWS, MailerLite inside Google Cloud. ActiveCampaign has held AS395042 since 2016 and has never announced a prefix.

*What the addresses cost* (RIPE-848 and RIPE-867, market data 2026-09-19):
- RIPE LIR membership: EUR 1,000 to join, EUR 1,800/year in 2026, EUR 1,894 from 2027. No reduced category for small members; the category model was voted down in May 2026.
- The waiting list for a free /24 had 784 LIRs queued with the first having waited 484 days, and no guarantee of an allocation.
- Buying a /24 on the transfer market: roughly EUR 4,500 to 8,500 in the RIPE region, locked from onward transfer for 24 months.
- Leasing a /24: around EUR 89/month, which still needs a network willing to announce it.
- Renting a full /24 from Hetzner: EUR 659 setup plus about EUR 5,222/year, with no asset at the end. At launch we need two to four addresses, not 256.

**What GleSYS answered (2026-09-29 and 2026-10-06):**

Everything in the table above was absence of published policy. Asked directly, they answered all of it:

- **Port 25:** open by default, no rate limit on outbound SMTP. No request, no trust period, no exception for any product.
- **Own MTA:** permitted, "en egen SMTP-server, eller flera för den delen", with no volume or complaint thresholds beyond their general terms.
- **BYOIP:** they announce a customer-owned prefix over BGP without the customer holding an ASN, and "vi brukar göra detta gratis".
- **Dedicated prefixes:** 225 SEK/month for a /29, 450 SEK/month for a /28, on a KVM with dedicated addresses, plus dedicated /64s for IPv6. A customer /24 can be announced instead.
- **IP history:** the addresses they assign are **not listed in Spamhaus, which they guarantee**. Other blocklists are ours to check.
- **Abuse delegation:** they will point the abuse contact for our range at our own contact, and create the RIPE object for us at no cost. This is what makes Microsoft SNDS available without owning a /24.

Machine prices, for the cost model: 2 vCPU / 2 GB / 50 GB at 298 SEK/month, 2 vCPU / 4 GB / 50 GB at 472 SEK/month, 4 vCPU / 8 GB / 100 GB at 849 SEK/month.

**Decision:**
**GleSYS for the sending hosts and the sending IP addresses.** They are the only provider that passes all four criteria, and on port 25 and BYOIP they answer better than anyone else researched. The criteria, in the order they were applied:
1. **Outbound port 25 must be available without a smart host**, since a third-party relay in the send path would undo ADR-020. A provider that only offers its own relay is disqualified.
2. **The terms must permit a third-party MTA sending transactional mail for a SaaS**, confirmed in writing rather than inferred from silence.
3. **PTR must be self-service per IP**, ideally through an API, so FCrDNS can be automated.
4. **BYOIP must have a documented path**, because a provider that cannot announce our own /24 later closes off the second phase below before it starts.
5. Price and SLA decide only between providers that pass the first four.

Only GleSYS passed all four. OVH passes 1 and 4 but carries a UCEPROTECT-listed ASN; Scaleway and Netcup fail 4 outright; Elastx fails 1; Hetzner fails 1 at launch and makes 4 expensive. The sending setup is therefore 523 SEK/month (2 vCPU / 2 GB plus a /29) or 922 SEK/month (2 vCPU / 4 GB plus a /28), on top of the control plane that stays on Hetzner.

The IP strategy, which the evidence does settle:
- Rent two to four addresses at launch. Owning a range solves nothing that blocks going live, and a bought range is exactly as cold as a rented one.
- Lease or buy a /24 and have it announced under BYOIP when the first of these happens: a customer requires a dedicated IP, or the lack of PBL self-management or SNDS access becomes an operational problem.
- Do not acquire an ASN. Revisit only if a second transit relationship exists for other reasons.

**Consequences:**

*Positive:*
- The launch decision is reduced to four written questions to one provider instead of an open-ended comparison
- Owning addresses becomes a deliberate second phase with a stated trigger, not a prerequisite
- The research behind the choice is recorded, so a later reversal argues with the evidence rather than with memory

*Negative:*
- **None of what GleSYS answered is in their published terms.** It is an email from a named Customer Success Manager, consistent with their general terms (section 5.5 prohibits only spam) but not contractual. A change of personnel or policy would not breach anything. Keep the email.
- Their standard SLA is 99.3% uptime, against the 99.9% the PRD promises. 99.95% costs an extra EUR 234/month. That gap is not closed by this decision and is still a launch gate
- The estate is now split across two providers, Hetzner for the control plane and GleSYS for sending, which is one more account, one more invoice and one more support channel for a solo founder
- GleSYS managed Postgres has no point-in-time recovery, so this decision does nothing for the Neon question in Compliance §4

*Reviewed when:*
- GleSYS changes its port 25 position, or the answers above stop holding in practice
- Our announced space picks up an ASN-level listing
- Volume justifies buying a /24 and moving to the BYOIP phase

---

*New ADRs are added as numbered entries. Decisions are revised by superseding ADRs (e.g., ADR-016 supersedes ADR-005), not by editing past decisions.*
