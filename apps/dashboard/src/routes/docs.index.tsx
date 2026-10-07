import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Zap, Globe, Webhook, Terminal, FileText, ShieldCheck, Code2 } from "lucide-react";
import { DocsSearchCommand } from "@/components/docs-search";

export const Route = createFileRoute("/docs/")({
  head: () => ({ meta: [{ title: "Docs - Postly" }] }),
  component: DocsIndex,
});

const SECTIONS = [
  { icon: Zap, title: "Getting Started", links: ["Quickstart", "Authentication", "First send", "SDKs"] },
  { icon: Globe, title: "Domains", links: ["Add a domain", "DKIM / SPF / DMARC", "MAIL FROM", "Postmaster Tools"] },
  { icon: FileText, title: "Sending Email", links: ["Single", "Batch", "Scheduled", "Attachments"] },
  { icon: Webhook, title: "Webhooks", links: ["Subscribing", "HMAC verification", "Replay", "Events reference"] },
  { icon: Terminal, title: "CLI", links: ["Install", "postly init", "postly logs", "postly migrate"] },
  { icon: BookOpen, title: "Migration Guides", links: ["From Resend", "From Postmark", "From Lettermint", "From AhaSend"] },
  { icon: ShieldCheck, title: "Compliance", links: ["Data residency", "DPA", "Subprocessors", "Security"] },
  { icon: Code2, title: "API Reference", links: ["Emails", "Domains", "Webhooks", "Templates"] },
];

function DocsIndex() {
  return (
    <>
      <section className="border-b border-border bg-secondary/30">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Postly docs</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Everything you need to send your first email, and your billionth.
          </p>
          <div className="mt-8">
            <DocsSearchCommand />
          </div>
        </div>
      </section>
      <section>
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="text-base font-semibold">{s.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {s.links.map((l) => {
                      const isApiRef = s.title === "API Reference";
                      return (
                        <li key={l}>
                          <Link
                            to={isApiRef ? "/docs/api-reference" : "/docs/$slug"}
                            params={isApiRef ? {} : { slug: l.toLowerCase().replace(/\s+/g, "-") }}
                            hash={isApiRef ? l.toLowerCase() : undefined}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {l}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              ["Send your first email in 60 seconds", "Quickstart that doesn't waste your time."],
              ["Set up DKIM / SPF / DMARC", "The DNS records you actually need, copy-paste ready."],
              ["Migrate from Resend in 5 minutes", "Keys, domains, templates, all imported."],
            ].map(([t, d]) => (
              <Link key={t} to="/docs/$slug" params={{ slug: t.toLowerCase().replace(/[^a-z0-9]+/g, "-") }} className="rounded-xl border border-border bg-card p-6 hover:border-primary/40">
                <div className="text-base font-semibold">{t}</div>
                <div className="mt-2 text-sm text-muted-foreground">{d}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
