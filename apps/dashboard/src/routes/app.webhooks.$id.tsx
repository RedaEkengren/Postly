import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { relTime } from "@/lib/time";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/webhooks/$id")({
  head: () => ({ meta: [{ title: "Webhook - Postly" }] }),
  component: WebhookDetail,
});

const ALL_EVENTS = [
  "email.queued", "email.sent", "email.delivered", "email.bounced",
  "email.complained", "email.opened", "email.clicked", "email.failed",
];

const MOCK_DELIVERIES = [
  { event: "email.delivered", messageId: "msg_01HX7K3M...", code: 200, attempts: 1, time: "2 min ago" },
  { event: "email.bounced", messageId: "msg_01HX7K4N...", code: 200, attempts: 1, time: "18 min ago" },
  { event: "email.delivered", messageId: "msg_01HX7K5P...", code: 200, attempts: 1, time: "45 min ago" },
  { event: "email.complained", messageId: "msg_01HX7K6Q...", code: 502, attempts: 3, time: "1 hour ago" },
  { event: "email.delivered", messageId: "msg_01HX7K7R...", code: 200, attempts: 1, time: "2 hours ago" },
  { event: "email.delivered", messageId: "msg_01HX7K8S...", code: 200, attempts: 1, time: "3 hours ago" },
];

function WebhookDetail() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "webhooks"],
    queryFn: () => dashboard.webhooks(),
    enabled: auth.status === "authenticated",
  });

  const deleteMutation = useMutation({
    mutationFn: () => dashboard.deleteWebhook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "webhooks"] });
    },
  });

  const w = data?.data?.find((x) => x.id === id);

  if (isLoading) {
    return (
      <DashboardLayout title="Webhook">
        <div className="space-y-5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-32 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!w) {
    return (
      <DashboardLayout title="Webhook">
        <div className="space-y-5">
          <Link to="/app/webhooks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />Back to webhooks
          </Link>
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Webhook not found.
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Webhook">
      <div className="space-y-5">
        <Link to="/app/webhooks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />Back to webhooks
        </Link>

        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-mono text-xl font-semibold tracking-tight">{w.url}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ID: <span className="font-mono">{w.id}</span> · Created {relTime(w.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {w.active ? (
              <span className="inline-flex items-center gap-1 text-xs text-[oklch(0.55_0.17_145)]">
                <CheckCircle2 className="h-3.5 w-3.5" />Active
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Disabled</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Delete this webhook?")) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Delete
            </Button>
          </div>
        </div>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Signing secret</h3>
          <p className="text-xs text-muted-foreground">
            The signing secret was shown once when you created this webhook. If you lost it, delete and recreate the webhook.
          </p>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Subscribed events</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {ALL_EVENTS.map((e) => (
              <label key={e} className="flex items-center gap-2 text-sm">
                <Checkbox checked={w.events.includes(e)} disabled />
                <span className="font-mono text-xs">{e}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h3 className="font-semibold">Recent deliveries</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Last 10 delivery attempts to this endpoint.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Event</th>
                <th className="px-4 py-2.5 text-left font-medium">Message</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Attempts</th>
                <th className="px-4 py-2.5 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DELIVERIES.map((d, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs">{d.event}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.messageId}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={d.code === 200 ? "secondary" : "destructive"} className="text-[10px]">
                      {d.code}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.attempts}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{d.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
