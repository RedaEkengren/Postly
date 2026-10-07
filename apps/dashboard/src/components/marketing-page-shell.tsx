import * as React from "react";
import { MarketingLayout } from "@/components/marketing-layout";

export function MarketingPageShell({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-20 md:py-24">
          {eyebrow && <div className="text-xs uppercase tracking-wider text-primary">{eyebrow}</div>}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          {lead && <p className="mt-5 text-lg text-muted-foreground">{lead}</p>}
        </div>
      </section>
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-16 prose prose-neutral dark:prose-invert">
          {children}
        </div>
      </section>
    </MarketingLayout>
  );
}
