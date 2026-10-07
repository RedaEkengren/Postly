import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { relTime } from "@/lib/time";
import { Plus, CheckCircle2, Loader2, Copy, AlertTriangle } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/app/webhooks/")({
  head: () => ({ meta: [{ title: "Webhooks - Postly" }] }),
  component: WebhooksPage,
});

const EVENTS = [
  "email.queued", "email.sent", "email.delivered", "email.bounced",
  "email.complained", "email.opened", "email.clicked", "email.failed",
  "domain.verified", "domain.verification_failed",
];

function WebhooksPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>(["email.delivered", "email.bounced", "email.complained"]);
  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "webhooks"],
    queryFn: () => dashboard.webhooks(),
    enabled: auth.status === "authenticated",
  });

  const createMutation = useMutation({
    mutationFn: () => dashboard.createWebhook(url, selectedEvents),
    onSuccess: (result) => {
      setCreatedSecret(result.secret);
      qc.invalidateQueries({ queryKey: ["dashboard", "webhooks"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboard.deleteWebhook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "webhooks"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    },
  });

  const toggleEvent = (e: string) => {
    setSelectedEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  };

  const webhooks = data?.data ?? [];

  return (
    <DashboardLayout title="Webhooks">
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
            <p className="mt-1 text-sm text-muted-foreground">Stream email events to your endpoints in real time.</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCreatedSecret(null); setUrl(""); setSelectedEvents(["email.delivered", "email.bounced", "email.complained"]); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New webhook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{createdSecret ? "Save your signing secret" : "Create webhook"}</DialogTitle></DialogHeader>
              {createdSecret ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-md border border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 p-3 text-sm dark:bg-[oklch(0.25_0.05_85)]/30">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[oklch(0.55_0.17_70)]" />
                    <span>Save this signing secret. It will not be shown again.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={createdSecret} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(createdSecret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Endpoint URL</label>
                    <Input placeholder="https://example.com/webhooks/postly" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1.5" required type="url" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Events</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {EVENTS.map((ev) => (
                        <label key={ev} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={selectedEvents.includes(ev)} onCheckedChange={() => toggleEvent(ev)} />
                          <span className="font-mono text-xs">{ev}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {createMutation.isError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {createMutation.error instanceof Error ? createMutation.error.message : "Failed to create webhook"}
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending || selectedEvents.length === 0}>
                      {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create webhook
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">URL</th>
                <th className="px-4 py-2.5 text-left font-medium">Events</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Created</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-64" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-14" /></td>
                  </tr>
                ))
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No webhooks configured. Create one to receive real-time event notifications.
                  </td>
                </tr>
              ) : (
                webhooks.map((w) => (
                  <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link to="/app/webhooks/$id" params={{ id: w.id }} className="font-mono text-xs text-primary hover:underline">
                        {w.url.length > 50 ? w.url.slice(0, 50) + "..." : w.url}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {w.active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[oklch(0.55_0.17_145)]">
                          <CheckCircle2 className="h-3.5 w-3.5" />Active
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Disabled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{relTime(w.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Delete this webhook?")) deleteMutation.mutate(w.id); }}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
