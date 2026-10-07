# Postly — Compliance & Legal Checklist

**Document status:** Draft v0.1
**Companion to:** `01-PRD.md`
**Jurisdiction:** Swedish AB selling to EU/EEA customers
**Last updated:** 2026-09-19 — no Amazon SES; Postly runs its own delivery (ADR-020). AWS is no longer a subprocessor.

---

## 1. Swedish Company Setup

- [ ] **Register Swedish AB** with Bolagsverket
  - Minimum share capital: SEK 25,000
  - Articles of association including a designated technical executor (founder protection)
  - Choose company name (verify availability via Bolagsverket)
- [ ] **Apply for F-skatt** at Skatteverket
  - Mandatory before invoicing Swedish clients (otherwise they must withhold 30%)
  - Annotation "Godkänd för F-skatt" must appear on every invoice
- [ ] **Register for moms (VAT)** at Skatteverket
  - Standard rate: 25% on digital services to Swedish consumers
  - Reduced rate: not applicable for SaaS
- [ ] **Get a tax certificate (skattekonto)** for online tax filing
- [ ] **Open business bank account** (SEB, Handelsbanken, Swedbank, Nordea, or fintech: Wise Business, Revolut Business)
- [ ] **Get accounting software** — Fortnox (Swedish), Bokio, or Visma eEkonomi
- [ ] **Engage an accountant** for annual filing (årsredovisning)
- [ ] **Liability insurance** — företagsförsäkring with professional indemnity (optional but recommended)

## 2. VAT Handling

### 2.1 Swedish B2C
- Charge 25% Swedish VAT on services to Swedish consumers
- Standard Swedish invoice format

### 2.2 EU B2C (cross-border)
- Below €10,000/year (SEK 99,680) total EU cross-border B2C: charge 25% Swedish VAT
- Above threshold: **register for OSS (One-Stop Shop)** via Skatteverket
  - Charge each consumer's local VAT rate (e.g., 19% in Germany, 21% in Netherlands, 20% in France)
  - File quarterly OSS returns via Skatteverket portal
  - Stripe Tax can handle the rate calculation; Fortnox/Bokio for filing

### 2.3 EU B2B (reverse charge)
- Collect customer's VAT number at signup
- Validate via VIES (`https://ec.europa.eu/taxation_customs/vies/`)
- If valid: invoice with 0% VAT, annotate "Reverse charge" + Article 226(11a) reference
- Both VAT numbers must appear on the invoice
- File monthly EC Sales List (periodisk sammanställning) via Skatteverket

### 2.4 Non-EU customers
- B2B and B2C: no VAT
- Annotate "Outside EU" on invoice
- Stripe Tax automates this

### 2.5 Implementation
- [ ] Enable Stripe Tax
- [ ] Configure VAT collection in checkout (collect VAT number for B2B)
- [ ] Set up Fortnox integration with Stripe for automatic invoicing
- [ ] OSS registration when needed
- [ ] Monthly EC Sales List automated reminder

## 3. GDPR Compliance

### 3.1 Legal documents (must publish before launch)

- [ ] **Privacy Policy** at `/privacy`
  - Controller: who we are, contact info
  - Data we collect: account email, billing, IP for security
  - Purpose: providing the service, billing, security
  - Legal basis: contract (Art 6(1)(b)), legitimate interest for security (Art 6(1)(f))
  - Retention: account data until deletion, logs 30 days, audit 365 days
  - User rights: access, rectification, erasure, portability, objection
  - DPO contact: `dpo@<domain>` (founder serves as DPO for solo team)
  - Subprocessor list link
  - Last-updated date

- [ ] **Terms of Service** at `/terms`
  - Service description
  - Acceptable Use Policy (no cold email, no purchased lists, complaint rate target <0.3%)
  - Customer responsibilities (have consent/legitimate purpose, valid recipient addresses)
  - Service availability & SLA
  - Pricing and billing terms
  - Limitation of liability (cap at 12-month fees paid)
  - Termination conditions
  - Governing law: Swedish law, Stockholm District Court
  - Force majeure

