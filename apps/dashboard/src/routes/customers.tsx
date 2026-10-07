import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { CUSTOMERS } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "Customers - Postly" }] }),
  component: Customers,
});

function Customers() {
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Built by builders, used by builders.</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Bootstrapped EU SaaS companies, indie devs, and small teams who got tired of subscription pricing.
          </p>
          <div className="mt-12 flex flex-wrap gap-x-12 gap-y-4 text-lg font-semibold text-muted-foreground">
            {["Bokflow", "Tallvik", "BilRental", "Nordvik", "BraLeads", "Hetzner Tools", "Nordic Stack", "Stockholm Index"].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
        </div>
      </section>
      <section>
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-2">
            {CUSTOMERS.map((c) => (
              <div key={c.author} className="rounded-2xl border border-border bg-card p-8">
                <div className="text-sm font-medium text-primary">{c.name}</div>
                <blockquote className="mt-3 text-xl leading-relaxed">"{c.quote}"</blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <Avatar><AvatarFallback className="bg-primary/10 text-xs text-primary">{c.author.split(" ").map(s => s[0]).join("")}</AvatarFallback></Avatar>
                  <div>
                    <div className="text-sm font-medium">{c.author}</div>
                    <div className="text-xs text-muted-foreground">{c.role}</div>
                  </div>
                  <div className="ml-auto rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{c.metric}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
