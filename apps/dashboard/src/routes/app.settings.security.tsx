import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/settings/security")({
  head: () => ({ meta: [{ title: "Security - Postly" }] }),
  component: SecurityPage,
});

const SESSIONS = [
  { device: "Chrome on macOS", loc: "Stockholm, SE", ip: "192.0.2.44", current: true, when: "Active now" },
  { device: "Safari on iPhone", loc: "Falun, SE", ip: "198.51.100.17", when: "2 hours ago" },
  { device: "Firefox on Linux", loc: "Berlin, DE", ip: "91.64.18.7", when: "Yesterday" },
];

const AUDIT = [
  { action: "api_key.created", user: "Reda Benbo", ip: "192.0.2.44", when: "2 min ago" },
  { action: "domain.verified", user: "Reda Benbo", ip: "192.0.2.44", when: "1 hour ago" },
  { action: "template.updated", user: "Anna Lindgren", ip: "84.55.13.4", when: "3 hours ago" },
  { action: "member.invited", user: "Reda Benbo", ip: "192.0.2.44", when: "Yesterday" },
  { action: "webhook.created", user: "Marcus Berg", ip: "92.45.6.18", when: "2 days ago" },
  { action: "suppression.added", user: "Anna Lindgren", ip: "84.55.13.4", when: "3 days ago" },
];

function SecurityPage() {
  return (
    <DashboardLayout title="Settings · Security" tabs={[
      { label: "Account", to: "/app/settings/account" },
      { label: "Team", to: "/app/settings/team" },
      { label: "Security", to: "/app/settings/security" },
    ]}>
      <div className="max-w-4xl space-y-5">
        <div className="rounded-md border border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 px-4 py-3 text-sm dark:bg-[oklch(0.25_0.05_85)]/30">
          Preview - security settings coming soon. Data shown below is illustrative.
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sessions, two-factor authentication, and audit log.</p>
        </div>

        <Card className="p-6">
          <h3 className="font-semibold">Change password</h3>
          <p className="mt-1 text-sm text-muted-foreground">Update your account password.</p>
          <div className="mt-4 grid max-w-sm gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Current password</label>
              <Input type="password" placeholder="Current password" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">New password</label>
              <Input type="password" placeholder="New password" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Confirm new password</label>
              <Input type="password" placeholder="Confirm new password" className="mt-1" />
            </div>
            <Button className="w-fit" variant="outline">Update password</Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">Two-factor authentication</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add a TOTP code on top of your password.</p>
              <Badge variant="outline" className="mt-3 text-[10px]">Not enabled</Badge>
            </div>
            <Button>Enable 2FA</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-3 font-semibold">Active sessions</h3>
          <div className="divide-y divide-border">
            {SESSIONS.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">
                    {s.device}
                    {s.current && <span className="ml-2 rounded bg-[oklch(0.95_0.06_145)] px-1.5 py-0.5 text-[10px] font-medium text-[oklch(0.4_0.13_145)] dark:bg-[oklch(0.25_0.05_145)] dark:text-[oklch(0.85_0.12_145)]">Current</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.loc} · {s.ip} · {s.when}</div>
                </div>
                {!s.current && <Button variant="outline" size="sm">Revoke</Button>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h3 className="font-semibold">Audit log</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Last 50 admin actions.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Action</th>
                <th className="px-4 py-2.5 text-left font-medium">User</th>
                <th className="px-4 py-2.5 text-left font-medium">IP</th>
                <th className="px-4 py-2.5 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {AUDIT.map((a, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs">{a.action}</td>
                  <td className="px-4 py-2.5">{a.user}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.ip}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{a.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-6 border-destructive/30">
          <h3 className="font-semibold text-destructive">Danger zone</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Under GDPR Article 17, you may request erasure of your personal data. This deletes your account, messages, logs, and PII.
            Aggregated billing records may be retained for accounting purposes.
          </p>
          <Button variant="destructive" className="mt-4">Delete account</Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