- [ ] **Data Processing Agreement (DPA)** at `/dpa`
  - Article 28 GDPR compliant
  - Module 2 SCCs as base (controller-to-processor)
  - Auto-signed at signup via clickwrap; PDF downloadable
  - Includes:
    - Subject matter and duration of processing
    - Nature and purpose of processing
    - Categories of data and data subjects
    - Obligations of the processor (us)
    - Subprocessor authorization (general consent + 30-day notice for changes)
    - Security measures
    - Audit rights
    - Data return/deletion on termination
    - International transfers: none for message content once the open decisions in §4 are made; DPF + SCCs only for the subprocessors that remain US companies

- [ ] **Subprocessor list** at `/subprocessors` (public page)
  - Hetzner Online GmbH (Germany) — control plane compute + object storage
  - GleSYS AB (Sweden) — sending hosts and sending IP addresses, decided 2026-10-06 (ADR-024). Swedish company; majority owner Cube Infrastructure Managers, Luxembourg
  - Neon Inc. (US company, EU region) — managed Postgres, **holds message content**; see §4
  - (Amazon Web Services removed 2026-09-19: Postly delivers its own mail, ADR-020)
  - Stripe Payments Europe Limited (Ireland) — billing
  - Better Stack / Logtail (EU instance) — monitoring
  - Sentry (EU region) — error tracking
  - Cloudflare Inc. (US, EU edge) — WAF + DDoS; **sees API request bodies if the API is proxied**; see §4
  - Add change notification email signup form

- [ ] **Cookie Policy** at `/cookies` (if any non-essential cookies used)
  - First-party session cookies only in v0 → no banner required per EDPB
  - Document this decision explicitly

- [ ] **Acceptable Use Policy** at `/aup`
  - Prohibited: cold email, purchased lists, illegal content, phishing
  - Required: complaint rate <0.3%, valid bounce/complaint handling
  - Enforcement: pause, suspension, termination

- [ ] **Security Overview** at `/security`
  - Encryption at rest + in transit
  - Access controls
  - Retention periods
  - Breach notification process (72-hour commitment)
  - Vulnerability disclosure: `security@<domain>` + PGP key

### 3.2 Technical controls

- [ ] **TLS 1.2+** on all public endpoints
- [ ] **HSTS** with 1-year max-age, includeSubDomains, preload
- [ ] **At-rest encryption** on Postgres (Hetzner volume encryption / LUKS)
- [ ] **At-rest encryption** on object storage (SSE-256)
- [ ] **API keys hashed** with bcrypt (no plaintext storage)
- [ ] **DKIM private keys encrypted** at rest (AES-256-GCM, key in env), served to the MTA only over the private network
- [ ] **PII minimization in logs:**
  - Do not log full message bodies
  - Redact `to` addresses to first 3 chars + domain in error logs
  - Do not log API key values (use prefix only for identification)
- [ ] **Email content retention** configurable per tenant (default 30 days, min 7)
- [ ] **Right to erasure:** `DELETE /v1/account` purges within 30 days
- [ ] **IP address logging:**
  - Only on admin actions (login, API key creation, password change)
  - 90-day retention
  - Not logged on routine API calls
- [ ] **Access logging** with audit log table (1-year retention)
- [ ] **Backup encryption** with EU-region restriction
- [ ] **Database access** via VPN/bastion only, no direct internet exposure
- [ ] **Production DB shell** only via break-glass procedure with logging

### 3.3 Organizational measures

- [ ] **Designated DPO contact:** `dpo@<domain>`
- [ ] **Article 30 records of processing (RoPA)** maintained
  - Template available from IMY (Integritetsskyddsmyndigheten)
  - Update annually
