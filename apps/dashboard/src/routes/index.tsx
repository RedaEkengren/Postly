import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles, ShieldCheck, Zap, LifeBuoy, Terminal, Activity, Globe, type LucideIcon } from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { CodeBlock } from "@/components/code-block";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COMPETITORS, CUSTOMERS } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Postly - Transactional email for EU developers" }] }),
  component: Landing,
});

const NODE = `import { Postly } from '@postly/node';

const postly = new Postly({
  apiKey: process.env.POSTLY_API_KEY,
});

await postly.emails.send({
  from: 'reda@bokflow.se',
  to: 'customer@example.com',
  subject: 'Your invoice is ready',
  html: '<p>Hi Anna, invoice attached.</p>',
  idempotency_key: 'inv-2026-04-21',
});`;

const PHP = `<?php
use Postly\\Postly;

$postly = new Postly(getenv('POSTLY_API_KEY'));

$postly->emails->send([
  'from'    => 'reda@bokflow.se',
  'to'      => 'customer@example.com',
  'subject' => 'Your invoice is ready',
  'html'    => '<p>Hi Anna, your invoice is attached.</p>',
]);`;

const PY = `from postly import Postly

postly = Postly(api_key=os.environ["POSTLY_API_KEY"])

postly.emails.send(
    from_="reda@bokflow.se",
    to="customer@example.com",
    subject="Your invoice is ready",
    html="<p>Hi Anna, your invoice is attached.</p>",
)`;

const CURL = `curl https://api.postly.eu/v1/emails \\
  -u "$POSTLY_API_KEY:" \\
  -H "Idempotency-Key: inv-2026-04-21" \\
  -d from="reda@bokflow.se" \\
  -d to="customer@example.com" \\
  -d subject="Your invoice is ready" \\
  -d html="<p>Invoice attached.</p>"`;

function formatEur(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
}

