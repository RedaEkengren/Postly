# Deploying Postly

**Nothing is deployed.** There is no server, no production database and no
domain. This file describes the path that is decided (ADR-019, BenboStandard
archetype D) and lists what has to be true before launch. Update it in the
same pull request that changes any of it.

## What exists today

| Piece | State |
|---|---|
| `Dockerfile` | Builds one image for the API and workers. Verified locally 2026-09-19. |
| `docker-compose.yml` | The production stack: `migrate`, `api`, `workers`, `redis`. Verified against local Postgres and Redis, not on a server. |
| `.github/workflows/ci.yml` | Lint, typecheck, test and build, plus an image build that fails on HIGH/CRITICAL Trivy findings. **The image is not published.** |
| `/health` | Reports database, Redis, worker heartbeat and queues. 503 when the database, Redis or the workers are gone. |
| `deploy.yml` | **Does not exist.** Written when the VM and runner exist. |

## How a change will reach production

```
push to main → ci.yml green → image ghcr.io/benbo-se/postly:<sha> published
             → deploy.yml (workflow_run on CI success, self-hosted runner postly-prod)
             → write APP_IMAGE=<sha tag> into /opt/postly/.env
             → docker compose pull && docker compose up -d   (every service, no list)
             → wait for /health to say "healthy"
             → tag the commit PROD-YYYY-MM-DD[-N]
```

- `migrate` runs Drizzle migrations to completion before `api` and `workers`
  start. A container that is up has the schema its code expects.
- `concurrency` with `cancel-in-progress: false`: deploys queue.
- Before the migrate step, a `pg_dump` into `/home/reda/backups/postly`, not
  `/home/reda/backups` itself, which is owned by root (see BenboStandard's
  CLAUDE.md). Best-effort all the way through, including the `mkdir`.
- `docker compose up -d` stops the old API before the new one listens, so
  expect a few seconds of 502 per deploy. That has not been measured yet.

## Rollback

Set `APP_IMAGE` in `/opt/postly/.env` to the previous SHA tag (from the
`PROD-*` tags or `docker image ls`) and run `docker compose up -d`. Never roll
back to `latest`. A later manual `up -d` reads `.env`, so it will not silently
roll forward again.

Migrations are forward-only. A rollback past a migration that the old code
cannot run against needs the pre-deploy dump or the database's point-in-time restore.

## Launch gates

None of these is done. Each one is a line in BenboStandard's `NEW-PROJECT.md`,
an ADR, or an issue under the pre-launch epic. The issue tracker was private
and is not part of this public snapshot, so the issue numbers below are dead
references kept for context.

- [ ] **Product name decided** (ADR-016). Database, domain, image name and the
      published SDK all take it.
- [ ] **Hetzner VM** built with benbo-infra's Ansible roles, and the
      self-hosted runner registered with label `postly-prod`. The repository is
      private, which a self-hosted runner requires.
- [ ] **`deploy.yml`** as described above. `ci.yml` switches the image job
      to `push: true` on `main` in the same change.
- [ ] **Dashboard hosting**: CI artifact of `apps/dashboard/dist` served by
      the host's nginx, with `/api/` proxied to `127.0.0.1:3000` with the
      prefix stripped (ADR-018). The session cookie depends on that being the
      same origin.
- [ ] **Postgres** (provider per #11) created under the final name, with
      point-in-time recovery enabled, and `DATABASE_URL` in the host's `.env`.
- [ ] **Restore rehearsed and timed.** Restore the database to a point in
      time, point a throwaway stack at it, compare row counts. Write the
      number of minutes here. A backup nobody has restored is a hypothesis.
- [ ] **Redis loss understood.** Queued and delayed jobs live only in Redis
      (AOF on a volume). Decide whether a lost volume is acceptable
      (messages stay `queued` in Postgres and could be re-enqueued) and write
      the answer here.
- [ ] **Own delivery in production.** The code and `docker-compose.yml`
      (kumod + tsa, host networking, spool volume) exist and work locally.
      On the host still to do: set `KUMO_HOSTNAME` to the name the sending
      IP's PTR points at, open port 25 inbound for bounces and ARF, publish
      Postly's own `_spf.<domain>` and `mx.<domain>` records (the values in
      `POSTLY_SPF_INCLUDE` / `POSTLY_BOUNCE_MX`), make sure nginx does not
      proxy `/internal`, and confirm kumod reaches tsa (`KUMO_TSA_URL`) —
      that wiring could not be tested off the host. Back up the
      `kumo_spool` volume and `DKIM_ENCRYPTION_KEY`.
- [ ] **Sending reputation** (#11): sending-IP provider chosen (Hetzner
      blocks port 25 by default and unblocks case by case after a month),
      a 4–8 week warm-up on our own traffic, Google Postmaster Tools,
      Microsoft SNDS/JMRP, Yahoo CFL, blocklist monitoring, and MTA-STS and
      TLS-RPT for our own domain.
- [ ] **Reputation protection** (#9): limits and automatic pause/suspend are
      built. Still open: an alert channel for warnings (they are only logged),
      and per-tenant egress pools, which need the sending IPs defined in a
      KumoMTA `sources.toml` first (#11).
- [ ] **Cloudflare and Neon decided** (#11): both are US companies that would
      see message content.
- [ ] **Registered for monitoring**: `benbo-infra/registry.yml` entry to
      `status: live` with `health: /health`, and the domain in
      `benbo-status`. First reconcile one difference: the estate check
      alerts on any non-zero `consecutive_failures`, while Postly counts
      failed send jobs, and one of those can be a customer's bad recipient
      rather than an outage. `/health` itself only degrades at 5 in a row.
      Decide which of the two should move before turning it on.
- [ ] **The domain resolves and the certificate matches the hostname**, and
      the estate check sees it.
