import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboard, type EventRow } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Pause, Play, Trash2 } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/app/logs")({
  head: () => ({ meta: [{ title: "Logs - Postly" }] }),
  component: LogsPage,
});

const EVENT_TYPES = [
  { k: "queued", c: "text-[oklch(0.7_0.05_60)]" },
  { k: "sent", c: "text-[oklch(0.7_0.13_240)]" },
  { k: "delivered", c: "text-[oklch(0.75_0.17_145)]" },
  { k: "opened", c: "text-[oklch(0.78_0.17_70)]" },
  { k: "clicked", c: "text-[oklch(0.78_0.17_70)]" },
  { k: "bounced", c: "text-destructive" },
  { k: "complained", c: "text-[oklch(0.78_0.17_85)]" },
];

const EVENT_COLOR_MAP: Record<string, string> = Object.fromEntries(
  EVENT_TYPES.map((e) => [e.k, e.c]),
);

function pad(n: number) { return n.toString().padStart(2, "0"); }
function ts(epoch: number) {
  const d = new Date(epoch);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, "0")}`;
}

function LogsPage() {
  const auth = useAuth();
  const [paused, setPaused] = React.useState(false);
  const [cleared, setCleared] = React.useState(false);
  const [enabledTypes, setEnabledTypes] = React.useState<Set<string>>(
    new Set(EVENT_TYPES.map((e) => e.k)),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "events"],
    queryFn: () => dashboard.events(50),
    enabled: auth.status === "authenticated",
    refetchInterval: paused ? false : 5000,
  });

  const events: EventRow[] = cleared ? [] : (data?.data ?? []);

  const filteredEvents = events.filter((e) => enabledTypes.has(e.type));

  function toggleType(type: string) {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <DashboardLayout title="Logs">
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Real-time event stream across all domains.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span className={`relative inline-flex h-2 w-2 rounded-full ${paused ? "bg-muted-foreground" : "bg-[oklch(0.65_0.17_145)]"}`}>
                {!paused && <span className="absolute inset-0 animate-ping rounded-full bg-[oklch(0.65_0.17_145)] opacity-75" />}
              </span>
              <span className={paused ? "text-muted-foreground" : "text-foreground font-medium"}>{paused ? "Paused" : "Live"}</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => setPaused(!paused)}>
              {paused ? <Play className="mr-2 h-3.5 w-3.5" /> : <Pause className="mr-2 h-3.5 w-3.5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCleared(true)}><Trash2 className="mr-2 h-3.5 w-3.5" />Clear</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
          <aside className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Event types</h4>
              <div className="space-y-1.5">
                {EVENT_TYPES.map((e) => (
                  <label key={e.k} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={enabledTypes.has(e.k)}
                      onCheckedChange={() => toggleType(e.k)}
                    />
                    <span className={`font-mono text-xs ${e.c}`}>{e.k}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>

          <div className="rounded-lg border border-border bg-[oklch(0.13_0.005_60)] font-mono text-[12.5px] leading-relaxed text-[oklch(0.96_0.005_80)]">
            <div className="max-h-[640px] overflow-y-auto p-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-3 py-0.5">
                      <Skeleton className="h-4 w-24 bg-white/10" />
                      <Skeleton className="h-4 w-20 bg-white/10" />
                      <Skeleton className="h-4 w-48 bg-white/10" />
                      <Skeleton className="h-4 w-32 bg-white/10" />
                    </div>
                  ))}
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">Waiting for events...</div>
              ) : (
                filteredEvents.map((e) => (
                  <div key={e.id} className="flex gap-3 py-0.5 hover:bg-white/5 -mx-2 px-2 rounded">
                    <span className="text-[oklch(0.55_0.012_60)]">{ts(e.timestamp)}</span>
                    <span className={`w-[80px] uppercase ${EVENT_COLOR_MAP[e.type] ?? "text-[oklch(0.7_0.05_60)]"}`}>{e.type}</span>
                    <span className="text-[oklch(0.7_0.012_60)]">{e.messageId}</span>
                    <span className="text-[oklch(0.85_0.005_80)] truncate">{e.id}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
