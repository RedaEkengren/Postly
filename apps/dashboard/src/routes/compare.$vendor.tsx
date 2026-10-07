import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";
import { COMPETITORS } from "@/lib/mock-data";

export const Route = createFileRoute("/compare/$vendor")({
  head: ({ params }) => ({
    meta: [{ title: `Postly vs ${params.vendor.charAt(0).toUpperCase() + params.vendor.slice(1)} - Postly` }],
  }),
  component: Compare,
});

const COPY: Record<string, { tagline: string; sub: string; migrate: string }> = {
  resend: {
    tagline: "Postly vs Resend",
    sub: "Same DX, delivered from our own EU infrastructure, no surprise price hikes.",
    migrate: `postly migrate --from resend --api-key $RESEND_API_KEY`,
  },
  postmark: {
    tagline: "Postly vs Postmark",
    sub: "Postmark's reliability, at a fraction of the per-email price.",
    migrate: `postly migrate --from postmark --server-token $PM_TOKEN`,
  },
  lettermint: {
    tagline: "Postly vs Lettermint",
    sub: "Also EU-based, but we run the sending infrastructure ourselves and price it for builders.",
    migrate: `postly migrate --from lettermint --api-key $LM_KEY`,
  },
  ahasend: {
    tagline: "Postly vs AhaSend",
    sub: "Same EU roots, lower per-email price, and our own MTAs behind it.",
    migrate: `postly migrate --from ahasend --api-key $AHASEND_KEY`,
  },
};

function Compare() {
  const { vendor } = useParams({ from: "/compare/$vendor" });
  const v = COMPETITORS[vendor as keyof typeof COMPETITORS] ?? COMPETITORS.resend;
  const c = COPY[vendor] ?? COPY.resend;

  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">{c.tagline}</h1>
          <p className="mt-5 text-lg text-muted-foreground">{c.sub}</p>
          <div className="mt-8 flex gap-3">
            <Button asChild><Link to="/signup">Start migration</Link></Button>
            <Button asChild variant="outline"><Link to="/pricing">See pricing</Link></Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-secondary/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium"> </th>
                  <th className="px-4 py-3 font-semibold text-primary">Postly</th>
                  <th className="px-4 py-3 font-medium">{v.name}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Pricing / 1k", "€0.40", `€${v.per1k.toFixed(2)}`],
                  ["Free tier", "3,000/mo", v.free],
                  ["EU hosting", "✓", v.eu ? "✓" : "-"],
                  ["Own delivery infrastructure", "✓", "-"],
                  ["Open/click tracking", "none", String(v.tracking)],
                  ["Idempotency", "30-day", String(v.idempotency)],
                  ["Inbound", "planned", v.inbound ? "✓" : "-"],
                  ["GDPR DPA", "auto-signed", String(v.dpa)],
                  ["CLI", "✓", v.cli ? "✓" : "-"],
                ].map((row) => (
                  <tr key={row[0]} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-muted-foreground">{row[0]}</td>
                    <td className="bg-primary/[0.04] px-4 py-3 font-medium text-primary">{row[1]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold">Migrate in 5 minutes</h2>
          <p className="mt-3 text-muted-foreground">One command imports your API keys, domains, and templates.</p>
          <div className="mt-6"><CodeBlock code={c.migrate} /></div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <blockquote className="text-xl leading-relaxed">
            "Switched from {v.name} after the pricing change. My bill went from $80 to €18 with no DX trade-off."
          </blockquote>
          <div className="mt-4 text-sm text-muted-foreground">- Anna Lindgren, founder, Stockholm</div>
        </div>
      </section>
    </MarketingLayout>
  );
}
