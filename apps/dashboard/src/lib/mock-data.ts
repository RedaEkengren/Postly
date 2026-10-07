// Mock data for the Postly prototype. No backend.

export const TENANT = {
  id: "ws_bokflow",
  name: "Bokflow",
  slug: "bokflow",
};

export const STATS = {
  emailsThisMonth: 23481,
  deliveryRate: 99.4,
  complaintRate: 0.08,
  bounceRate: 0.42,
  spendEur: 9.39,
  reputation: 98,
};

export const DOMAINS = [
  { id: "dom_bok", domain: "bokflow.se", returnPath: "bounces.bokflow.se", dkim: "verified", spf: "verified", dmarc: "verified", sends30d: 18204 },
  { id: "dom_rail", domain: "tallvik.example", returnPath: "bounces.tallvik.example", dkim: "verified", spf: "verified", dmarc: "pending", sends30d: 3902 },
  { id: "dom_bil", domain: "bilrental.se", returnPath: "bounces.bilrental.se", dkim: "pending", spf: "pending", dmarc: "pending", sends30d: 0 },
  { id: "dom_gha", domain: "nordvik.example", returnPath: "bounces.nordvik.example", dkim: "verified", spf: "verified", dmarc: "verified", sends30d: 1102 },
  { id: "dom_bra", domain: "braleads.ai", returnPath: "bounces.braleads.ai", dkim: "verified", spf: "verified", dmarc: "verified", sends30d: 273 },
];

export const TEMPLATES = [
  { slug: "welcome-email", name: "Welcome email", format: "React", versions: 4, uses30d: 4912 },
  { slug: "password-reset", name: "Password reset", format: "MJML", versions: 2, uses30d: 1208 },
  { slug: "invoice-receipt", name: "Invoice receipt", format: "MJML", versions: 6, uses30d: 8431 },
  { slug: "payment-failed", name: "Payment failed", format: "HTML", versions: 1, uses30d: 88 },
  { slug: "weekly-digest", name: "Weekly digest", format: "React", versions: 9, uses30d: 5610 },
  { slug: "account-deleted", name: "Account deleted", format: "HTML", versions: 1, uses30d: 12 },
];

const SUBJECTS = [
  "Your invoice is ready",
  "Welcome to Bokflow",
  "Reset your password",
  "Your weekly digest",
  "Payment failed - action required",
  "New login from Stockholm",
  "Receipt #INV-2026-0421",
  "Account deletion confirmed",
  "Your scheduled report is ready",
  "Verify your email address",
];

const RECIPS = [
  "anna@example.com",
  "marcus@example.com",
  "fatima@example.com",
  "lars@example.com",
  "elin@bokflow.se",
  "ola@tallvik.example",
  "noor@nordvik.example",
  "viktor@bilrental.se",
];

const STATUSES = ["delivered", "delivered", "delivered", "delivered", "delivered", "bounced", "queued", "complained", "failed"] as const;

function pad(n: number, w = 4) {
  return n.toString(36).toUpperCase().padStart(w, "0");
}

function rand(seed: number) {
  // tiny deterministic LCG
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function makeMessages(count = 80) {
  const r = rand(42);
  const out = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const sent = now - Math.floor(r() * 30 * 24 * 3600 * 1000);
    const status = STATUSES[Math.floor(r() * STATUSES.length)];
    const dom = DOMAINS[Math.floor(r() * 4)];
    out.push({
      id: `msg_01H${pad(i + 1000, 6)}${pad(Math.floor(r() * 1e6), 4)}`,
      to: RECIPS[Math.floor(r() * RECIPS.length)],
      from: `noreply@${dom.domain}`,
      subject: SUBJECTS[Math.floor(r() * SUBJECTS.length)],
      status,
      sentAt: sent,
      tags: r() > 0.5 ? ["billing"] : r() > 0.5 ? ["onboarding", "welcome"] : ["transactional"],
      domain: dom.domain,
    });
  }
  return out.sort((a, b) => b.sentAt - a.sentAt);
}

