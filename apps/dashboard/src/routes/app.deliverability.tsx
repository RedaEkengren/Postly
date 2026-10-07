import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboard } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DOMAINS, dailySeries } from "@/lib/mock-data";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Mail, MessageSquare, Hash, type LucideIcon } from "lucide-react";

export const Route = createFileRoute("/app/deliverability")({
  head: () => ({ meta: [{ title: "Deliverability - Postly" }] }),
  component: Deliverability,
});

const complaintSeries = dailySeries(30).map((d) => ({ ...d, rate: 0.02 + Math.random() * 0.06 }));
const bounceSeries = dailySeries(30).map((d) => ({ ...d, rate: 0.3 + Math.random() * 0.4 }));
const latencySeries = dailySeries(30).map((d) => ({ ...d, p50: 1.2 + Math.random() * 0.4, p99: 3.8 + Math.random() * 0.9 }));

const pct = (rate: number) => `${(rate * 100).toFixed(2)}%`;

function ReputationCard() {
  const { data, isLoading } = useQuery({ queryKey: ["reputation"], queryFn: () => dashboard.reputation() });
  if (isLoading || !data) return <Skeleton className="h-40 w-full" />;

  const paused = data.status !== "active";
  const tone = paused || data.assessment === "pause" || data.assessment === "suspend"
    ? "text-destructive"
    : data.assessment === "warn"
      ? "text-[oklch(0.6_0.15_70)]"
      : "text-primary";
  const headline = paused
    ? `Sending ${data.status}`
    : data.assessment === "warn"
      ? "Complaint rate is climbing"
      : "Healthy";

  return (
    <Card className="p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
      <div className={`mt-1 text-3xl font-semibold tracking-tight ${tone}`}>{headline}</div>
      {paused && (
        <p className="mt-2 text-sm text-muted-foreground">
          Sending stopped because bounce or complaint rates crossed a threshold. Contact support to review and resume.
        </p>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Delivered (24h)" value={data.delivered.toLocaleString()} note={`${data.bounced.toLocaleString()} bounced`} />
        <Stat
          label="Complaint rate"
          value={pct(data.complaintRate)}
          note={`warning ${pct(data.thresholds.complaintWarn)} · pause ${pct(data.thresholds.complaintPause)}`}
        />
        <Stat
          label="Hard-bounce rate"
          value={pct(data.hardBounceRate)}
          note={`pause above ${pct(data.thresholds.hardBouncePause)}`}
        />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Rates are only judged once there are at least 100 outcomes in the window. Soft bounces are not counted against you.
      </p>
    </Card>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{note}</div>
    </div>
  );
}

function Deliverability() {
  return (
    <DashboardLayout title="Deliverability">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliverability</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your last 24 hours, judged by the same thresholds that pause sending automatically.
          </p>
        </div>

        <ReputationCard />

        <div className="rounded-md border border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 px-4 py-3 text-sm dark:bg-[oklch(0.25_0.05_85)]/30">
          The charts and settings below are a preview; the data in them is illustrative.
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Complaint rate" data={complaintSeries} keys={["rate"]} colors={["oklch(0.78 0.17 85)"]} />
          <ChartCard title="Bounce rate" data={bounceSeries} keys={["rate"]} colors={["var(--destructive)"]} />
          <ChartCard title="Delivery latency p50/p99" data={latencySeries} keys={["p50", "p99"]} colors={["var(--primary)", "oklch(0.6 0.13 240)"]} />
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h3 className="font-semibold">Per-domain reputation</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Domain</th>
                <th className="px-4 py-2.5 text-right font-medium">Complaint</th>
                <th className="px-4 py-2.5 text-right font-medium">Bounce</th>
                <th className="px-4 py-2.5 text-right font-medium">Volume</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {DOMAINS.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs">{d.domain}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{(Math.random() * 0.1).toFixed(3)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{(Math.random() * 0.5).toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.sends30d.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-[oklch(0.95_0.06_145)] text-[oklch(0.4_0.13_145)] dark:bg-[oklch(0.25_0.05_145)] dark:text-[oklch(0.85_0.12_145)]">Healthy</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <IntegrationCard name="Google Postmaster Tools" desc="Inbox placement and reputation from Google." />
          <IntegrationCard name="Microsoft SNDS" desc="Smart Network Data Services for Outlook/Hotmail." />
        </div>

        <Card className="p-6">
          <h3 className="mb-4 font-semibold">Auto-pause thresholds</h3>
          <div className="space-y-6">
            <ThresholdRow label="Complaint warning" value={0.1} max={1} suffix="%" />
            <ThresholdRow label="Complaint pause" value={0.2} max={1} suffix="%" />
            <ThresholdRow label="Bounce pause" value={5} max={20} suffix="%" />
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="mb-3 text-sm font-medium">Notification channels</h4>
            <div className="space-y-3 text-sm">
              <ChannelRow Icon={Mail} label="Email (reda@bokflow.se)" connected />
              <ChannelRow Icon={MessageSquare} label="Slack" />
              <ChannelRow Icon={Hash} label="Discord" />
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function ChartCard({ title, data, keys, colors }: { title: string; data: Record<string, string | number>[]; keys: string[]; colors: string[] }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="h-44">
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
            <YAxis fontSize={10} tickLine={false} axisLine={false} width={28} stroke="var(--muted-foreground)" />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            {keys.map((k, i) => <Line key={k} dataKey={k} stroke={colors[i]} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function IntegrationCard({ name, desc }: { name: string; desc: string }) {
  return (
    <Card className="flex items-center justify-between p-5">
      <div>
        <div className="font-semibold">{name}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{desc}</div>
        <div className="mt-1 text-xs text-muted-foreground">Not connected</div>
      </div>
      <Button variant="outline">Connect</Button>
    </Card>
  );
}

function ThresholdRow({ label, value, max, suffix }: { label: string; value: number; max: number; suffix: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{value}{suffix}</span>
      </div>
      <Slider defaultValue={[value]} max={max} step={0.01} className="mt-2" />
    </div>
  );
}

function ChannelRow({ Icon, label, connected }: { Icon: LucideIcon; label: string; connected?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      {connected ? <Switch defaultChecked /> : <Button variant="outline" size="sm">Connect</Button>}
    </div>
  );
}
