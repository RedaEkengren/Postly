import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { relTime } from "@/lib/time";
import { Plus, Download, Loader2 } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/app/suppressions")({
  head: () => ({ meta: [{ title: "Suppressions - Postly" }] }),
  component: SuppressionsPage,
});

const REASON_COLOR: Record<string, string> = {
  bounce: "bg-destructive/10 text-destructive",
  complaint: "bg-[oklch(0.95_0.06_85)] text-[oklch(0.45_0.15_70)] dark:bg-[oklch(0.25_0.05_85)] dark:text-[oklch(0.85_0.15_85)]",
  manual: "bg-muted text-muted-foreground",
  unsubscribe: "bg-[oklch(0.95_0.04_240)] text-[oklch(0.4_0.13_240)] dark:bg-[oklch(0.25_0.04_240)] dark:text-[oklch(0.8_0.12_240)]",
};

function SuppressionsPage() {
  const authState = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [address, setAddress] = React.useState("");
  const [addReason, setAddReason] = React.useState("manual");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "suppressions", reason],
    queryFn: () => dashboard.suppressions(reason),
    enabled: authState.status === "authenticated",
  });

  const addMutation = useMutation({
    mutationFn: () => dashboard.addSuppression(address, addReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "suppressions"] });
      setOpen(false);
      setAddress("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (addr: string) => dashboard.removeSuppression(addr),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "suppressions"] });
    },
  });

  const rows = data?.data ?? [];

  return (
    <DashboardLayout title="Suppressions">
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Suppressions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${rows.length} addresses excluded from sending`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add suppression</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add suppression</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Email address</label>
                    <Input type="email" placeholder="user@example.com" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1.5" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Reason</label>
                    <Select value={addReason} onValueChange={setAddReason}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="bounce">Bounce</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                        <SelectItem value="unsubscribe">Unsubscribe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {addMutation.isError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {addMutation.error instanceof Error ? addMutation.error.message : "Failed to add suppression"}
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={addMutation.isPending}>
                      {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add suppression
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="p-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              <SelectItem value="bounce">Bounce</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="unsubscribe">Unsubscribe</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0 animate-pulse">
                  <div className="h-3 w-40 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="ml-auto h-3 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Address</th>
                  <th className="px-4 py-2.5 text-left font-medium">Reason</th>
                  <th className="px-4 py-2.5 text-left font-medium">Source</th>
                  <th className="px-4 py-2.5 text-right font-medium">Added</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No suppressions found.
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={`${r.address}-${i}`} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs">{r.address}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${REASON_COLOR[r.reason] ?? "bg-muted text-muted-foreground"}`}>{r.reason}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.source ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{relTime(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Remove suppression for ${r.address}?`)) removeMutation.mutate(r.address); }}
                        disabled={removeMutation.isPending}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
