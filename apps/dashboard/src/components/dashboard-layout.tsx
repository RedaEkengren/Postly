import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid, Mail, FileText, Globe, ShieldBan, Webhook, KeyRound,
  Activity, ScrollText, Receipt, CreditCard, Settings as SettingsIcon,
  Users, Lock, Bell, Menu,
} from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth, useLogout } from "@/lib/auth-context";
import { LogOut } from "lucide-react";

const SECTIONS = [
  {
    label: "Send",
    items: [
      { to: "/app", label: "Overview", icon: LayoutGrid, exact: true },
      { to: "/app/messages", label: "Messages", icon: Mail },
      { to: "/app/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    label: "Configure",
    items: [
      { to: "/app/domains", label: "Domains", icon: Globe },
      { to: "/app/suppressions", label: "Suppressions", icon: ShieldBan },
      { to: "/app/webhooks", label: "Webhooks", icon: Webhook },
      { to: "/app/api-keys", label: "API Keys", icon: KeyRound },
    ],
  },
  {
    label: "Observe",
    items: [
      { to: "/app/deliverability", label: "Deliverability", icon: Activity },
      { to: "/app/logs", label: "Logs", icon: ScrollText },
    ],
  },
  {
    label: "Billing",
    items: [
      { to: "/app/billing", label: "Usage", icon: Receipt },
      { to: "/app/billing/invoices", label: "Invoices", icon: CreditCard },
    ],
  },
  {
    label: "Settings",
    items: [
      { to: "/app/settings/account", label: "Account", icon: SettingsIcon },
      { to: "/app/settings/team", label: "Team", icon: Users },
      { to: "/app/settings/security", label: "Security", icon: Lock },
    ],
  },
] as const;

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Logo />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {SECTIONS.map((sec) => (
          <div key={sec.label} className="mb-6">
            <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {sec.label}
            </div>
            {sec.items.map((it) => {
              const Icon = it.icon;
              const active = "exact" in it && it.exact
                ? pathname === it.to
                : pathname === it.to || pathname.startsWith(it.to + "/");
              return (
                <Link
                  key={`${sec.label}-${it.label}`}
                  to={it.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-primary bg-sidebar-accent font-medium text-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-4 py-3 text-xs">
        <Link to="/status" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.65_0.17_145)]" />
          All systems operational
        </Link>
      </div>
    </aside>
  );
}

export function DashboardLayout({ children, title, tabs }: {
  children: React.ReactNode;
  title?: string;
  tabs?: { label: string; to: string }[];
}) {
  const [openMobile, setOpenMobile] = React.useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const authState = useAuth();
  const logoutFn = useLogout();
  const nav = useNavigate();
  const logout = async () => {
    await logoutFn();
    nav({ to: "/login" });
  };

  const tenantName = authState.status === "authenticated" ? authState.tenant.name : "Workspace";
  const userEmail = authState.status === "authenticated" ? authState.user.email : "";
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "??";

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden lg:block">
        <SidebarNav />
      </div>
      {openMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenMobile(false)} />
          <div className="absolute inset-y-0 left-0">
            <SidebarNav onNavigate={() => setOpenMobile(false)} />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpenMobile(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm md:flex">
              <span className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                {tenantName}
              </span>
              {title && <span className="ml-3 font-medium">{title}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a href="/docs" className="hidden px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:inline">Docs</a>
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        {tabs && tabs.length > 0 && (
          <div className="flex gap-1 border-b border-border bg-background px-4 md:px-6">
            {tabs.map((t) => {
              const active = pathname === t.to;
              return (
                <Link
                  key={t.to + t.label}
                  to={t.to}
                  className={cn(
                    "border-b-2 px-3 py-3 text-sm",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
