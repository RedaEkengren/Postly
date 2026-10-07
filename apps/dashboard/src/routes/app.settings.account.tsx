import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/app/settings/account")({
  head: () => ({ meta: [{ title: "Account - Postly" }] }),
  component: AccountSettings,
});

function AccountSettings() {
  const authState = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const email = authState.status === "authenticated" ? authState.user.email : "";
  const tenantName = authState.status === "authenticated" ? authState.tenant.name : "";

  const [fullName, setFullName] = React.useState(() => email.split("@")[0]);
  const [company, setCompany] = React.useState(tenantName);
  const [timezone, setTimezone] = React.useState("europe-stockholm");
  const [language, setLanguage] = React.useState("en");

  const [wsName, setWsName] = React.useState(tenantName);
  const [wsSlug, setWsSlug] = React.useState(() => tenantName.toLowerCase().replace(/\s+/g, "-"));

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState("");

  React.useEffect(() => {
    if (tenantName) {
      setCompany(tenantName);
      setWsName(tenantName);
      setWsSlug(tenantName.toLowerCase().replace(/\s+/g, "-"));
    }
  }, [tenantName]);

  React.useEffect(() => {
    if (email) setFullName(email.split("@")[0]);
  }, [email]);

  const saveMutation = useMutation({
    mutationFn: () => dashboard.updateAccount(wsName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => dashboard.deleteAccount(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth"] });
      nav({ to: "/login" });
    },
  });

  return (
    <DashboardLayout title="Settings · Account" tabs={[
      { label: "Account", to: "/app/settings/account" },
      { label: "Team", to: "/app/settings/team" },
      { label: "Security", to: "/app/settings/security" },
    ]}>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Personal profile and workspace preferences.</p>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Profile</h2>
          <div>
            <label className="text-sm font-medium">Full name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5 max-w-md" />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} readOnly className="mt-1.5 max-w-md bg-muted/50" />
          </div>
          <div>
            <label className="text-sm font-medium">Company</label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1.5 max-w-md" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Timezone</label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="europe-stockholm">Europe/Stockholm</SelectItem>
                  <SelectItem value="europe-berlin">Europe/Berlin</SelectItem>
                  <SelectItem value="europe-london">Europe/London</SelectItem>
                  <SelectItem value="utc">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Language</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sv">Svenska</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
            {saveMutation.isSuccess && (
              <span className="ml-3 text-sm text-[oklch(0.55_0.17_145)]">Saved</span>
            )}
            {saveMutation.isError && (
              <span className="ml-3 text-sm text-destructive">
                {saveMutation.error instanceof Error ? saveMutation.error.message : "Failed to save"}
              </span>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Workspace</h2>
          <div>
            <label className="text-sm font-medium">Workspace name</label>
            <Input value={wsName} onChange={(e) => setWsName(e.target.value)} className="mt-1.5 max-w-md" />
          </div>
          <div>
            <label className="text-sm font-medium">Slug</label>
            <Input value={wsSlug} onChange={(e) => setWsSlug(e.target.value)} className="mt-1.5 max-w-md font-mono text-xs" />
          </div>
          <div className="pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save workspace
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-destructive/30 space-y-3">
          <h2 className="font-semibold text-destructive">Danger zone</h2>
          <p className="text-sm text-muted-foreground">Permanently delete this workspace and all messages, logs, templates, and keys. This cannot be undone.</p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete workspace</Button>
        </Card>

        <Dialog open={deleteOpen} onOpenChange={(v) => { setDeleteOpen(v); if (!v) setDeleteConfirm(""); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete workspace</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will permanently delete <strong>{tenantName}</strong> and all associated data including domains, API keys, messages, templates, and webhooks.
              </p>
              <div>
                <label className="text-sm font-medium">
                  Type <span className="font-mono text-destructive">{tenantName}</span> to confirm
                </label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="mt-1.5"
                  placeholder={tenantName}
                />
              </div>
              {deleteMutation.isError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Failed to delete workspace"}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={deleteConfirm !== tenantName || deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete permanently
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
