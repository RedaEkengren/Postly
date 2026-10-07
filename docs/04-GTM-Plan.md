# Postly — Go-to-Market Plan

**Document status:** Draft v0.1
**Companion to:** `01-PRD.md`
**Last updated:** 2026-10-06 — unit economics recorded (§3c): what EUR 0.40 per 1,000 means in customers, now that infrastructure has a real price

---

## 1. Positioning

**One-liner:** Transactional email that never leaves the EU.

**Three-sentence pitch:**
> Postly is a transactional email API that runs its own delivery infrastructure in the EU: nobody but Postly accepts, signs, queues or delivers your mail, and no email provider sits between your app and your customer's inbox. €0.40 per 1,000 emails, 3,000 free every month, no subscription tiers. Idempotency that survives crashes, per-tenant suppression, signed webhooks and a CLI, without tracking pixels.

**Claim discipline:** do not write "no US company anywhere in the path" until the Cloudflare and Neon decisions in Compliance §4 are settled. Neon holds message content until delivery and Cloudflare sees request bodies if the API is proxied, so the wider claim is false today. The narrow claim above is true and is the one to use.

**What we are:**
- Our own sending infrastructure in the EU (KumoMTA on our IPs, DKIM keys we generate)
- EU end to end: nothing to re-paper if the Data Privacy Framework falls
- Pay-as-you-go with optional credit packs
- Developer-first (CLI, OpenAPI, SDKs, observability built in)
- Private by default: no open or click tracking
- Honest about pricing and upgrade paths

**What we're not:**
- A marketing email platform (no broadcast, no segments, no campaigns)
- A SendGrid replacement for enterprises
- A SOC 2 / HIPAA shop (year 2 work)
- The cheapest option (Scaleway is at €0.25/k)
- A wrapper around someone else's sending service

## 2. ICP Profile

### Primary: Bootstrapped EU SaaS founder

- 1–5 person team
- Already shipping a product (B2B SaaS, marketplace, dev tool, e-commerce)
- Currently on Resend, Postmark, or SendGrid
- Sends 10,000–200,000 transactional emails/month
- Has a verified domain, understands SPF/DKIM/DMARC
- Cares about GDPR because customers ask in security questionnaires
- Reads Hacker News, Indie Hackers, posts on Twitter/X
- Pays for tools but watches dashboards

