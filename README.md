# Postly

A transactional email service, written from scratch, that delivers its own mail
instead of reselling somebody else's.

Most "email API" products are a nice interface in front of Amazon SES. This one
is not. It accepts an API request, stores it, queues it, signs it with a DKIM
key it generated for your domain, and hands it to its own MTA, which talks SMTP
to the recipient's mail server. Bounces and complaints come back on a
return-path subdomain and are correlated to the original message.

**This project is archived and unmaintained.** It was built to launch and never
did. It is published so the work is readable and reusable, under Apache-2.0. See
[Status](#status) for exactly what works and what does not.

---

## Why it might be worth your time

Not because it is finished. Because a few parts of it are the kind of thing that
is usually hidden inside a commercial product:

- **`docs/06-ADRs.md`** is twenty-four architecture decision records, each with
  the context, the decision, and the consequences including the bad ones. It
  records decisions being *reversed*: the whole product was rebuilt off Amazon
  SES partway through (ADR-020), rendering moved twice (ADR-022, then ADR-023
  superseding it), and the pricing basis was rewritten when its premise died
  (ADR-021). If you want to see what a real decision log looks like rather than
  a tidy one, start there.
- **Idempotency that survives a crash** (`apps/api/src/lib/idempotency.ts`):
  30-day key retention with request-body hashing, so retrying after a deploy
  returns the original send rather than sending twice.
- **Sender reputation protection** (`packages/shared/src/reputation.ts`):
  per-tenant sending limits, hard and soft bounces told apart, and automatic
  pausing when complaint or bounce rates cross published thresholds. On shared
  sending IPs this is what stops one customer ruining delivery for everyone.
- **DKIM key handling** (`apps/api/src/lib/dkim.ts`): a key generated per
  domain, private half encrypted at rest with AES-256-GCM, handed to the MTA
  over an internal endpoint.
- **The DNS records a sender actually needs** (`packages/shared/src/dns.ts`):
  DKIM, a return-path MX and SPF, and a recommended DMARC record, plus the
  verification that checks them the way the world sees them.

## The API

A send is accepted, stored and queued, and answered with 202 and an id. It is
never sent inline with the request.

```bash
curl -X POST https://api.example.com/v1/emails \
  -u "$POSTLY_API_KEY:" \
  -H "Idempotency-Key: invoice-2026-04-21-anna" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "billing@yourdomain.com",
    "to": ["anna@example.com"],
    "subject": "Invoice #2026-042",
    "html": "<p>Your invoice is attached.</p>",
    "tags": ["billing"]
  }'
```

```json
{
  "id": "msg_01HX8L4N0Q3R5S7T9V",
  "status": "queued",
  "to": ["anna@example.com"],
  "subject": "Invoice #2026-042",
  "created_at": "2026-09-19T12:00:00.000Z"
}
```

Sending that same `Idempotency-Key` again, even days later and across a deploy,
returns this same response rather than sending a second email.

The rest of the surface: `/v1/emails/batch`, cancel a scheduled send,
`/v1/domains` with DNS verification, `/v1/suppressions`, `/v1/templates`,
`/v1/webhooks` with replay, and `/v1/api-keys`.

**[`docs/openapi.json`](docs/openapi.json) is the full generated specification**,
and it is generated from the route definitions rather than written by hand, so
it cannot drift from the code. [`docs/03-API-Contract.md`](docs/03-API-Contract.md)
is the same surface in prose, with the error codes.

## What it looks like

The domain page, which is where the product is most itself: Postly generates the
DKIM key, and these are the records you publish to let it send for you.

![Domain detail page showing the DKIM TXT record, the return-path MX and SPF records, and a recommended DMARC record](docs/screenshots/domain-dns.jpg)

<details>
<summary>The dashboard overview and the message log</summary>

![Dashboard overview with sending stats, recent activity, domains and webhooks](docs/screenshots/overview.jpg)

![Message log showing delivered, bounced, failed and sent messages with recipient, subject and sender](docs/screenshots/messages.jpg)

</details>

## How it works

![Architecture: how a send travels from the API through the queue and the MTA to the recipient, and how delivery events come back](docs/architecture.svg)

## What it does

- REST API for sending: single, batch (up to 500), scheduled, and cancel.
- Domains: add a domain, get the DNS records, verify them.
- Templates: MJML compiled once at version creation, Handlebars variables
  validated against a schema when the send is accepted, so a broken template
  fails with a 422 instead of silently later.
- Suppressions, with automatic entries from bounces and complaints.
- Webhooks: HMAC-SHA256 signed, retried with backoff, replayable.
- A dashboard (also the marketing site) and a CLI.
- No open or click tracking, deliberately. There are no tracking pixels and no
  rewritten links, and there never were.

## Run it locally

Needs Node 22 (`.nvmrc`), pnpm (`corepack enable`) and Docker.

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d   # Postgres, Redis, Mailpit, KumoMTA
pnpm install
pnpm db:migrate
pnpm db:seed        # prints a dev API key; log in as reda@postly.dev / devpassword
pnpm dev            # API :3000, dashboard :5173, workers
```

Mail goes from the workers into KumoMTA on `127.0.0.1:2525`, which signs it with
the domain's DKIM key and delivers it to [Mailpit](http://localhost:8025).
Nothing leaves the machine. A new domain needs `pnpm cli domain:verify <domain>`
before it can send; in development the DNS lookup is skipped.

**If port 3000 is already taken**, three places have to agree, and exporting
`PORT` is not enough because the API starts with `tsx --env-file=.env`, which
overrides the environment:

1. `PORT=` in your `.env`,
2. the `proxy` target in `apps/dashboard/vite.config.ts`, which is hardcoded,
3. `PORT` in the shell before `docker compose up`, since KumoMTA calls the API
   back on `host.docker.internal:$PORT`.

**`pnpm db:seed` is not idempotent.** Running it a second time fails on a unique
constraint for the seed user. It is meant to be run once against an empty
database; drop and recreate, or skip it if you already have the dev account.

```bash
export POSTLY_API_KEY=pst_test_...  POSTLY_API_URL=http://localhost:3000
pnpm cli send --from hello@example.com --to you@example.com --subject Hi --text Hej
```

The checks CI runs:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Integration tests need real Postgres and Redis. They refuse any database not
named `*_test`, and Redis db 0, because they write rows and empty queues:

```bash
docker compose -f infra/docker-compose.yml exec postgres createdb -U postly postly_test
DATABASE_URL=postgresql://postly:postly@localhost:5432/postly_test \
REDIS_URL=redis://localhost:6379/15 pnpm test:integration
```

## Layout

```
apps/api           Hono REST API (/v1, dashboard endpoints, /health)
apps/workers       BullMQ workers: send, delivery events, webhook delivery
apps/dashboard     Vite + TanStack Router SPA: dashboard and marketing pages
apps/cli           the postly CLI
packages/db        Drizzle schema, migrations, migrator
packages/shared    Zod validators, constants, DNS and reputation logic
packages/sdk-node  the Node SDK
infra/             local development services only
deploy/kumomta/    KumoMTA policy (Lua)
docs/              PRD, Tech Spec, API Contract, GTM plan, compliance, ADRs
```

Postgres is the source of truth; Redis is only a work queue, and a sweeper puts
jobs back from Postgres if Redis loses them.

## Status

**Works end to end locally:** sending through the queue into the MTA, DKIM
signing, delivery events and bounces coming back, domains, suppressions, API
keys, webhooks with signed delivery and retries, templates with versions,
dashboard auth and pages, the Node SDK and the CLI. 98 unit tests across four
packages, plus integration tests against Postgres and Redis.

**Never done:**

- **Production sending.** It has never sent mail to a real recipient. Sending
  IPs, reverse DNS, the 4 to 8 week IP warm-up and feedback-loop registration
  with the mailbox providers were all still ahead. This is the hard part of the
  business and none of it was done.
- **Billing.** No Stripe, no metering of real money.
- **Inbound parsing**, planned, never started.
- **Alerting.** Reputation problems are logged, nothing pages anyone.
- `cli` and `db` have no tests, and there are no end-to-end tests.
- The marketing copy in `apps/dashboard` describes CLI commands that were never
  built (`postly init`, `postly logs --tail`, `postly migrate --from`). The real
  command list is in `apps/cli/src/index.ts`.

**Also note:** `docs/` is the planning record of a commercial product that never
launched, including a go-to-market plan and competitor pricing. It is honest
about what was not working, which is why it is still here, but it describes
intentions rather than reality. `CLAUDE.md` is the instruction file the project
was built with, and it refers to a private issue tracker you cannot open.

## Forking it

The licence is Apache-2.0: do what you like, including commercially, keep the
notice. There is no trademark grant for the name, so if you ship something,
call it something else. "Postly" was a working name anyway and it is load
bearing in the code, in `@postly/*` package names, the `X-Postly-Signature`
header and the `pst_` key prefix.

Two things to know before you build on it:

1. **The delivery engine is swappable by design.** The workers talk to a
   `DeliveryEngine` interface and the KumoMTA implementation injects over SMTP.
   Pointing it at a different MTA, or at a hosted provider, is a new adapter and
   not a rewrite.
2. **Running your own MTA is the easy half.** Port 25, IP reputation, warm-up
   and staying off blocklists are the hard half, and this repository does not
   solve them for you.

No issues or pull requests are being monitored. Fork it rather than wait.

## Licence

Apache License 2.0. See [LICENSE](LICENSE).
