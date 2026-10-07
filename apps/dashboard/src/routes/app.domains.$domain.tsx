import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboard, type DnsRecord } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Copy, RotateCw, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/domains/$domain")({
  head: () => ({ meta: [{ title: "Domain - Postly" }] }),
  component: DomainDetail,
});

const PURPOSE: Record<DnsRecord["purpose"], string> = {
  DKIM: "Signs your mail with a key only Postly holds",
  RETURN_PATH: "Receives bounces for mail you send",
  SPF: "Authorises Postly's servers for the return path",
  DMARC: "Tells mailbox providers what to do with unauthenticated mail",
};

function DomainDetail() {
  const { domain } = Route.useParams();
  const auth = useAuth();
  const qc = useQueryClient();

  const { data: d, isLoading } = useQuery({
    queryKey: ["domain", domain],
    queryFn: () => dashboard.domain(domain),
    enabled: auth.status === "authenticated",
    retry: false,
  });

  const verifyMutation = useMutation({
    mutationFn: () => dashboard.verifyDomain(domain),
    onSuccess: (updated) => {
      qc.setQueryData(["domain", domain], updated);
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => dashboard.deleteDomain(domain),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Domain">
        <div className="space-y-5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!d) {
    return (
      <DashboardLayout title="Domain">
        <div className="space-y-5">
          <Link to="/app/domains" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />Back to domains
          </Link>
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Domain "{domain}" not found.
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const allVerified = d.verified_at !== null;

  return (
    <DashboardLayout title={d.domain}>
      <div className="space-y-5">
        <Link to="/app/domains" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />Back to domains
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{d.domain}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Return path: <span className="font-mono">{d.return_path_domain}</span></p>
          </div>
          <div className="flex gap-2">
            {!allVerified && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RotateCw className="mr-2 h-3.5 w-3.5" />}
                Verify DNS
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm(`Delete ${d.domain}?`)) deleteMutation.mutate(); }}
            >
              Delete domain
            </Button>
          </div>
        </div>

        <Card className="divide-y divide-border">
          {[
            { name: "DKIM", state: d.dkim_status },
            { name: "Return path (MX + SPF)", state: d.spf_status },
            { name: "DMARC (recommended)", state: d.dmarc_status },
          ].map((c) => {
            const Icon = c.state === "verified" ? CheckCircle2 : c.state === "pending" ? Clock : AlertCircle;
            const color = c.state === "verified" ? "text-[oklch(0.55_0.17_145)]" : "text-[oklch(0.55_0.17_70)]";
            return (
              <div key={c.name} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs capitalize text-muted-foreground">{c.state}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <h3 className="text-sm font-semibold">DNS Records</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add these records at your DNS provider, then press Verify DNS. Pending domains are also re-checked every 5 minutes.
              Skip the DMARC record if the domain already has one.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-left font-medium">Host</th>
                <th className="px-4 py-2.5 text-left font-medium">Value</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {d.dns_records.map((r, i) => (
                <tr key={i} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-2.5">
                    <Badge variant="outline">{r.type}</Badge>
                    {!r.required && <div className="mt-1 font-sans text-[10px] text-muted-foreground">recommended</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.name}
                    <div className="mt-1 font-sans text-[11px] text-muted-foreground">{PURPOSE[r.purpose]}</div>
                  </td>
                  <td className="max-w-[420px] break-all px-4 py-2.5 text-muted-foreground">{r.value}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => navigator.clipboard.writeText(r.value)} className="text-muted-foreground hover:text-foreground">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
