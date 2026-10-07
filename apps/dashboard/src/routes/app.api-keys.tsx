import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Copy, AlertTriangle, Loader2 } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/app/api-keys")({
  head: () => ({ meta: [{ title: "API Keys - Postly" }] }),
  component: ApiKeysPage,
});

const SCOPES = ["emails.send", "emails.read", "suppressions.read", "suppressions.write", "domains.read", "domains.write", "templates.read", "templates.write"];

function ApiKeysPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [created, setCreated] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [selectedScopes, setSelectedScopes] = React.useState<string[]>(["emails.send"]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "api-keys"],
    queryFn: () => dashboard.apiKeys(),
    enabled: auth.status === "authenticated",
  });

  const createMutation = useMutation({
    mutationFn: () => dashboard.createApiKey(name, selectedScopes),
    onSuccess: (result) => {
      setCreated(result.key);
      qc.invalidateQueries({ queryKey: ["dashboard", "api-keys"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => dashboard.revokeApiKey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "api-keys"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    },
  });

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const keys = data?.data ?? [];

  return (
    <DashboardLayout title="API Keys">
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${keys.length} keys`} · Rotate regularly. Never commit keys.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCreated(null); setName(""); setSelectedScopes(["emails.send"]); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New API key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{created ? "Save this key now" : "Create API key"}</DialogTitle></DialogHeader>
              {created ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-md border border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 p-3 text-sm dark:bg-[oklch(0.25_0.05_85)]/30">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[oklch(0.55_0.17_70)]" />
                    <span>This key will not be shown again. Copy it now and store it securely.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input value={created} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(created)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input placeholder="e.g. Production server" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Scopes</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {SCOPES.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={selectedScopes.includes(s)} onCheckedChange={() => toggleScope(s)} />
                          <span className="font-mono text-xs">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {createMutation.isError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {createMutation.error instanceof Error ? createMutation.error.message : "Failed to create key"}
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending || selectedScopes.length === 0}>
                      {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create key
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
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Prefix</th>
                <th className="px-4 py-2.5 text-left font-medium">Scopes</th>
                <th className="px-4 py-2.5 text-left font-medium">Last used</th>
                <th className="px-4 py-2.5 text-right font-medium">Created</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-14" /></td>
                  </tr>
                ))
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No API keys yet. Create one to start sending emails.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.prefix}...</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{k.lastUsed ? relTime(k.lastUsed) : "Never"}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{relTime(k.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Revoke key "${k.name}"?`)) revokeMutation.mutate(k.id); }}
                        disabled={revokeMutation.isPending}
                      >
                        Revoke
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
