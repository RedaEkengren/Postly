import type { ComponentProps } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Badge } from "@/components/ui/badge";
import { CHANGELOG } from "@/lib/mock-data";

export const Route = createFileRoute("/changelog")({
  head: () => ({ meta: [{ title: "Changelog - Postly" }] }),
  component: Changelog,
});

const TYPE_VARIANT: Record<string, ComponentProps<typeof Badge>["variant"]> = {
  Feature: "default",
  Improvement: "secondary",
  Fix: "outline",
};

function Changelog() {
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Changelog</h1>
          <p className="mt-4 text-muted-foreground">Releases, improvements, and the occasional admission of a fix.</p>
        </div>
      </section>
      <section>
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="space-y-12">
            {CHANGELOG.map((e) => (
              <div key={e.version} className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                <div className="text-sm text-muted-foreground">
                  <div className="font-mono">{e.version}</div>
                  <div>{e.date}</div>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <Badge variant={TYPE_VARIANT[e.type] ?? "default"}>{e.type}</Badge>
                    <h3 className="text-lg font-semibold">{e.title}</h3>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {e.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
