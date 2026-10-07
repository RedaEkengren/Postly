# CLAUDE.md

Read automatically by Claude Code at the start of every session: the project
context, what is load-bearing, and the rules to follow. Not a duplicate of the
README, which says what Postly is and how to run it.

---

> **Note for readers of the public repository.** This file is the instruction
> file the project was built with, kept as-is because it records how the work
> was actually organised. It refers throughout to a private issue tracker and to
> BenboStandard, an internal conventions repository. Neither is public, so those
> references are dead. Everything about the code itself still applies.

## Start here: the pre-launch epic

All pre-launch work was tracked in a private GitHub repository: epic #2, one
issue per phase (#3 docs, #4 to #10 phases A to G), launch gates in #11,
milestone "Launch". Work began each session by reading the epic and the open
phase issue, ticking checkboxes as work landed. One PR per phase; green CI
before squash-merge.

## Project: Postly

Postly is a transactional email API for European developers that delivers its own mail from the EU: nobody but Postly accepts, signs, queues or delivers it, and no email provider sits in between (ADR-020, decided 2026-09-19). See rule 1 below before writing the broader claim. Pay-as-you-go pricing (€0.40 per 1,000 emails, 3,000 free per month; ADR-021). BYO-SES was dropped.

**Current state:** own delivery is built (#6). The send worker injects into KumoMTA through the `DeliveryEngine` interface (`apps/workers/src/delivery/`); KumoMTA signs with the domain's DKIM key and reports outcomes back. In development everything is delivered to Mailpit. What is not built is the production sending infrastructure itself: IPs, PTR, warm-up (#11).

**Working name:** Postly. The final name is still open and must be decided before the first production resource (ADR-016). Do not spread the name into new identifiers where a neutral one would do.
**Owner:** Reda (solo founder, Swedish AB to be incorporated)
**Stage:** Pre-launch, nothing deployed. **Archetype D** in BenboStandard's terms (ADR-019).

## Part of the Benbo estate

Postly follows [BenboStandard](https://github.com/Benbo-se/BenboStandard), the engineering handbook for all Benbo repositories, and is registered in [benbo-infra](https://github.com/Benbo-se/benbo-infra)'s `registry.yml`. Read BenboStandard's `CLAUDE.md` and `NEW-PROJECT.md` before changing CI, deployment, backups or repository layout. Where this file and BenboStandard disagree, BenboStandard wins unless an ADR here says otherwise (ADR-017: pnpm instead of npm).

Server configuration (Ansible) and GitHub/Cloudflare Terraform live in benbo-infra, not here. KumoMTA's policy (Lua and TOML) will live in this repository under `deploy/kumomta/`, because it is Postly's delivery logic, not generic server setup.

## Read first, every session

1. `/docs/01-PRD.md` — what we're building and why
2. `/docs/02-Tech-Spec.md` — architecture and stack decisions
3. `/docs/03-API-Contract.md` — public API surface (this is the contract)
4. `/docs/06-ADRs.md` — architectural decisions with rationale (do not violate without writing a new ADR)

If the user asks about compliance, also read `/docs/05-Compliance-Checklist.md`.
If the user asks about positioning or copy, also read `/docs/04-GTM-Plan.md`.
For anything about deployment, read `DEPLOY.md`.

## Technology stack (do not deviate without ADR)

- **Language:** TypeScript 5.5+, strict mode
- **Runtime:** Node.js 22 LTS (`.nvmrc`)
- **API framework:** Hono
- **Queue:** BullMQ on Redis 7
- **Database:** PostgreSQL 16 via Drizzle (Neon EU for v0, ADR-004)
- **Frontend:** Vite + TanStack Router + React 19 + Tailwind v4 + shadcn/ui, exported from Lovable (ADR-018)
- **Email engine:** self-hosted [KumoMTA](https://github.com/KumoCorp/kumomta) `2026.06.23`, behind a `DeliveryEngine` interface (ADR-020). Policy in `deploy/kumomta/`.
- **Auth:** session-based for the dashboard (no JWT), bcrypt-hashed API keys
- **Billing:** Stripe (primary), Mollie as fallback adapter — not built
- **Observability:** Better Stack (EU) + Sentry (EU region) — not wired
- **Testing:** Vitest for unit, Playwright for e2e (none yet)
- **Linting:** ESLint flat config in `eslint.config.mjs` + Prettier (`.prettierrc`)
- **Package manager:** pnpm, pinned by `packageManager` (ADR-017), with Turborepo

If you need a library not listed, prefer one that is: maintained, EU-headquartered if equivalent, MIT/Apache licensed, no telemetry. Justify the choice in a comment.

## Repository layout

```
postly/
├── apps/
│   ├── api/                # Hono API: /v1, /auth, /dashboard, /health, /dev (development only)
│   ├── dashboard/          # Vite SPA: dashboard AND marketing pages (there is no apps/marketing)
│   ├── cli/                # postly CLI (commander)
│   └── workers/            # BullMQ workers: send, delivery events, webhook delivery
├── packages/
│   ├── db/                 # Drizzle schema (16 tables), migrations, runMigrations()
│   ├── sdk-node/           # @postly/node SDK
│   └── shared/             # Zod validators, constants (queue names, health keys)
├── docs/                   # PRD, Tech Spec, API Contract, GTM, Compliance, ADRs
├── infra/                  # local development services only (Postgres, Redis, Mailpit)
├── scripts/                # seed-dev.ts
├── .github/workflows/      # ci.yml only, until deploy.yml exists
├── Dockerfile              # one image, api + workers
├── docker-compose.yml      # the production stack
├── README.md  CLAUDE.md  DEPLOY.md  CHANGELOG.md  .env.example
```

Planned but not created: `packages/sdk-php`, `packages/ui`. Don't create empty placeholder directories.

## Architectural rules (non-negotiable)

These are baked into ADRs. Do not violate without first proposing a new ADR.

1. **No US company in the sending path** (ADR-020). No AWS, SES or other US sending service, ever. Cloudflare at the edge and Neon for Postgres are US companies that would see message content; both are open decisions in #11, and until they are settled nobody claims "no US company" in copy.
2. **Data residency:** all customer data, message content and sending in the EU. Mail leaves from Postly's own EU sending IPs.
3. **No JWT for dashboard auth.** Session-based cookies, HttpOnly, SameSite=Lax, Secure.
4. **API keys hashed at rest** with bcrypt. Show once, never retrieve.
5. **All POST endpoints support `Idempotency-Key` header** with 30-day retention.
6. **No PII in logs.** Redact recipient addresses to first-3-chars + domain in error logs (`apps/workers/src/lib/redact.ts`). Never log API key values, even prefixes.
7. **Webhooks signed with HMAC-SHA256** in `X-Postly-Signature: t=<ts>,v1=<hex>` format. Verification helper must ship in every SDK.
8. **Tenant isolation:** every query must scope by `tenant_id`. Use Postgres row-level security where feasible. A leaked tenant_id between users is a P0 bug.
9. **No telemetry calls to external services without user consent.** No Sentry capture of message bodies. No analytics on the dashboard.
10. **GDPR right-to-erasure:** any `DELETE /v1/account` must purge within 30 days, including object-storage MIME archives.

## Load-bearing

Things that are not obvious from the code and break something if moved:

- **`NODE_ENV` is required and decides behaviour.** `development` mounts `/dev/simulate-event` and auto-verifies domains; `production` issues `pst_live_` keys and sets `Secure` cookies; development also skips DNS lookups when verifying a domain. The API refuses to start without it, because an unset value used to mount `/dev` in production.
- **Workspace packages are bundled.** `@postly/db` and `@postly/shared` point `main` at TypeScript source; api and workers `tsup` configs bundle them (`noExternal`). Remove that and `node dist/index.js` fails with `ERR_UNKNOWN_FILE_EXTENSION`.
- **Queue names and health keys live in `@postly/shared`.** The API enqueues, the workers consume, and `/health` reads Redis keys the workers write. Change a name in one place only.
- **`/health` is the deploy gate and the monitor's input.** It is 503 when the database, Redis or the workers' heartbeat (90 s) is gone, and `degraded` when a job waits over 5 minutes or a queue fails 5 times in a row. The compose healthcheck and benbo-infra's estate check both read it.
- **Migrations run before the app.** `pnpm db:migrate` and the production `migrate` service run the same code (`apps/api/src/migrate.ts` → `runMigrations`). It creates the `citext` and `pgcrypto` extensions first; migration 0000 needs them.
- **The dashboard calls `/api` on its own origin.** Vite proxies it in development; production nginx must strip the prefix (ADR-018). The session cookie depends on it.
- **Redis must run with `maxmemory-policy noeviction`.** An evicted BullMQ key is a lost job.
- **KumoMTA calls the API on `/internal/*`** for DKIM keys (`/internal/dkim/:tenantId/:domain`) and to report delivery log records (`/internal/kumo/events`). Both require `INTERNAL_TOKEN`, which kumod reads from the same `.env`. Production nginx must never proxy `/internal`.
- **`DKIM_ENCRYPTION_KEY` encrypts every domain's private key.** Losing it means every customer re-publishing DNS. It belongs in the backup of secrets, not only in `.env`.
- **Messages are matched to KumoMTA records** by `meta.x_postly_message_id` (from the injected header) or, for asynchronous bounces, by the VERP envelope sender `b-<messageId>@<return-path domain>`. Only hard bounce classifications (`InvalidRecipient`, `BadDomain`, `InactiveMailbox`) and complaints suppress (`apps/workers/src/event/classify.ts`).
- **Webhook delivery refuses private addresses at connect time** (`publicOnlyLookup` in `@postly/shared`). Do not switch it back to `fetch`: that re-resolves the hostname after any check and follows redirects.
- **Templates render when a send is accepted** (`apps/api/src/lib/templates.ts`, ADR-023), not in the worker. MJML compiles once, when a version is created (`compiled_html`); a send and a preview both call `renderVersion`, which enforces `vars_schema`. The subject is rendered without HTML escaping and forced onto one line (header injection).
- **Reputation protection runs before every send and every 15 minutes.** `assertCanSend` (`apps/api/src/lib/limits.ts`) refuses a `paused` tenant (403 `tenant_paused`) and enforces the plan's daily/monthly caps (422 `quota_exceeded`); `suspended` is refused by auth for everything. The workers' `reputation` job pauses or suspends on the thresholds in `packages/shared/src/reputation.ts` (Tech Spec §8), writes `audit_log`, and suspends the tenant's queued mail in KumoMTA for 24 hours. Nothing un-pauses automatically: set `tenants.status = 'active'` by hand after reviewing, and delete the KumoMTA suspension (`GET/DELETE /api/admin/suspend/v1` on kumod) if it has not expired.
- **Domains are unique per tenant, not globally**, so the DKIM lookup is by tenant and domain.
- **Postgres is the source of truth, Redis only the work queue.** A message's content lives in `messages.payload` until it reaches a terminal status; the send job carries only `{ messageId, tenantId }`. Webhook deliveries keep their payload and attempt count on the row. The `maintenance` queue's sweeper (every minute) re-enqueues anything `queued`/`pending` whose job is gone, so losing Redis or a failed enqueue loses nothing. Delivery is at-least-once.
- **Workers claim before sending.** `claimMessage` sets `claimed_at` only if the message is still `queued` and unclaimed (or the claim is older than 15 minutes). A duplicate job is therefore a no-op. Release the claim before rethrowing a transient error, or the BullMQ retry finds it taken.
- **Idempotency is claimed inside the send transaction** (`apps/api/src/lib/send-email.ts`). A concurrent request with the same key blocks on the key's primary key, then replays the first response.

## Traps

- **Turbo caches lint.** Root files that affect every package (`eslint.config.mjs`, `tsconfig.base.json`) are in `globalDependencies`. A new root config file goes there too, or a change to it replays cached results.
- **pnpm 11 refuses versions published in the last day.** If an install adds a `minimumReleaseAgeExclude` entry to `pnpm-workspace.yaml`, revert it and pin the previous release instead.
- **`/home/reda/backups` is owned by root** on the server. Write pre-deploy dumps to `/home/reda/backups/postly`.
- **Local Node may not be 22.** `engines` does not enforce it; use the version in `.nvmrc`.
- **BullMQ rejects custom job ids containing `:`**. Webhook attempt jobs are `<deliveryId>_<attempt>`.
- **KumoMTA's Lua API is not what you guess.** JSON is `kumo.json_parse`/`kumo.json_encode` (not `kumo.serde.json_decode`); an empty Lua table serialises as a map, so a list option must never be `{}`; the stock `log_hooks:new_json` rejects with 500 and drops the record. Check names against `/opt/kumomta/share/policy-extras/*.lua` in the pinned image.
- **Node's `net.BlockList` treats `::ffff:0:0/96` as matching every IPv4 address.** IPv4-mapped addresses are unwrapped and checked as IPv4 instead (`packages/shared/src/ssrf.ts`).
- **`drizzle-kit generate` asks interactively** when a column could be a rename, and needs a TTY. Run it in a terminal and answer; do not hand-write the migration and snapshot.
- **Mailpit simulates SMTP errors** in development (`MP_ENABLE_CHAOS`): `curl -X PUT localhost:8025/api/v1/chaos -d '{"Recipient":{"ErrorCode":550,"Probability":100}}'`, and Probability 0 to turn it off. The triggers are top-level keys.
- **Every Redis call on the request path needs a timeout.** ioredis is configured with `maxRetriesPerRequest: null`, so a call waits forever while Redis is down (`apps/api/src/lib/with-timeout.ts`). The timeout only stops the waiting: ioredis keeps the command in its offline queue and runs it when Redis returns. Job ids equal to the row id make that late add harmless.
- **Pagination cursors carry `created_at` as Postgres text**, with microseconds. A JS `Date` rounds to milliseconds and would skip or repeat rows.
- **The OpenAPI spec is generated from the routes.** Every /v1 route is a `createRoute` with request and response schemas (`apps/api/src/openapi/common.ts` has the building blocks); `c.json(body, status)` is type-checked against them, so always pass the status. The spec is served at `/v1/openapi.json`, and `docs/openapi.json` is a reviewed snapshot: a test fails when they differ. After an API change, run `pnpm --filter @postly/api openapi:write` and commit the diff with the change.
- **Integration tests refuse real data**: `DATABASE_URL` must name a `*_test` database and `REDIS_URL` a numbered db other than 0. They run one package at a time (`--concurrency=1`) because they share queues.
- **Turbo passes only declared env vars.** `test:integration` lists `DATABASE_URL` and `REDIS_URL` in `passThroughEnv`; a new variable a task needs goes there too.

## Deliberately not done

- **`deploy.yml`**: no server exists. A deploy workflow that cannot run reads as if it could (BenboStandard 03). The CI image job builds and scans with `push: false` until then.
- **Renaming "Postly"**: waiting on the name decision (ADR-016).
- **nodemailer 10**: a TypeScript rewrite two weeks old at the time; 9.1.1 fixes the advisories.
- **Open and click tracking**: not at launch (PRD §10). The `tracking` field is removed from the API in phase E.
- **Writing our own MTA**: KumoMTA first; the adapter makes a home-grown engine possible if KumoMTA ever blocks a real need.

## Known deviations

- Errors are RFC 7807-shaped but sent as `application/json`, not `application/problem+json`.

## Code style

- TypeScript strict mode, no `any` without an inline comment justifying it
- Functions named `verbNoun` (e.g., `sendEmail`, `validateDomain`)
- React components in PascalCase, files match component name
- Constants in `SCREAMING_SNAKE_CASE`
- No default exports for components (named exports only)
- Zod for all external input validation (API requests, env vars)
- Drizzle for all DB access — no raw SQL except in migrations and the migrator
- Async/await everywhere, no `.then()` chains
- Error handling: throw typed errors, catch at the boundary (route handler), return RFC 7807 problem details
- Comments only when intent isn't obvious from the code; prefer better naming over comments
- No dead code, no commented-out blocks. Delete it; git has memory.

## Git conventions

- Branch naming: `feat/<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`, `docs/<short-desc>`
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`)
- Each commit passes lint + typecheck + tests. CI checks every push and pull request.
- Squash before merging to main (PRs are rebased + squashed)
- Never force-push to main

Commit trailers:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: <the session URL>
```

## Working with Reda

- **Conversation in Swedish. Everything committed is in English** — code, comments, docs, commit messages.
- **Reda is learning.** Explain the mechanism, not just the conclusion. Say what a term means the first time it appears. Never talk down. (Same rule as BenboStandard.)
- **Be direct.** Skip preambles. Skip "I'll do X, Y, Z" announcements unless plans matter for review.
- **Push back when you disagree.** If a request violates an ADR or BenboStandard, or is a bad idea, say so before doing it.
- **Verify before claiming.** Check, then say. Say plainly when you were wrong.
- **Time zone:** Europe/Stockholm. Use 24h time and ISO dates in code.
- **Currency in code:** store as integer cents/öre (smallest currency unit) in DB; format for display.

## Things to never do without asking

- Run `git push --force` on any branch
- Delete files or directories outside the project (or inside `.git`)
- Commit `.env` files or anything in `.gitignore`
- Add a new external service / SaaS / SDK without checking ADRs
- Make schema migrations that destroy data without a confirmation prompt
- Send actual emails from non-test code paths
- Send real mail from development: all local delivery goes to Mailpit
- Reintroduce AWS, SES or any US sending service (ADR-020)
- Run `pnpm install` for an unmaintained / deprecated / single-maintainer package without flagging
- Modify ADRs after they're accepted — supersede with a new ADR instead
- `terraform apply` or run Ansible against a real host (those live in benbo-infra, with its own rules)

## Always do

- Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` before declaring something done
- Write a test if you fix a bug
- Update the OpenAPI spec when you change the API contract (once it exists)
- Update `docs/06-ADRs.md` when you make an architectural choice that wasn't previously decided
- Use environment variables for all secrets via the typed `env` modules, and add every new variable to `.env.example` in the same commit
- Keep functions under ~60 lines; if longer, ask whether to split
- Add a `CHANGELOG.md` entry for user-facing changes
- A change that makes `README.md`, `DEPLOY.md` or this file wrong fixes them in the same pull request

## Tooling shortcuts

- `pnpm dev` — API + dashboard + workers (turbo; the CLI is excluded)
- `pnpm db:migrate` — apply Drizzle migrations with the production migrator
- `pnpm db:seed` — dev tenant, user, API key, verified domain (once per database)
- `pnpm db:studio` — open Drizzle Studio
- `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build`
- `pnpm test:integration` — against a throwaway Postgres and Redis (see README)
- `pnpm cli <cmd>` — run the CLI locally (needs `POSTLY_API_KEY`, `POSTLY_API_URL`)

## What's built

See README.md *Status* for what works and what does not. In short: the `/v1`
API (emails, domains, suppressions, API keys, webhooks, templates, account),
the three workers, dashboard auth and pages wired to the API, `@postly/node`,
the CLI, CI, the container and a work-reporting `/health`.

## What's NOT built yet

The pre-launch plan, in order, is epic #2: correctness (#4), zod 4 and OpenAPI (#5), own delivery with KumoMTA (#6), template rendering (#7), the remaining contract endpoints (#8), reputation protection (#9), product copy (#10), and the launch gates outside the code (#11). After launch: billing (Stripe), inbound parsing, open/click tracking if ever.

## Conventions for ambiguity

When the spec is ambiguous:
1. Check if the API Contract, the ADRs or BenboStandard answer it
2. If still ambiguous, pick the simpler implementation and add a `TODO(reda):` comment
3. If the choice is architecturally significant, draft an ADR and ask Reda before committing

## On scope

This is a solo founder project. We optimize for:
- Shipping speed > "perfect" code
- Maintainability by one person > clever abstractions
- Reading RFCs and the KumoMTA docs > reinventing MTA primitives
- Boring tech > exciting tech
- Honest pricing > marketing tricks

When in doubt, do the smaller version first.
