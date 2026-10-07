import { createFileRoute, Link, type LinkProps } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import * as React from "react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { COMPETITORS } from "@/lib/mock-data";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing - Postly" }] }),
  component: Pricing,
});

const FEATURES = [
  ["Pay-as-you-go pricing", true, true],
  ["Free 3,000 emails / month (100 / day)", true, true],
  ["Delivered from our own EU infrastructure", true, true],
  ["Per-domain DKIM keys", true, true],
  ["Unlimited domains", false, true],
  ["Reputation protection (auto-pause)", true, true],
  ["Idempotency (30-day)", true, true],
  ["Webhooks (HMAC-signed)", true, true],
  ["CLI + SDKs (Node, PHP, Python, Go)", true, true],
  ["Templates (MJML + variables)", true, true],
  ["Batch sends", false, true],
  ["Dedicated IPs", false, "planned"],
  ["Inbound parsing", false, "planned"],
  ["Auto-signed DPA", true, true],
  ["Premium support SLA", false, "add-on"],
] as const;

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check className="h-4 w-4 text-primary" />;
  if (v === false) return <Minus className="h-4 w-4 text-muted-foreground/40" />;
  return <span className="text-xs text-muted-foreground">{v}</span>;
}

type PlanCardProps = { name: string; price: string; sub: string; features: string[]; primary?: boolean; footer: React.ReactNode; href: LinkProps["to"] };

function PlanCard({ name, price, sub, features, primary, footer, href }: PlanCardProps) {
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
          <Link to={href}>{footer}</Link>
        </Button>
      </div>
    </div>
  );
}

function Calculator() {
  const [vol, setVol] = React.useState(50000);
  const cost = (k: keyof typeof COMPETITORS) => (vol / 1000) * COMPETITORS[k].per1k;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-10">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Monthly volume</div>
          <div className="mt-1 font-mono text-3xl font-semibold">{vol.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Postly cost</div>
          <div className="mt-1 font-mono text-3xl font-semibold text-primary">€{cost("postly").toFixed(2)}</div>
        </div>
      </div>
      <Slider value={[vol]} min={1000} max={2_000_000} step={1000} onValueChange={(v) => setVol(v[0])} className="mt-6" />
      <div className="mt-8 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        {(["resend", "postmark", "lettermint", "ahasend"] as const).map((k) => {
          const diff = cost(k) - cost("postly");
          return (
            <div key={k} className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs text-muted-foreground">{COMPETITORS[k].name}</div>
              <div className="mt-1 font-mono text-xl font-semibold">€{cost(k).toFixed(2)}</div>
              <div className={`mt-1 text-xs ${diff > 0 ? "text-success" : "text-muted-foreground"}`}>
                {diff > 0 ? `Save €${diff.toFixed(2)}/mo` : "-"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pricing() {
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center md:py-28">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Pay only for what you send.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            No tiers, no surprises, no negotiations. The same €0.40 per 1,000 emails whether you send 5k or 5M.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            <PlanCard name="Free" price="€0" sub="/forever" href="/signup"
              features={["3,000 emails / month (100 / day)", "1 domain with its own DKIM key", "All SDKs + CLI", "Webhooks + idempotency", "Community support"]}
              footer="Start free" />
            <PlanCard name="Pay-as-you-go" price="€0.40" sub="per 1,000 emails" primary href="/signup"
              features={["No subscription, no tiers", "Unlimited domains", "Reputation protection built in", "30-day idempotency", "99.9% uptime SLA"]}
              footer="Start sending" />
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold">Feature comparison</h2>
            <p className="mt-3 text-muted-foreground">What's in each plan, in one table.</p>
          </div>
          <div className="mt-10 overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-secondary/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium"> </th>
                  <th className="px-4 py-3 font-medium">Free</th>
                  <th className="px-4 py-3 font-semibold text-primary">Pay-as-you-go</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((row) => (
                  <tr key={row[0] as string} className="border-t border-border">
                    <td className="px-4 py-3">{row[0]}</td>
                    {row.slice(1).map((v, i) => (
                      <td key={i} className="px-4 py-3"><Cell v={v} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-3xl font-semibold">Credit packs</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Prepay if you prefer. Credits never expire.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { n: "10,000", price: "€3.80", off: "5% off" },
              { n: "100,000", price: "€36.00", off: "10% off" },
              { n: "1,000,000", price: "€340.00", off: "15% off" },
            ].map((p) => (
              <div key={p.n} className="rounded-xl border border-border bg-card p-6">
                <div className="text-sm text-muted-foreground">{p.n} credits</div>
                <div className="mt-2 font-mono text-3xl font-semibold">{p.price}</div>
                <div className="mt-1 text-xs text-primary">{p.off}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-3xl font-semibold">Add-ons</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { name: "Dedicated IP", price: "Planned", desc: "Once our shared pool is warm enough to carve one out." },
              { name: "Inbound parsing", price: "Planned", desc: "Receive at your subdomain, get a webhook." },
              { name: "Premium support", price: "Contact sales", desc: "30-min SLA, dedicated Slack, named contact." },
            ].map((a) => (
              <div key={a.name} className="rounded-xl border border-border bg-card p-6">
                <div className="text-base font-semibold">{a.name}</div>
                <div className="mt-1 font-mono text-sm text-primary">{a.price}</div>
                <div className="mt-3 text-sm text-muted-foreground">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold">Calculate your bill.</h2>
            <p className="mt-3 text-muted-foreground">We compete on transparency, not pricing pages.</p>
          </div>
          <div className="mt-10"><Calculator /></div>
        </div>
      </section>

      <section className="bg-secondary/30">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-semibold">Pricing FAQ</h2>
          <Accordion type="single" collapsible className="mt-8">
            {[
              ["What's the catch on Free?", "There isn't one. 3,000 emails/month, 1 domain, all SDKs, the same idempotency and webhooks. We make money when you grow."],
              ["Do I pay for bounced or rejected emails?", "Bounced: yes, we attempted the delivery. Rejected before we attempt it (a suppressed address, a failed vars_schema): no."],
              ["Annual contracts?", "Available on request, with a 5% discount above 1M emails/month. We're happy to draft one, but pay-as-you-go usually wins."],
              ["Do you accept SEPA / invoicing?", "Yes, for >€100/month spend. Card by default via Stripe."],
            ].map(([q, a]) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-base">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </MarketingLayout>
  );
}