function Calculator() {
  const [vol, setVol] = React.useState(50000);
  const cost = (vendor: keyof typeof COMPETITORS) => Math.max(0, (vol / 1000) * COMPETITORS[vendor].per1k);
  const rows = [
    { key: "postly" as const, label: "Postly" },
    { key: "resend" as const, label: "Resend" },
    { key: "postmark" as const, label: "Postmark" },
    { key: "lettermint" as const, label: "Lettermint" },
    { key: "ahasend" as const, label: "AhaSend" },
  ];
  const max = Math.max(...rows.map((r) => cost(r.key)));
  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-10">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-medium text-muted-foreground">Emails per month</div>
          <div className="mt-1 font-mono text-3xl font-semibold tracking-tight">
            {vol.toLocaleString()}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Slide to compare. Numbers are the vendor's published rate.
        </div>
      </div>
      <Slider
        value={[vol]}
        min={1000}
        max={1_000_000}
        step={1000}
        onValueChange={(v) => setVol(v[0])}
        className="mt-6"
      />
      <div className="mt-8 space-y-3">
        {rows.map((r) => {
          const c = cost(r.key);
          const pct = max === 0 ? 0 : (c / max) * 100;
          const isPostly = r.key === "postly";
          return (
            <div key={r.key} className="grid grid-cols-12 items-center gap-3">
              <div className={`col-span-3 text-sm ${isPostly ? "font-semibold" : ""}`}>{r.label}</div>
              <div className="col-span-7">
                <div className="h-7 w-full rounded-md bg-secondary">
                  <div
                    className={`h-full rounded-md ${isPostly ? "bg-primary" : "bg-muted-foreground/30"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className={`col-span-2 text-right font-mono text-sm ${isPostly ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                {formatEur(c)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 text-xs text-muted-foreground">
        Postly: €0.40 / 1k. Resend: ~€0.65 / 1k ($0.70). Postmark: ~€1.15 / 1k ($1.25). Lettermint: €1.00 / 1k. AhaSend: €0.50 / 1k. USD prices converted at approximate rates.
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

type PlanCardProps = { name: string; price: string; sub: string; features: string[]; primary?: boolean; footer: React.ReactNode };

function PlanCard({ name, price, sub, features, primary, footer }: PlanCardProps) {
  return (
    <div className={`flex flex-col rounded-2xl border p-7 ${primary ? "border-primary/60 bg-card ring-1 ring-primary/20" : "border-border bg-card"}`}>
      <div className="text-sm font-medium text-muted-foreground">{name}</div>
      <div className="mt-3 flex items-baseline gap-1">
        <div className="text-4xl font-semibold tracking-tight">{price}</div>
        <div className="text-sm text-muted-foreground">{sub}</div>
      </div>
      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map((f: string) => (
          <li key={f} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <Button asChild variant={primary ? "default" : "outline"} className="w-full">
          <Link to="/signup">{footer}</Link>
        </Button>
      </div>
    </div>
  );
}

const FAQ = [
  ["Is this really cheaper than Resend or Postmark?",
    "Usually yes, at any volume above the free tier. Resend is ~€0.65/1k after their free 3,000; we're €0.40/1k. Postmark is ~€1.15/1k. There's no subscription with Postly, so the math doesn't change with usage tiers."],
  ["How is data residency handled?",
    "Postly signs and delivers your email from its own servers in the EU. There is no Amazon SES, and no other US email provider, between your app and the recipient's mail server. Your data and your messages are stored in the EU."],
  ["What happens when a mailbox provider pushes back?",
    "Every message is stored before we answer your API call, then queued and retried with backoff. Our MTA shapes traffic per provider, so Gmail, Outlook and Yahoo rate limits slow us down instead of bouncing your mail. Each message shows its status and the receiving server's SMTP response."],
  ["Can I migrate later?",
    "Yes, in either direction. The REST API is documented with an OpenAPI spec, so switching providers is a code change, not a project."],
  ["Is there an SLA?",
    "Free tier: best-effort. Pay-as-you-go: 99.9% monthly uptime."],
  ["Do you offer dedicated IPs?",
    "Not yet. Everyone sends from our shared pool, which is protected by automatic pauses on bounce and complaint spikes. Dedicated IPs for high-volume senders are planned."],
  ["Why €0.40 and not $0.40?",
    "Because we're a Swedish company, our costs are in euros, and so are our customers'. No currency conversion on your invoice."],
  ["Do you track opens and clicks?",
    "No. No tracking pixels, no rewritten links. Transactional email doesn't need them, Apple Mail makes open rates meaningless, and it keeps your mail out of ePrivacy questions."],
  ["Do you support inbound email?",
    "Not yet. Inbound parsing is on the roadmap after launch."],
  ["Will my pricing change?",
    "Not without 90 days' written notice. And we'll grandfather existing customers on the previous rate for at least 12 months."],
];

function Landing() {
  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[500px]" />
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.15] [mask-image:radial-gradient(60%_50%_at_50%_30%,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="grid items-start gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                🇪🇺 Built in Sweden · Hosted in the EU
              </span>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.04] md:text-6xl lg:text-7xl">
                Transactional email that respects your unit economics.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
                €0.40 per 1,000 emails. No subscriptions. Delivered from our own infrastructure in the EU, with no Amazon in between.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/signup">Start sending free <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link to="/docs">Read the docs</Link>
                </Button>
              </div>
              <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-muted-foreground">
                <span className="text-xs uppercase tracking-wider">Trusted by</span>
                {["Bokflow", "Tallvik", "BilRental", "Nordvik", "BraLeads"].map((n) => (
                  <span key={n} className="font-medium text-foreground/80">{n}</span>
                ))}
              </div>
            </div>
            <div className="min-w-0 lg:col-span-5">
              <Tabs defaultValue="node">
                <TabsList className="bg-secondary">
                  <TabsTrigger value="node">Node</TabsTrigger>
                  <TabsTrigger value="php">PHP</TabsTrigger>
                  <TabsTrigger value="py">Python</TabsTrigger>
                  <TabsTrigger value="curl">curl</TabsTrigger>
                </TabsList>
                <TabsContent value="node"><CodeBlock code={NODE} /></TabsContent>
                <TabsContent value="php"><CodeBlock code={PHP} /></TabsContent>
                <TabsContent value="py"><CodeBlock code={PY} /></TabsContent>
                <TabsContent value="curl"><CodeBlock code={CURL} /></TabsContent>
              </Tabs>
              <div className="mt-3 text-xs text-muted-foreground">
                One endpoint. 30-day idempotency. EU-resident.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CALCULATOR */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              The pricing math nobody else shows you.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Drag the slider. We'll do the same arithmetic your CFO would.
            </p>
          </div>
          <div className="mt-10"><Calculator /></div>
        </div>
      </section>

      {/* THREE WAYS */}
      <section className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Two ways to pay.</h2>
            <p className="mt-4 text-muted-foreground">
              Start free, then pay for what you send.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            <PlanCard
              name="Free"
              price="€0"
              sub="/forever"
              features={[
                "3,000 emails / month (100 / day)",
                "1 domain with its own DKIM key",
                "All SDKs + CLI",
                "Webhooks + idempotency",
              ]}
              footer="Start free"
            />
            <PlanCard
              name="Pay-as-you-go"
              price="€0.40"
              sub="per 1,000 emails"
              primary
              features={[
                "No subscription, no tiers",
                "Unlimited domains",
                "Automatic reputation protection",
                "Templates, batch sends, webhooks",
              ]}
              footer="Start sending"
            />
          </div>
        </div>
      </section>

      {/* EU FEATURES */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Built for the EU stack.</h2>
            <p className="mt-4 text-muted-foreground">
              GDPR isn't a feature, it's the floor. Here's what's above it.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <FeatureCard icon={Globe} title="Our own delivery, in the EU">
              Postly signs and delivers your mail from its own servers, with a DKIM key generated for each of your domains. No Amazon SES, no US email provider in the path.
            </FeatureCard>
            <FeatureCard icon={ShieldCheck} title="GDPR-ready">
              Auto-signed DPA, transparent subprocessor list, retention you control. Compliance reviews stop being a project.
            </FeatureCard>
            <FeatureCard icon={Zap} title="Idempotency that survives crashes">
              30-day retention, request-body hashing, no duplicate sends. The same key two days later still wins.
            </FeatureCard>
            <FeatureCard icon={LifeBuoy} title="Reputation protection">
              Hard and soft bounces told apart, complaints suppressed, and automatic pauses on bounce or complaint spikes. One bad sender can't sink the pool.
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* DX */}
      <section className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Developer experience that doesn't suck.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <DXCard icon={Terminal} title="CLI for everything" code="postly init bokflow.se" sub="Auto-configures DNS via your provider." />
            <DXCard icon={Activity} title="Real-time logs" code="postly logs --tail" sub="Streams events into your terminal." />
            <DXCard icon={Sparkles} title="One-command migration" code="postly migrate --from resend" sub="Imports keys, domains, templates." />
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              How we stack up.
            </h2>
            <p className="mt-4 text-muted-foreground">Real published numbers. No vibes-pricing.</p>
          </div>
          <div className="mt-10 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium"> </th>
                  <th className="px-4 py-3 font-semibold text-primary">Postly</th>
                  <th className="px-4 py-3 font-medium">Resend</th>
                  <th className="px-4 py-3 font-medium">Postmark</th>
                  <th className="px-4 py-3 font-medium">Lettermint</th>
                  <th className="px-4 py-3 font-medium">AhaSend</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Pricing / 1k", "€0.40", "~€0.65", "~€1.15", "€1.00", "€0.50"],
                  ["Free tier", "3,000/mo", "3,000/mo", "100/mo", "300/mo", "1,000/mo"],
                  ["EU hosting", "✓", "-", "-", "✓", "✓"],
                  ["Idempotency", "30-day", "limited", "-", "-", "-"],
                  ["Open/click tracking", "none", "opt-in", "opt-in", "-", "-"],
                  ["Inbound", "planned", "✓", "✓", "-", "-"],
                  ["GDPR DPA", "auto", "paid", "✓", "✓", "✓"],
                  ["CLI", "✓", "✓", "-", "-", "-"],
                ].map((row) => (
                  <tr key={row[0]} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-muted-foreground">{row[0]}</td>
                    <td className="bg-primary/[0.04] px-4 py-3 font-medium text-primary">{row[1]}</td>
                    {row.slice(2).map((c, i) => (
                      <td key={i} className="px-4 py-3 text-muted-foreground">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              What builders are saying.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {CUSTOMERS.map((c) => (
              <Card key={c.author} className="border-border shadow-none">
                <CardContent className="pt-6">
                  <p className="text-sm leading-relaxed">"{c.quote}"</p>
                  <div className="mt-5 flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                        {c.author.split(" ").map((s) => s[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{c.author}</div>
                      <div className="text-xs text-muted-foreground">{c.role}</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-4 text-[10px] uppercase tracking-wider">
                    {c.metric}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Frequently asked.</h2>
          <Accordion type="single" collapsible className="mt-10">
            {FAQ.map(([q, a]) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-left text-base">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Start sending in 60 seconds.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Free 3,000 emails/month forever. No credit card. Cancel anytime - there's nothing to cancel.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">Create your account</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

function DXCard({ icon: Icon, title, code, sub }: { icon: LucideIcon; title: string; code: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <div className="mt-4">
        <CodeBlock code={code} />
      </div>
    </div>
  );
}
