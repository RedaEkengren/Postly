import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/app/settings/team")({
  head: () => ({ meta: [{ title: "Team - Postly" }] }),
  component: TeamPage,
});

const MEMBERS = [
  { initials: "RB", name: "Reda Benbo", email: "reda@bokflow.se", role: "owner", lastActive: "2 min ago" },
  { initials: "AL", name: "Anna Lindgren", email: "anna@bokflow.se", role: "admin", lastActive: "1 hour ago" },
  { initials: "MB", name: "Marcus Berg", email: "marcus@tallvik.example", role: "member", lastActive: "Yesterday" },
  { initials: "NH", name: "Noor Haddad", email: "noor@nordvik.example", role: "member", lastActive: "3 days ago" },
];

function TeamPage() {
  return (
    <DashboardLayout title="Settings · Team" tabs={[
      { label: "Account", to: "/app/settings/account" },
      { label: "Team", to: "/app/settings/team" },
      { label: "Security", to: "/app/settings/security" },
    ]}>
      <div className="max-w-4xl space-y-5">
        <div className="rounded-md border border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 px-4 py-3 text-sm dark:bg-[oklch(0.25_0.05_85)]/30">
          Preview - team management coming soon. Data shown below is illustrative.
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
            <p className="mt-1 text-sm text-muted-foreground">{MEMBERS.length} members · 1 pending invite</p>
          </div>
          <Dialog>
            <DialogTrigger asChild><Button>Invite member</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite a teammate</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="name@company.com" type="email" />
                <Select defaultValue="member">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button>Send invite</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Member</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Last active</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {MEMBERS.map((m) => (
                <tr key={m.email} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{m.initials}</AvatarFallback></Avatar>
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {m.role === "owner" ? (
                      <Badge variant="secondary" className="text-[10px] capitalize">Owner</Badge>
                    ) : (
                      <Select defaultValue={m.role}>
                        <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.lastActive}</td>
                  <td className="px-4 py-3 text-right">
                    {m.role !== "owner" && <Button variant="ghost" size="sm">Remove</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Pending invites</h3>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="text-sm">
              <div className="font-mono">viktor@bilrental.se</div>
              <div className="text-xs text-muted-foreground">Invited 2 days ago · member</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">Resend</Button>
              <Button variant="ghost" size="sm">Revoke</Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
