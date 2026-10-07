import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About - Postly" }] }),
  component: About,
});

function About() {
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">About Postly</h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Postly is a small, founder-led company in Stockholm. We build transactional email infrastructure that's honestly priced and EU-resident by default.
          </p>
        </div>
      </section>
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-[200px_1fr]">
          <div className="h-48 w-48 rounded-xl bg-gradient-to-br from-teal-500/40 to-emerald-500/20" />
          <div>
            <h2 className="text-2xl font-semibold">The story</h2>
            <p className="mt-4 text-muted-foreground">
              I'm Reda, a solo Swedish developer with a cloud infrastructure background. I built Postly after one too many email-API price hikes priced bootstrapped SaaS founders out of the market.
            </p>
            <p className="mt-3 text-muted-foreground">
              Postly started as a control plane in front of Amazon SES. That made every email transit a US provider, and it made the business one suspended account away from stopping. So we built the sending side ourselves: our own MTAs in the EU, our own DKIM keys, our own IP reputation to earn. Charge €0.40 per 1,000 emails. Don't add subscription tiers that punish growth.
            </p>
            <p className="mt-3 text-muted-foreground">
              That's it. The rest is execution.
            </p>
          </div>
        </div>
      </section>
      <section className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold">Values</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {[
              ["Honesty in pricing", "Public unit economics. Every email you are billed for is in your logs. No surprise tier-jumps."],
              ["EU-first", "Stockholm control plane, our own delivery in the EU, auto-signed DPA. Nobody else accepts, signs or delivers your mail."],
              ["Developer-first", "If it's not in the CLI, it doesn't really exist."],
              ["Own the stack", "We use boring, reliable infrastructure we can debug. No layers we can't see through."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-border bg-card p-6">
                <div className="text-base font-semibold">{t}</div>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="hiring">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="flex items-start gap-4">
            <MapPin className="mt-1 h-5 w-5 text-primary" />
            <div>
              <div className="text-lg font-semibold">Stockholm, Sweden</div>
              <p className="mt-1 text-sm text-muted-foreground">Hötorget area. Remote-friendly across the EU.</p>
            </div>
          </div>
          <div className="mt-10 rounded-xl border border-border bg-card p-6">
            <div className="text-base font-semibold">We're hiring</div>
            <p className="mt-2 text-sm text-muted-foreground">Looking for an early infrastructure engineer who'd enjoy working on EU email deliverability all day.</p>
            <a href="mailto:hello@postly.eu" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">hello@postly.eu →</a>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