export const MESSAGES = makeMessages();

export const SUPPRESSIONS = [
  { address: "bounce1@invaliddomain.test", reason: "bounce", source: "msg_01HXYZ1", createdAt: Date.now() - 4 * 86400000 },
  { address: "complainer@hotmail.test", reason: "complaint", source: "msg_01HXYZ2", createdAt: Date.now() - 9 * 86400000 },
  { address: "old-user@example.com", reason: "manual", source: null, createdAt: Date.now() - 22 * 86400000 },
  { address: "unsub@example.com", reason: "unsubscribe", source: "msg_01HXYZ3", createdAt: Date.now() - 1 * 86400000 },
];

export const WEBHOOKS = [
  {
    id: "whk_xyz789",
    url: "https://api.bokflow.se/postly/events",
    events: ["email.delivered", "email.bounced", "email.complained"],
    status: "active",
    lastDelivery: "200 OK",
    successRate: 99.8,
  },
  {
    id: "whk_abc123",
    url: "https://logs.tallvik.example/hooks/postly",
    events: ["email.opened", "email.clicked"],
    status: "active",
    lastDelivery: "200 OK",
    successRate: 100,
  },
  {
    id: "whk_old001",
    url: "https://legacy.bilrental.se/email",
    events: ["email.delivered"],
    status: "disabled",
    lastDelivery: "503",
    successRate: 42.0,
  },
];

export const API_KEYS = [
  { id: "key_1", name: "Production", prefix: "pst_live_a1b2c3d4", scopes: ["send", "read"], lastUsed: Date.now() - 60_000, createdAt: Date.now() - 90 * 86400000 },
  { id: "key_2", name: "CI / staging", prefix: "pst_test_q9w8e7r6", scopes: ["send"], lastUsed: Date.now() - 3 * 3600_000, createdAt: Date.now() - 14 * 86400000 },
  { id: "key_3", name: "Local dev (reda)", prefix: "pst_test_z1x2c3v4", scopes: ["send", "read", "admin"], lastUsed: Date.now() - 20 * 86400000, createdAt: Date.now() - 30 * 86400000 },
];

export function dailySeries(days = 30) {
  const r = rand(7);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const base = 600 + Math.floor(r() * 400);
    out.push({
      date: d.toISOString().slice(5, 10),
      sent: base + Math.floor(Math.sin(i / 3) * 120),
      bounced: Math.floor(r() * 8),
      complained: Math.floor(r() * 2),
    });
  }
  return out;
}

export const INVOICES = [
  { id: "inv_2026_04", month: "April 2026", amount: 11.51, status: "paid" },
  { id: "inv_2026_03", month: "March 2026", amount: 14.02, status: "paid" },
  { id: "inv_2026_02", month: "February 2026", amount: 8.71, status: "paid" },
  { id: "inv_2026_01", month: "January 2026", amount: 12.18, status: "paid" },
];

export const CHANGELOG = [
  { date: "2026-05-20", version: "v0.42", type: "Feature", title: "Sending from our own infrastructure", bullets: ["All mail now leaves our own MTAs in the EU. Amazon SES is gone from the sending path.", "Per-domain DKIM keys generated by Postly, RSA-2048, private keys encrypted at rest.", "Bounces and complaints arrive on your own return-path subdomain."] },
  { date: "2026-05-12", version: "v0.41", type: "Improvement", title: "Faster log streaming", bullets: ["`postly logs --tail` now reaches sub-200ms latency."] },
  { date: "2026-05-04", version: "v0.40", type: "Fix", title: "Idempotency edge case", bullets: ["Fixed a race where retried requests with truncated bodies returned 200 without delivering."] },
  { date: "2026-04-22", version: "v0.39", type: "Feature", title: "Postmaster Tools sync", bullets: ["Google Postmaster Tools metrics show up next to your per-domain reputation."] },
  { date: "2026-04-08", version: "v0.38", type: "Feature", title: "Migrate from Resend in one command", bullets: ["`postly migrate --from resend` imports keys, domains, and templates."] },
  { date: "2026-03-30", version: "v0.37", type: "Improvement", title: "DPA auto-sign on signup", bullets: ["The DPA is now auto-countersigned and available at /legal/dpa.pdf."] },
];