**Where they hang out:**
- Hacker News (Show HN, comments)
- Indie Hackers
- r/SaaS, r/selfhosted, r/webdev, r/EuropeIndieHackers
- Twitter/X (#buildinpublic, #SaaS)
- Mastodon (`@indieweb@mas.to`, EU dev communities)
- Bluesky (growing EU developer presence)
- Discord servers: Indie Hackers, Bootstrapped Founders, country-specific dev communities

### Secondary: EU company whose customers ask "which US companies see our data?"

- Sells to public sector, health-adjacent, legal or finance customers, or has a works council
- Fills in security questionnaires that list every subprocessor
- Chooses the provider that can say "EU only, end to end" over a cheaper one that needs a transfer impact assessment

### Tertiary (year 2): EU agencies & resellers

- Manage 5–50 client SaaS apps
- Need sub-accounts and consolidated billing

## 3. Competitive Positioning

### vs. Resend

- **Our advantage:** we deliver the mail ourselves from the EU with no email provider in between, no subscription tier surprises, idempotency that actually works, transparent unit cost, no tracking by default
- **Their advantage:** React Email DX, brand recognition, free tier marketing budget, years of IP reputation
- **Wedge:** Resend doubled their 200k tier from $80 to $160 in Oct 2024, and it is a US company. We offer the same DX (or better) at predictable pricing, in the EU.

### vs. Postmark

- **Our advantage:** Cheaper at any volume, EU end to end, pay-as-you-go
- **Their advantage:** Best deliverability reputation, transactional/broadcast separation, mature DMARC monitoring
- **Wedge:** Postmark is $15 for 10k ($1.50/k) → we're €4 for 10k (€0.40/k). Customers paying $1,500+/mo for Postmark Plus tier are massively overpaying.

### vs. Lettermint

- **Our advantage:** Better DX (CLI, React Email, idempotency), pay-as-you-go, more transparent
- **Their advantage:** First EU mover, ISO 27001, Laravel-friendly, longer track record, established IP reputation
- **Parity:** they also run their own infrastructure in the EU, so "no US providers" is not a differentiator against them. As of the 2026-09-26 market check they run **KumoMTA**, the same engine as ADR-020, on dedicated private cloud at UpCloud (Finnish, Amsterdam DC). The stack is not a differentiator either
- **Wedge:** Lettermint is €10/mo for 10k (€1/k) → we're €4 for 10k.

### vs. AhaSend

- **Our advantage:** Better DX (CLI, React Email, dashboard polish), Nordic brand, EUR-native pricing
- **Their advantage:** First-mover in pay-as-you-go EU, their own ASN and infrastructure, active customer base
- **Parity:** also EU infrastructure and pay-as-you-go
- **Wedge:** They are our closest competitor. We win on developer experience or not at all.

### vs. Sweego (France)

- **Their advantage:** €0.20 per 1,000, the cheapest EU provider found, "Made in France", dedicated IP included on higher tiers
- **Our advantage:** to be established. We have not evaluated their DX, API surface or deliverability
- **Wedge:** none on price. If a prospect is choosing on cost per 1,000 alone, Sweego wins and we should not pretend otherwise

### vs. EuroMail (Finland)

- **The closest thing to us that exists.** Own SMTP engine in Rust delivering straight to recipient MX with no third-party relay, hosted on Hetzner Helsinki, "your data stays in Finland", free tier of 3,000/month (identical to ours), €19 for 30k (about €0.63/1k) and €69 for 150k (about €0.46/1k)
- **Their advantage:** shipping already, Nordic, same privacy posture, and they solved the sending-IP problem we are still deciding (issue #11)
- **Our advantage:** cheaper above their free tier, and a wider product (templates, idempotency, suppression, CLI, dashboard) if their surface is as small as it appears
- **Unverified:** operated by kalle.works Oy; company size, whether this is a funded product or a side project, and their actual deliverability are unknown

### vs. Scaleway TEM

- **Our advantage:** Developer experience: idempotency, templates, CLI, signed webhooks, a dashboard built for transactional email
- **Their advantage:** Cheaper (€0.25/k), part of a large EU cloud with its own reputation
- **Wedge:** Teams who want a product, not a cloud primitive.

### What SES used to be here

The first draft of this plan positioned Postly as an SES wrapper. That was dropped on 2026-09-19 (ADR-020): every "EU" claim ended in "…and Amazon". Do not reintroduce SES comparisons in copy.

## 3b. The Swedish market specifically

**There is no established Swedish competitor.** Three independent European provider directories list transactional email by country and none lists a Swedish one; a Swedish-language article titled "bästa svenska e-postleverantörer" covers only mailbox hosting and never mentions APIs or relays. Three things qualify that:

- **Skickamejl.se** is the only Swedish transactional email API found. Its pitch is Swedish infrastructure end to end, it ships a .NET SDK and an MCP server, and it says on its own site that it is "fortfarande under utveckling". Public counters showed roughly 1,400 emails per week. It publishes no legal entity, org number or subprocessor list, and whether it runs its own MTA or relays through a third party is unknown. Priced around 15 kr per 1,000 ex VAT, roughly three times ours.
- **Sinch AB** (Stockholm, Nasdaq Stockholm) owns **Mailgun and Mailjet**. The largest Swedish company in this category is therefore a competitor, but it never markets on Swedish or EU-sovereign grounds: Mailgun's EU region is an option, not the premise. Mailgun Flex doubled from $1 to $2 per 1,000 on 2025-12-01, which is the same pricing behaviour our own launch narrative criticises, from a Swedish-owned company.
- **Halon** (Gothenburg) sells scriptable MTA software to hosting providers and ISPs. Not a competitor. A possible supplier, and the Swedish alternative to KumoMTA we did not evaluate in ADR-020.

Swedish hosting providers (Elastx, Etegra, Red Cloud IT, GleSYS, Loopia) sell SMTP relay or mailboxes only: no REST API, no webhooks, no event data. Elastx is the only one with published volume pricing, at roughly €4.40 per 1,000 at 10k, about eleven times ours.

**How to read the gap.** An empty category can mean the position is open or that Swedish buyers who care about residency already buy Dutch and French and do not experience a problem. The evidence does not settle it: the market is not short of EU alternatives, only of Swedish ones. Treat "svenskt alternativ" as a hypothesis to test in customer conversations, not as an established wedge.

### Price field, per 1,000 emails (market check 2026-09-26)

| Provider | Country | Per 1,000 | Free tier |
|---|---|---|---|
| Sweego | FR | €0.20 | 100/day |
| Scaleway TEM | FR | €0.25 | 300/mo |
| **Postly** | **SE** | **€0.40** | **3,000/mo** |
| EuroMail | FI | €0.46 to €0.63 | 3,000/mo |
| Lettermint | NL | €0.50 to €1.00 | 300/mo |
| MailerSend | LT | €0.80 to €1.50 | 500/mo |
| Heysender | DK | €0.80 to €1.34 | none |
| Skickamejl | SE | about €1.30 | 100/mo |
| Mailgun (Sinch) | US/SE | $2.00 | 100/day |
| Elastx relay | SE | about €4.40 | none |

We are third cheapest, not cheapest. AhaSend's Pro and Max prices are rendered client-side and were not captured; that gap should be closed before the comparison is used in copy.

## 3c. What the price point means, in customers

Recorded 2026-10-06, after GleSYS quoted real infrastructure prices (ADR-024). This is arithmetic, not a forecast.

**Cost.** Control plane about EUR 70/month, sending host plus a dedicated /29 at 523 SEK/month, so roughly **EUR 130/month** all in, call it 1,470 SEK.

**Revenue.** EUR 0.40 per 1,000 billable emails, about 4.50 SEK. The first 3,000 per customer per month are free, so a customer sending 20,000 bills for 17,000.

| Goal | Billable emails per month | Paying customers at 20k each |
|---|---|---|
| Cover infrastructure | about 330,000 | about 19 |
| EUR 1,000/month gross | about 2.8 million | about 165 |
| A Swedish salary, 40,000 SEK/month | about 9.2 million | **about 540** |

**What this says.** The price point makes this a volume business. Each customer pays very little, so they cannot be sold to one at a time, and several hundred are needed before the business pays a salary. Raising the price does not fix it: the EU field runs from EUR 0.20 to EUR 1.00 and we are already in the middle (§3b).

**The other side of the same fact.** Transactional email has unusually low churn once a customer has integrated against the API, because switching means a code change and a deliverability risk. The business compounds instead of leaking. It is a slow and durable category, not a bad one, but it needs self-serve acquisition at scale and years of it, which is a different plan from selling to twenty customers well.

**Two hypotheses worth testing rather than assuming.** Neither is established:
- **Search.** Being the only Swedish provider (§3b) should mean ranking first for Swedish-language queries, and being the name an LLM gives when asked for a Swedish alternative. The question is whether anyone searches in Swedish for this: developers tend to search in English, where the competition is brutal. Check real search volume before building a content plan on it.
- **Public procurement.** Swedish public sector buys transactional email somewhere. Whether a one-person supplier can reach it is a different question: that segment buys through framework agreements, asks for ISO 27001, which ADR-015 defers to year two, and expects an SLA above the 99.3% our sending provider offers as standard.

## 4. Launch Sequence

### Pre-Launch (Weeks -8 to 0)

**Weeks -8 to -4: Build**
- Develop v0 features per PRD
- Dogfood on Bokflow, Tallvik, BilRental
- Write docs as you build, not after

**Weeks -4 to -2: Quality**
- Internal load tests (target: 1,000 emails/second sustained)
- Security review: API key handling, DKIM key encryption, internal endpoints, webhook signing
- Sending IP warm-up (4–8 weeks) on the founder's own portfolio traffic before any external customer
- Compliance pages: privacy policy, ToS, DPA, subprocessor list

**Weeks -2 to 0: Soft launch**
- Reach out personally to 20 hand-picked early users
- Recruit 3–5 for paid beta at full price (no discount — validates willingness to pay)
- Collect 5 testimonials in writing

### Public Launch (Week 0)

**Day 0 (Tuesday or Wednesday, 14:00 UTC):**
- Show HN post: "Show HN: Postly — transactional email on our own EU infrastructure, €0.40/1k, no subscriptions"
- Indie Hackers post (separate angle: "Why I run my own MTA instead of wrapping SES")
- Twitter/X thread with the same story
- Mastodon and Bluesky posts
- Submit to european-alternatives.eu
- Submit to euro-stack.com
- Personal email blast to network (Swedish + Nordic dev contacts)

**Day 0–7:**
- Respond to every Hacker News comment within 30 minutes
- Reply to every DM, every email, every comment
- Post follow-up "Show HN" 48h later with metrics if first lands
- Live AMA in Indie Hackers community

**Week 1–4:**
- Reddit posts (r/SaaS, r/webdev, r/selfhosted, r/EuropeIndieHackers)
- Sponsor messages in 2–3 Nordic dev newsletters
- Submit Show HN reposts every 6 weeks if traction allows

### Growth Phase (Months 1–6)

**Content marketing (SEO):**
- "Migrating from Resend to Postly" guide (target: people googling "Resend alternative")
- "Lettermint vs Postly" comparison (capture comparison searches)
- "How to send transactional email from SvelteKit / Next.js / Laravel / Django / Rails" guides
- "What 'EU-hosted' email actually means" (who is in the sending path) pillar page
- "GDPR-compliant transactional email" pillar page
- Engineering blog posts: "How we built idempotency that survives crashes", "Warming up sending IPs from zero", "Running KumoMTA as a solo founder"

**Partnerships:**
- Reach out to React Email maintainers to be a recommended provider
- Reach out to MJML maintainers same
- Get listed on:
  - awesome-selfhosted (where applicable)
  - european-alternatives.eu (primary)
  - euro-stack.com
  - swisscloud.io
  - nordic-saas.com
  - awesome-eu-tech
- Co-marketing with EU-based dev tools:
  - DBOS, Neon (databases)
  - Coolify, Dokku (deployment)
  - Plausible, PostHog (analytics)
  - Cal.com (scheduling)

**Direct outreach:**
- Search Twitter/X weekly for: "Resend price", "Postmark expensive", "SendGrid suspended", "moving off Resend"
- DM each with a personal note and 6-month free credits offer
- Track conversion in Notion CRM

**Conference + meetup presence:**
- Local Stockholm/Malmö bootstrapped meetups (low-cost, high-signal)
- JSNation EU (Amsterdam) — sponsor a side event
- Laracon EU (if Lettermint moves upmarket and leaves a Laravel gap)

### Year-end push (Months 9–12)

**ISO 27001 starts:**
- Begin Drata or Vanta engagement
- Use this for "Postly is on track for ISO 27001" marketing copy

**Affiliate program launch:**
- 5% recurring commission for 12 months
- Targeted at EU SaaS bloggers, comparison sites

**Migration tooling:**
- `postly migrate --from resend|postmark|sendgrid|lettermint` CLI
- Whitepaper: "Migrating to EU email infrastructure: a guide"

## 5. Pricing & Packaging Communication

**Landing page hierarchy:**
1. Hero: "Transactional email API. EU-hosted. €0.40 per 1,000 emails."
2. Sub: "Our own infrastructure. No Amazon, no tracking pixels."
3. Two-card pricing: Free / Pay-as-you-go (dedicated IP as an add-on)
4. Calculator: "How much would you save vs Resend / Postmark?" — input current monthly volume, output savings
5. Feature comparison table vs Resend / Postmark / Lettermint
6. Code samples (curl, Node, PHP, Python, Go)
7. Compliance/security section
8. FAQ

**Calculator math (display on every pricing page):**

| Volume | Resend | Postmark | Lettermint | **Postly** | Savings vs cheapest competitor |
|---|---|---|---|---|---|
| 10k | $20 | $15 | €10 | **€4** | 60% |
| 100k | $35 | $105 | €110 | **€40** | -14% to +75% |
| 1M | $460+ | $1,500+ | custom | **€400** | 13% to 73% |

(Exchange rate: $1 ≈ €0.92 for display)

## 6. Customer Acquisition Funnel

```
Awareness     │ HN, Reddit, Twitter, EU directories, SEO          → Aim: 500 visits/week
              ▼
Interest      │ Landing page, pricing calculator, comparison docs  → Aim: 5% → 25 signups/week
              ▼
Free signup   │ 3k/month free, immediate API access                → Aim: 80% domain-verify
              ▼
Activation    │ First email sent + domain verified                 → Aim: 60% within 24h
              ▼
First payment │ Exceed 3k → upgrade trigger or credit pack         → Aim: 20% of activated
              ▼
Retention     │ Monthly active sender                              → Aim: >90% MoM after month 2
              ▼
Expansion     │ More volume, more domains, dedicated IP            → Aim: 15% upgrade in year 1
```

**Targets at 12 months:**
- 2,000 signups
- 1,000 activated (sent first email)
- 50 paying customers (€1,500+ MRR)
- 2 dedicated-IP customers (€80+ MRR)

## 7. Messaging Variants by Channel

**Hacker News (Show HN):**
> Show HN: Postly — transactional email on our own EU infrastructure, €0.40/1k
>
> Many email APIs that market EU hosting still hand your mail to Amazon or another US company at the last step. Postly doesn't: it runs its own MTA (KumoMTA) on its own IPs in the EU, signs with DKIM keys it generates per domain, and handles bounces and complaints itself. Free 3k/mo, then €0.40/1k pay-as-you-go. No tracking pixels.
>
> What's there: REST API, idempotency keys that survive crashes, suppression list, signed webhooks, templates with React Email / MJML, CLI, full OpenAPI spec.
>
> What's not there: marketing email, open/click tracking, drag-drop editor, SOC 2. That's by design.
>
> Built solo in Sweden. Happy to answer anything, including how the IP warm-up went.

**Indie Hackers:**
> I stopped building an SES wrapper and ran my own MTA instead
>
> Last October, Resend's 200k tier went from $80 to $160. I started building a cheaper wrapper around Amazon SES, then realised every "EU" claim I made ended in "…and Amazon". So Postly delivers its own mail from the EU. €0.40/1k, no subscriptions. Looking for honest feedback from other EU founders.

**Twitter/X:**
> Just launched Postly 🇸🇪
>
> Transactional email API on our own EU infrastructure. €0.40 per 1k.
>
> No Amazon, no email provider between your app and the inbox, no tracking pixels.
>
> [link]

**Reddit r/SaaS:**
> [Self-promo Saturday] Built transactional email that never leaves the EU
>
> Hi all. Solo Swedish dev. My customers kept asking which US companies see their emails, and with every provider I used the honest answer was "at least one". Postly runs its own delivery infrastructure in the EU.
>
> Differences from existing tools: pay-as-you-go (no tiers), EU end to end, no open/click tracking.
>
> Would love feedback, especially from other bootstrappers on the pricing model. Link in bio.

## 8. Risks to GTM

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Show HN doesn't land | Medium | Medium | Submit at peak time, prepare 3 angles, have backup channels lined up |
| Resend slashes prices | Medium | Medium | Don't compete on price below €0.30/k; differentiate on EU end to end + DX |
| Undercut by an EU provider we did not price against | **Already happened** | Medium | Sweego is at €0.20/k and Scaleway at €0.25 (§3b). We are third cheapest. Do not write "cheapest" anywhere; the argument is DX, idempotency and per-message transparency at a predictable price |
| A near-identical Nordic project ships first | Medium | Medium | EuroMail (FI) has the same premise, the same free tier and already sends. Watch it, and assume any "first EU-native Nordic sender" claim is false |
| New IPs deliver to spam at launch | High | High | Warm up on own traffic for 4–8 weeks before the public launch; publish nothing until Postmaster Tools shows good reputation |
| GDPR positioning gets called out as "GDPR theater" | Low | High | Be technically precise and name every subprocessor. The claim "no US company in the sending path" is only true if the API is **not** behind Cloudflare's proxy: a TLS-terminating proxy sees every message body (ADR-012). Decide before launch (issue #11); until then, do not publish the claim |
| First abusive customer | High (eventually) | High | On our own IPs this hurts every customer: per-tenant limits and automatic pause ready before launch (issue #9) |
| Founder bandwidth limits | High | High | Pre-write canned responses, FAQ docs; refuse customization requests in v0 |

## 9. Year 1 Budget

| Category | Annual | Notes |
|---|---|---|
| Infrastructure (servers, sending IPs, tools) | to be measured | Replaces the SES-based estimate; see ADR-021 |
| Domain + brand assets | €200 | .eu + .se + logo |
| Legal (DPA template, ToS review) | €1,500 | One-time |
| Accounting (Fortnox / Bokio + accountant) | €1,200 | |
| Marketing (sponsorships, ads, content) | €2,500 | Mostly content + small newsletter sponsorships |
| Tools (Stripe, Mollie, Better Stack, Sentry) | €600 | |
| Conference travel (optional, 1 trip) | €1,500 | |
| ISO 27001 prep (Drata/Vanta) | €3,000 | Year 1 — full cert in year 2 |
| **Total** | **~€10,500 + infrastructure** | |

**Revenue target year 1:** €18,000 ARR (€1,500 MRR exit).
**Net:** depends on infrastructure cost, measured before launch (effectively breakeven; goal is to build the asset).

## 10. Decision Gates

**Month 3 (post-launch):**
- IF <10 paying customers → revisit positioning + pricing, run customer-development interviews
- IF >10 paying customers → continue plan

**Month 6:**
- IF <30 paying customers → product-market fit is weak; either pivot positioning (e.g., go after marketing email) or use as internal-only tool
- IF 30–60 paying customers → on track, offer dedicated IPs to the largest senders
- IF >60 paying customers → start ISO 27001, hire a fractional CTO or contractor

**Month 12:**
- IF MRR <€1,000 → kill or pivot
- IF MRR €1,000–€5,000 → continue solo, focus on retention + expansion
- IF MRR >€5,000 → invest in growth (paid ads, hire support, conference)

---

*See `05-Compliance-Checklist.md` for compliance work that supports GTM credibility.*
