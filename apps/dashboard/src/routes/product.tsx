import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { CodeBlock } from "@/components/code-block";
import { Mail, FileText, Activity, ShieldCheck, Webhook, Inbox, Terminal, Server, Globe } from "lucide-react";

export const Route = createFileRoute("/product")({
  head: () => ({ meta: [{ title: "Product - Postly" }] }),
  component: Product,
});

const SECTIONS = [
  {
    id: "sending",
    icon: Mail,
    title: "Sending API",
    desc: "Send a single email, a batch of up to 500, or schedule something for next Tuesday. Attachments, headers, tags - all available in a single endpoint.",
    bullets: ["Single, batch, scheduled", "Attachments (≤10MB per request)", "Custom headers + tags", "Per-message reply-to"],
    code: `await postly.emails.send({\n  from: 'team@bokflow.se',\n  to: ['anna@example.com'],\n  subject: 'Receipt',\n  html: tpl(receipt),\n  tags: ['billing'],\n});`,
  },
  {
    id: "templates",
    icon: FileText,
    title: "Templates",
    desc: "React Email, MJML, or raw HTML. Versioned. Test-renderable from the CLI. Variables auto-typed from your JSX.",
    bullets: ["React Email + MJML + HTML", "Version history per template", "Type-safe variables", "Test send from CLI"],
    code: `postly templates push ./emails/welcome.tsx \\\n  --slug welcome-email`,
  },
  {
    id: "deliverability",
    icon: Activity,
    title: "Deliverability autopilot",
    desc: "We watch your complaint and bounce rates. Cross the threshold and we pause your sending and tell you, before the mailbox providers make the decision for you.",
    bullets: ["Per-tenant sending limits", "Auto-pause on complaint or hard-bounce spikes", "Hard and soft bounces told apart", "Google Postmaster + MS SNDS"],
    code: `# in your repo\npostly deliverability watch --threshold 0.1`,
  },
  {
    id: "idempotency",
    icon: ShieldCheck,
    title: "Idempotency",
    desc: "30-day retention, body-hash verification. Retrying a request with the same key returns the original send, even after a deploy.",
    bullets: ["30-day retention (not 24h)", "Body-hash validation", "Per-tenant key scope", "Idempotent-replayed counters in logs"],
    code: `Idempotency-Key: invoice-2026-04-21-anna`,
  },
  {
    id: "webhooks",
    icon: Webhook,
    title: "Webhooks",
    desc: "HMAC-signed, replayable from the dashboard. Filter by event type. Retries with exponential backoff up to 5 days.",
    bullets: ["HMAC SHA-256 signing", "Replay from dashboard", "Per-event filtering", "5-day retry window"],
    code: `# verifying a webhook in node\nconst valid = postly.webhooks.verify(req.body, req.headers);`,
  },
  {
    id: "inbound",
    icon: Inbox,
    title: "Inbound parsing (planned)",
    desc: "Receive mail at inbound.bokflow.se, with parsed fields delivered as a webhook. Being built after launch, not available yet.",
    bullets: ["MIME-parsed JSON payload", "Attachments → EU object storage", "Per-recipient routing", "SPF/DKIM verification metadata"],
    code: `POST https://hooks.bokflow.se/inbound`,
  },
  {
    id: "cli",
    icon: Terminal,
    title: "CLI",
    desc: "Your terminal is the dashboard. Domain setup, sends, logs, migrations - all available without leaving your editor.",
    bullets: ["postly init <domain>", "postly logs --tail", "postly send + dry-run", "postly migrate --from <vendor>"],
    code: `brew install postly\npostly login\npostly logs --tail`,
  },
  {
    id: "delivery",
    icon: Server,
    title: "Our own delivery infrastructure",
    desc: "Postly runs its own MTAs in the EU. We generate a DKIM key per domain, sign every message, shape traffic per mailbox provider and take the bounces back on your own return-path subdomain. There is no Amazon SES, and no other US email provider, in the path.",
    bullets: ["Own MTAs in the EU, no third party in the send path", "RSA-2048 DKIM per domain, keys encrypted at rest", "Per-provider traffic shaping and retries", "Bounces and ARF complaints correlated per message"],
    code: `postly domain:add bokflow.se
# publish the DKIM, return-path and SPF records it prints`,
  },
  {
    id: "compliance",
    icon: Globe,
    title: "EU compliance",
    desc: "Auto-signed DPA. Subprocessor list in the docs. Your mail is delivered from EU infrastructure we operate ourselves, and the full subprocessor list says who else touches anything.",
    bullets: ["Auto-signed DPA on signup", "Public subprocessor list", "EU-only storage and delivery", "ISO 27001 in progress (2027)"],
    code: `# DPA is auto-counter-signed and available at /legal/dpa`,
  },
];

function Product() {
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            One small API, the bits you actually need.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Everything Postly does, in scrolling depth. Jump to a section or read through. It's roughly in order of how you'd touch them.
          </p>
          <nav className="mt-10 flex flex-wrap gap-3 text-sm">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-md border border-border bg-card px-3 py-1.5 text-muted-foreground hover:text-foreground">
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {SECTIONS.map((s, i) => {
        const Icon = s.icon;
        return (
          <section key={s.id} id={s.id} className={`border-b border-border ${i % 2 ? "bg-secondary/30" : ""}`}>
            <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
              <div>
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">{s.title}</h2>
                <p className="mt-4 text-muted-foreground">{s.desc}</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2"><span className="text-primary">▪</span>{b}</li>
                  ))}
                </ul>
              </div>
              <div>
                <CodeBlock code={s.code} />
              </div>
            </div>
          </section>
        );
      })}

      <section>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold">Ready to send your first email?</h2>
          <Link to="/signup" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Start free
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
