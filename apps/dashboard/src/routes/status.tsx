import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";

export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: "Status - Postly" }] }),
  component: Status,
});

const SERVICES = [
  ["API", "operational"],
  ["Send Queue", "operational"],
  ["Outbound MTA", "operational"],
  ["Bounce and complaint intake", "operational"],
  ["Webhooks", "operational"],
  ["Dashboard", "operational"],
] as const;

function Bars() {
  const days = 90;
  const bars = Array.from({ length: days }, (_, i) => {
    const r = ((i * 31) % 97) / 97;
    return r > 0.97 ? "degraded" : "ok";
  });
  return (
    <div className="mt-3 flex h-7 gap-[2px]">
      {bars.map((b, i) => (
        <div key={i} className={`flex-1 rounded-[2px] ${b === "ok" ? "bg-[oklch(0.65_0.17_145)]" : "bg-[oklch(0.78_0.17_85)]"}`} />
      ))}
    </div>
  );
}

function Status() {
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight">Status</h1>
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[oklch(0.65_0.17_145)]" />
              <div className="text-lg font-semibold">All systems operational</div>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">Last updated just now · checked every 60 seconds</div>
          </div>
        </div>
      </section>
      <section>
        <div className="mx-auto max-w-4xl px-6 py-12 space-y-6">
          {SERVICES.map(([name, _state]) => (
            <div key={name} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="font-medium">{name}</div>
                <div className="text-xs text-success">Operational · 99.95% (90d)</div>
              </div>
              <Bars />
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
