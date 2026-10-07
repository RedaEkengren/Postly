import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { relTime } from "@/lib/time";
import { AlertTriangle, CheckCircle2, Globe, KeyRound, Send, XCircle, MailWarning } from "lucide-react";
import type { OverviewData } from "@/lib/api";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Overview - Postly" }] }),
  component: OverviewPage,
});

function statusIcon(s: string) {
  if (s === "delivered") return <CheckCircle2 className="h-4 w-4 text-[oklch(0.65_0.17_145)]" />;
  if (s === "bounced") return <XCircle className="h-4 w-4 text-destructive" />;
  if (s === "complained") return <MailWarning className="h-4 w-4 text-[oklch(0.78_0.17_85)]" />;
  return <Send className="h-4 w-4 text-muted-foreground" />;
}

function OverviewPage() {
  const authState = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => dashboard.overview(),
    enabled: authState.status === "authenticated",
  });

  if (authState.status !== "authenticated") return null;

  const userName = authState.user.email.split("@")[0];
  const tenantName = authState.tenant.name;

  const pending = data?.domains.filter((d) => d.dmarc === "pending" || d.dkim === "pending").length ?? 0;

  return (
    <DashboardLayout title="Overview">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good day, {userName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening in {tenantName} · {new Date().toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {pending > 0 && (
          <Card className="flex items-center gap-3 border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 p-4 dark:bg-[oklch(0.25_0.05_85)]/30">
            <AlertTriangle className="h-5 w-5 text-[oklch(0.55_0.17_70)]" />
            <div className="flex-1 text-sm">
              <span className="font-medium">{pending} domain{pending > 1 ? "s" : ""} pending DNS verification</span>
              <span className="text-muted-foreground">. Finish setup to start sending.</span>
            </div>
            <Link to="/app/domains" className="text-sm font-medium text-primary hover:underline">Resolve →</Link>
          </Card>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5 animate-pulse">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="mt-3 h-8 w-16 rounded bg-muted" />
              </Card>
            ))}
          </div>
        ) : data && (
          <>
            <OnboardingCard data={data} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Emails sent this month" value={data.stats.emailsThisMonth.toLocaleString()} />
              <StatCard label="Delivery rate" value={`${data.stats.deliveryRate}%`} trend={data.stats.deliveryRate > 95 ? "Excellent" : undefined} trendPositive />
              <StatCard label="Bounce rate" value={`${data.stats.bounceRate}%`} />
              <StatCard label="Active API keys" value={String(data.stats.activeApiKeys)} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5 lg:col-span-2">
                <h2 className="mb-3 font-semibold">Recent activity</h2>
                <div className="space-y-1 -mx-2">
                  {data.recentMessages.length === 0 && (
                    <p className="px-2 py-4 text-sm text-muted-foreground">No messages yet. Send your first email via the API.</p>
                  )}
                  {data.recentMessages.map((m) => (
                    <Link key={m.id} to="/app/messages" className="flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted/60">
                      <div className="mt-0.5">{statusIcon(m.status)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{Array.isArray(m.to) ? m.to.join(", ") : m.to}</div>
                        <div className="truncate text-xs text-muted-foreground">{m.subject}</div>
                      </div>
                      <div className="shrink-0 text-[11px] text-muted-foreground">{relTime(m.sentAt)}</div>
                    </Link>
                  ))}
                </div>
              </Card>

              <div className="space-y-4">
                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Domains</h3>
                    <Link to="/app/domains" className="text-xs text-primary hover:underline">Manage →</Link>
                  </div>
                  <div className="space-y-2.5">
                    {data.domains.length === 0 && <p className="text-sm text-muted-foreground">No domains configured.</p>}
                    {data.domains.slice(0, 3).map((d) => {
                      const ok = d.dkim === "verified" && d.spf === "verified" && d.dmarc === "verified";
                      return (
                        <div key={d.id} className="flex items-center justify-between text-sm">
                          <span className="font-mono">{d.domain}</span>
                          {ok ? (
                            <span className="text-[oklch(0.65_0.17_145)]">✓ verified</span>
                          ) : (
                            <span className="text-[oklch(0.55_0.17_70)]">⚠ pending</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Webhooks</h3>
                    <Link to="/app/webhooks" className="text-xs text-primary hover:underline">Manage →</Link>
                  </div>
                  <div className="space-y-2.5">
                    {data.webhooks.length === 0 && <p className="text-sm text-muted-foreground">No webhooks configured.</p>}
                    {data.webhooks.map((w) => (
                      <div key={w.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-mono text-xs">{w.url.replace("https://", "")}</span>
                          <Badge variant="secondary" className="text-[10px]">{w.active ? "active" : "disabled"}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{w.events.length} events</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, trend, trendPositive }: { label: string; value: string; trend?: string; trendPositive?: boolean }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {trend && (
        <div className={`mt-3 inline-flex rounded-md px-2 py-0.5 text-xs ${trendPositive ? "bg-[oklch(0.95_0.06_145)] text-[oklch(0.4_0.13_145)] dark:bg-[oklch(0.25_0.05_145)] dark:text-[oklch(0.85_0.12_145)]" : "bg-muted text-muted-foreground"}`}>
          {trend}
        </div>
      )}
    </Card>
  );
}

function OnboardingCard({ data }: { data: OverviewData }) {
  const domainVerified = data.domains.some(
    (d) => d.dkim === "verified" && d.spf === "verified" && d.dmarc === "verified",
  );
  const apiKeyCreated = data.stats.activeApiKeys > 0;
  const emailSent = data.stats.emailsThisMonth > 0;

  const steps = [
    {
      title: "Verify a domain",
      description: "Add DNS records so Postly can send on your behalf.",
      complete: domainVerified,
      icon: Globe,
      href: "/app/domains" as const,
      external: false,
    },
    {
      title: "Create an API key",
      description: "Generate credentials for authenticating API requests.",
      complete: apiKeyCreated,
      icon: KeyRound,
      href: "/app/api-keys" as const,
      external: false,
    },
    {
      title: "Send your first email",
      description: "Use the API or an SDK to deliver your first message.",
      complete: emailSent,
      icon: Send,
      href: "/docs/quickstart" as const,
      external: false,
    },
  ];

  const completed = steps.filter((s) => s.complete).length;

  if (completed === steps.length) return null;

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Get started with Postly</h2>
        <span className="text-sm text-muted-foreground">
          {completed} of {steps.length} complete
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {step.complete ? (
                  <CheckCircle2 className="h-5 w-5 text-[oklch(0.65_0.17_145)]" />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-[11px] font-semibold text-muted-foreground">
                    {i + 1}
                  </div>
                )}
              </div>
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{step.title}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
              <div className="mt-0.5 flex-shrink-0">
                {step.complete ? (
                  <span className="text-xs text-muted-foreground">Done</span>
                ) : (
                  <Link to={step.href} className="text-xs font-medium text-primary hover:underline">
                    Set up →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
