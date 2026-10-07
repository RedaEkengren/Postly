import { useNavigate, createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { dashboard, type DomainRow } from "@/lib/api";
import { Plus, ArrowRight, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/app/domains/")({
  head: () => ({ meta: [{ title: "Domains - Postly" }] }),
  component: DomainsPage,
});

function statusPill(label: string, state: string) {
  const map: Record<string, { c: string; Icon: typeof CheckCircle2 }> = {
    verified: { c: "bg-[oklch(0.95_0.06_145)] text-[oklch(0.4_0.13_145)] dark:bg-[oklch(0.25_0.05_145)] dark:text-[oklch(0.85_0.12_145)]", Icon: CheckCircle2 },
    pending: { c: "bg-[oklch(0.95_0.06_85)] text-[oklch(0.45_0.15_70)] dark:bg-[oklch(0.25_0.05_85)] dark:text-[oklch(0.85_0.15_85)]", Icon: Clock },
    failed: { c: "bg-[oklch(0.95_0.04_27)] text-destructive", Icon: AlertCircle },
  };
  const m = map[state] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${m.c}`}>
      <m.Icon className="h-3 w-3" />{label}
    </span>
  );
}

function DomainCardSkeleton() {
  return (
    <Card className="h-full p-5">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-1.5 h-3 w-20" />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-14 rounded" />
        <Skeleton className="h-5 w-12 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
      <div className="border-t border-border pt-3">
        <Skeleton className="h-3 w-32" />
      </div>
    </Card>
  );
}

function DomainsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [domainInput, setDomainInput] = React.useState("");
  const [returnPathInput, setReturnPathInput] = React.useState("bounces");
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["domains"],
    queryFn: () => dashboard.domains(),
  });

  const createMutation = useMutation({
    mutationFn: () => dashboard.createDomain(domainInput.trim().toLowerCase(), returnPathInput.trim().toLowerCase()),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
      qc.setQueryData(["domain", created.domain], created);
      setOpen(false);
      setDomainInput("");
      // The next step is publishing the DNS records, which the detail page shows.
      navigate({ to: "/app/domains/$domain", params: { domain: created.domain } });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (domain: string) => dashboard.verifyDomain(domain),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (domain: string) => dashboard.deleteDomain(domain),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    },
  });

  const domains: DomainRow[] = data?.data ?? [];
  const verifiedCount = domains.filter((d) => d.dkim === "verified" && d.spf === "verified").length;

  return (
    <DashboardLayout title="Domains">
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {isLoading ? (
                <Skeleton className="inline-block h-4 w-48" />
              ) : (
                `${domains.length} domain${domains.length !== 1 ? "s" : ""}, ${verifiedCount} verified`
              )}
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add domain</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add domain</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Domain</label>
                  <Input
                    placeholder="example.com"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Return-path subdomain</label>
                  <Input
                    value={returnPathInput}
                    onChange={(e) => setReturnPathInput(e.target.value)}
                    className="mt-1.5 font-mono"
                    required
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Bounces come back to <span className="font-mono">{returnPathInput || "bounces"}.{domainInput || "example.com"}</span>. Keep the default unless that name is taken.
                  </p>
                </div>
                {createMutation.isError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {createMutation.error instanceof Error ? createMutation.error.message : "Failed to create domain"}
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add domain
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isError && (
          <Card className="border-destructive/50 p-5">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Failed to load domains. Please try again.
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <DomainCardSkeleton key={i} />)
            : domains.map((d) => {
                const allVerified = d.dkim === "verified" && d.spf === "verified" && d.dmarc === "verified";
                return (
                  <Card key={d.id} className="h-full p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <div className="font-mono text-base font-semibold">{d.domain}</div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">{d.returnPath ?? "no return path yet"}</div>
                      </div>
                      <Link to="/app/domains/$domain" params={{ domain: d.domain }}>
                        <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Link>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {statusPill("DKIM", d.dkim)}
                      {statusPill("SPF", d.spf)}
                      {statusPill("DMARC", d.dmarc)}
                    </div>
                    <div className="flex items-center gap-2 border-t border-border pt-3">
                      {!allVerified && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyMutation.mutate(d.domain)}
                          disabled={verifyMutation.isPending}
                        >
                          {verifyMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                          Verify
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Delete ${d.domain}?`)) deleteMutation.mutate(d.domain); }}
                      >
                        Delete
                      </Button>
                      <div className="ml-auto text-xs text-muted-foreground">
                        Added {new Date(d.createdAt).toLocaleDateString("en-SE", { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </Card>
                );
              })}
        </div>

        {!isLoading && !isError && domains.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No domains yet. Add your first domain to start sending.</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