export const BLOG_POSTS = [
  { slug: "why-we-built-postly", title: "Why we built Postly: escaping the email-API subscription trap", category: "Product", excerpt: "Resend's price hike was the catalyst, but the real reason runs deeper.", author: "Reda Nilsson", date: "2026-05-22", readTime: "6 min" },
  { slug: "999-uptime-with-one-founder", title: "How we ship 99.9% uptime with one founder", category: "Engineering", excerpt: "Boring infrastructure choices, aggressive timeouts, and a queue that never drops a message.", author: "Reda Nilsson", date: "2026-05-10", readTime: "9 min" },
  { slug: "we-deliver-the-mail-ourselves", title: "GDPR-defensible architecture: we deliver the mail ourselves", category: "Compliance", excerpt: "Why we run our own MTAs in the EU instead of writing a transfer impact assessment, and what is still open.", author: "Reda Nilsson", date: "2026-04-28", readTime: "12 min" },
  { slug: "idempotency-30-day", title: "Idempotency that survives crashes: our 30-day implementation", category: "Engineering", excerpt: "Request-body hashing, dedup keys, and why most idempotency implementations lie.", author: "Reda Nilsson", date: "2026-04-15", readTime: "8 min" },
  { slug: "migrating-from-resend", title: "Migrating from Resend in 5 minutes", category: "Product", excerpt: "Keys, domains, templates: what to expect and where it gets weird.", author: "Reda Nilsson", date: "2026-03-30", readTime: "4 min" },
  { slug: "why-no-open-tracking", title: "Why Postly does not track opens or clicks", category: "Product", excerpt: "Apple Mail broke open rates, rewritten links hurt deliverability, and neither belongs in transactional email.", author: "Reda Nilsson", date: "2026-03-12", readTime: "5 min" },
];

export const CUSTOMERS = [
  { name: "Bokflow", quote: "Switched from Resend after the pricing change. My bill went from $80 to €18 with no DX trade-off.", author: "Anna Lindgren", role: "Founder, Stockholm", metric: "78% lower email cost" },
  { name: "Tallvik", quote: "Knowing the mail leaves their own servers in the EU, not a US provider, ended a procurement argument before it started.", author: "Marcus Berg", role: "CTO", metric: "EU delivery end to end" },
  { name: "Nordvik", quote: "EU hosting plus a signed DPA on day one. That conversation with our compliance team took 4 minutes.", author: "Noor Haddad", role: "Engineering lead", metric: "DPA in 4 minutes" },
  { name: "BraLeads", quote: "The CLI is the dev experience I wanted. `postly logs --tail` is now permanently in a tmux pane.", author: "Lars Eriksson", role: "Solo founder", metric: "100% CLI-first" },
];

export const COMPETITORS = {
  resend: { name: "Resend", per1k: 0.65, free: "3,000/mo", eu: false, tracking: "opt-in", idempotency: "limited", inbound: true, dpa: "paid", smtp: true, cli: true },
  postmark: { name: "Postmark", per1k: 1.15, free: "100/mo", eu: false, tracking: "opt-in", idempotency: "no", inbound: true, dpa: "yes", smtp: true, cli: false },
  lettermint: { name: "Lettermint", per1k: 1.0, free: "300/mo", eu: true, tracking: "opt-in", idempotency: "no", inbound: false, dpa: "yes", smtp: true, cli: false },
  ahasend: { name: "AhaSend", per1k: 0.5, free: "1,000/mo", eu: true, tracking: "opt-in", idempotency: "no", inbound: false, dpa: "yes", smtp: true, cli: false },
  postly: { name: "Postly", per1k: 0.4, free: "3,000/mo", eu: true, tracking: "none", idempotency: "30-day", inbound: "planned", dpa: "auto", smtp: true, cli: true },
};