- [ ] **DPIA assessment** for transactional email — likely not triggered, but document the assessment
- [ ] **Annual policy review** scheduled
- [ ] **Breach response playbook:**
  - 72-hour notification to IMY (Sweden's DPA)
  - Customer comms templates
  - Forensic checklist
- [ ] **Vendor risk assessment** for each subprocessor (annual)
- [ ] **Staff confidentiality** — sole founder; if contractors engaged, NDA + DPA required

## 4. EU-US Data Transfer Posture

Postly delivers its own mail (ADR-020), so the sending itself involves no US company. The "Schrems III contingency" in the first draft (swap SES for an EU-native MTA) is now the architecture. What remains:

- [ ] **Decide Cloudflare in front of the API.** ADR-012 proxies every public endpoint through Cloudflare, a US company that terminates TLS and therefore sees message content in `POST /v1/emails`. Either serve `api.*` DNS-only (no proxy) or accept Cloudflare as a transfer and say so. Until decided, marketing must not claim "no US company in the path" (issue #11).
- [ ] **Decide Neon.** Neon Inc. is a US company; its EU region still makes it subject to US law, and the database holds message content until delivery (`messages.payload`), subjects and addresses. Options: an EU-headquartered managed Postgres, or self-hosting earlier than ADR-004 planned (issue #11).
- [ ] **Sentry and Stripe** remain US companies (EU region / Irish entity) and must never receive message content: no Sentry capture of bodies (CLAUDE.md rule 9); Stripe sees billing data only.
- [ ] For any US subprocessor that remains: DPF certification verified at https://www.dataprivacyframework.gov/, SCCs as the fallback, and a short transfer impact assessment referencing Case T-553/23 (Latombe v Commission, 3 September 2025).
- [x] **Marketing copy narrowed to what is true today** (2026-09-20). The dashboard copy claimed no US subprocessor was in the sending path while Neon holds message content until delivery. The claim is now the narrow one: nobody but Postly accepts, signs, queues or delivers the mail. The compliance blog post states the Cloudflare and Neon decisions as open rather than implying they do not exist. Widen the claim only when both are settled.

## 5. Bulk Sender Compliance (Gmail / Yahoo / Microsoft)

Operational requirements that we enforce automatically on behalf of customers:

- [ ] **SPF record** validated per domain
- [ ] **DKIM signing** by Postly for all sends, with a per-domain key Postly generates (RSA-2048)
- [ ] **DMARC record** required (minimum `p=none`); warn on missing
- [ ] **List-Unsubscribe header (RFC 2369)** injected for any send tagged as marketing-adjacent
- [ ] **List-Unsubscribe-Post (RFC 8058)** one-click unsubscribe for marketing
- [ ] **Complaint rate monitoring** — auto-pause domain at 0.2%, auto-suspend at 0.3%
- [ ] **Bounce rate monitoring** — auto-pause domain at 5%
- [ ] **From: header alignment** with DKIM domain (warn on misalignment)
- [ ] **TLS for SMTP delivery**: KumoMTA uses opportunistic TLS and honours receivers' MTA-STS; Gmail is TLS-required in the shaping rules
- [ ] **PTR / FCrDNS** for every sending IP, matching the EHLO name
- [ ] **Feedback loops:** Google Postmaster Tools, Microsoft SNDS/JMRP, Yahoo CFL; ARF reports received on the return-path domain and turned into suppressions
- [ ] **Blocklist monitoring** for sending IPs and domains
- [ ] **ARC headers** preservation for forwarded mail
- [ ] **BIMI support** (v2 feature — store VMC, set up `_bimi.` records via UI)

## 6. NIS2 Position

- [ ] **Current status: out of scope**
  - Under 50 employees AND under €10M annual turnover
  - Not in the specific in-scope-regardless-of-size categories (DNS providers, TLD registries, trust service providers, public electronic communications providers)
  - A transactional email API is none of those
- [ ] **Marketing claim allowed:** "NIS2-ready architecture" — do NOT claim "NIS2 compliant" (no compliance obligation yet)
- [ ] **Revisit annually** or when crossing 50 employees / €10M turnover

## 7. DAC7 Position

- [ ] **Out of scope:** Postly sells its own service, no third-party "Sellers"
- [ ] **Documentation:** internal memo citing PwC NL guidance ("platforms that only sell their own product are out of scope") + Accace confirmation
- [ ] **Revisit if** the affiliate program scale grows substantially (affiliates are not "Sellers" in DAC7 sense, but documenting position is prudent)

## 8. DSA (Digital Services Act) Position

- [ ] **Out of scope as intermediary service:** Postly is not a hosting service for user-generated content in the DSA sense
- [ ] **Marketing-email customers** could be in scope themselves; Postly is not responsible for their compliance
- [ ] **Notice-and-action procedure** documented (we already have AUP enforcement)

## 9. ePrivacy Directive

- [ ] **Transactional emails are not "direct marketing"** under Article 13 — no opt-in requirement
- [ ] **Marketing emails sent via Postly are customer's responsibility** — AUP states the customer must have legitimate basis
- [ ] **Tracking pixels and click tracking** treated as cookies under ePrivacy:
  - **Default OFF** in our API (privacy-first positioning)
  - Customer opt-in per send via `tracking.opens` / `tracking.clicks`
  - Customer responsible for end-user consent

## 10. Certifications Roadmap

| Cert | Year | Cost estimate | Why |
|---|---|---|---|
| Self-attested GDPR | Year 1 | €1,500 (legal review) | Mandatory baseline |
| **ISO 27001** | Year 2 | €15,000–25,000 | Drata/Vanta + auditor; unlocks regulated-industry customers |
| SOC 2 Type II | Year 3+ | €20,000+ | Only if expanding US/UK customer base |
| CISPE Code of Conduct | Year 2 | €5,000 | EU cloud trust signal |
| TISAX | Defer | €15,000+ | Only for automotive customers |
| C5 (Germany) | Defer | €30,000+ | Only for German regulated customers |

## 11. Insurance

- [ ] **Professional indemnity** (ansvarsförsäkring) — recommended at scale
- [ ] **Cyber liability** insurance — recommended once handling 1M+ emails/month
- [ ] **D&O insurance** — not needed for solo AB

## 12. Operational Checklists

### Customer onboarding
- [ ] DPA auto-signed at signup
- [ ] Subprocessor list shown
- [ ] Domain verification before any production send
- [ ] Acceptable Use Policy acknowledgment

### Subprocessor change
- [ ] Email all customers 30 days in advance
- [ ] Update subprocessor list page
- [ ] Update DPA appendix
- [ ] Customer can object → if objection, work out alternative or terminate per ToS

### Breach response
- [ ] Detect (Sentry, Better Stack alerts)
- [ ] Contain (isolate affected systems)
- [ ] Assess (what data, how many customers, severity)
- [ ] Within 72h: notify IMY if personal data is affected with risk to rights
- [ ] Without undue delay: notify affected customers if high risk
- [ ] Postmortem published

### Data subject request (DSR)
- [ ] Verify identity
- [ ] Access request: provide all data within 30 days
- [ ] Erasure request: delete within 30 days (note we are processor for customer's contacts; route to controller)
- [ ] Portability: JSON export
- [ ] Rectification: update fields

### Customer termination
- [ ] On request: data deletion within 30 days
- [ ] Confirmation email + audit log entry
- [ ] Final invoice issued
- [ ] DKIM keys for the tenant's domains deleted

## 13. Documents to Generate / Templates Needed

- [ ] Privacy Policy (lawyer-reviewed)
- [ ] Terms of Service (lawyer-reviewed)
- [ ] DPA (lawyer-reviewed, based on EDPB SCCs Module 2)
- [ ] AUP
- [ ] Subprocessor list
- [ ] Security overview
- [ ] Breach notification template
- [ ] DSR response templates (access, erasure, portability, rectification)
- [ ] Vendor risk assessment template
- [ ] Transfer impact assessment (TIA) for any US subprocessor that remains after the decisions in §4
- [ ] Article 30 RoPA template
- [ ] DPIA assessment record

**Lawyer recommendation:** Engage a Swedish IT lawyer for a one-time review of all customer-facing legal docs. Budget €1,500–€3,000. Recommended: Setterwalls, Vinge, Mannheimer Swartling for large firms; for smaller spend, look at Synch Advokat or a niche IT-law practice.

## 14. Ongoing Obligations

| Task | Frequency |
|---|---|
| OSS VAT return | Quarterly |
| EC Sales List | Monthly (when B2B EU sales occur) |
| Standard VAT return | Monthly or quarterly per Skatteverket |
| Annual financial statements (årsredovisning) | Annually |
| Income tax return | Annually |
| Subprocessor list review | Quarterly |
| Privacy policy review | Annually |
| Security review (internal pentest, dep audit) | Annually |
| Backup restore test | Quarterly |
| Disaster recovery drill | Annually |
| Vendor risk assessment refresh | Annually |
| RoPA refresh | Annually or on material change |

---

*This checklist is operational guidance. Always confirm specific obligations with a qualified Swedish IT/data-protection lawyer and your accountant.*
