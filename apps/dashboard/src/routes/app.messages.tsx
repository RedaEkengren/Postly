import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dashboard, type MessageRow } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { relTime, fmtDateTime } from "@/lib/time";
import { Search, Download, Copy, RotateCw } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/app/messages")({
  head: () => ({ meta: [{ title: "Messages - Postly" }] }),
  component: MessagesPage,
});

const STATUS_COLOR: Record<string, string> = {
  delivered: "bg-[oklch(0.65_0.17_145)]",
  bounced: "bg-destructive",
  complained: "bg-[oklch(0.78_0.17_85)]",
  queued: "bg-muted-foreground",
  failed: "bg-destructive",
  sent: "bg-[oklch(0.6_0.13_240)]",
};

const PAGE_SIZE = 25;

function MessagesPage() {
  const authState = useAuth();

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [domain, setDomain] = React.useState("all");
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<MessageRow | null>(null);

  // Reset to first page when filters change
  React.useEffect(() => { setPage(0); }, [q, status, domain]);

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["dashboard", "messages", page],
    queryFn: () => dashboard.messages(PAGE_SIZE, page * PAGE_SIZE),
    enabled: authState.status === "authenticated",
  });

  const { data: domainsData } = useQuery({
    queryKey: ["dashboard", "domains"],
    queryFn: () => dashboard.domains(),
    enabled: authState.status === "authenticated",
  });

  if (authState.status !== "authenticated") return null;

  const messages = messagesData?.data ?? [];
  const total = messagesData?.total ?? 0;
  const domains = domainsData?.data ?? [];

  // Client-side filtering on the current page
  const filtered = messages.filter((m) => {
    if (status !== "all" && m.status !== status) return false;
    if (domain !== "all" && m.domain !== domain) return false;
    if (q && !`${m.to} ${m.subject} ${m.id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);
  const hasPrev = page > 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  return (
    <DashboardLayout title="Messages">
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
            <p className="mt-1 text-sm text-muted-foreground">{total.toLocaleString()} messages sent this month</p>
          </div>
          <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>

        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[280px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipients, subjects, message IDs..." className="pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="complained">Complained</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All domains</SelectItem>
                {domains.map((d) => <SelectItem key={d.id} value={d.domain}>{d.domain}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatus("all"); setDomain("all"); }}>Clear</Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">To</th>
                  <th className="px-4 py-2.5 text-left font-medium">Subject</th>
                  <th className="px-4 py-2.5 text-left font-medium">From</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tags</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {messagesLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-muted" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-36 rounded bg-muted" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-44 rounded bg-muted" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-muted" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-muted" /></td>
                      <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-12 rounded bg-muted" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No messages match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <tr key={m.id} onClick={() => setSelected(m)} className="cursor-pointer border-b border-border hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[m.status]}`} />
                          <span className="capitalize">{m.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{m.to}</td>
                      <td className="max-w-[260px] truncate px-4 py-3">{m.subject}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.from}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(m.tags) ? m.tags : []).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{relTime(m.sentAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              {total > 0
                ? `Showing ${start}–${end} of ${total.toLocaleString()}`
                : "No messages"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[640px]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[selected.status]}`} />
                  <span className="capitalize">{selected.status}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="truncate text-base font-normal">{selected.subject}</span>
                </SheetTitle>
              </SheetHeader>
              <Tabs defaultValue="overview" className="mt-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="events">Events</TabsTrigger>
                  <TabsTrigger value="raw">Raw MIME</TabsTrigger>
                  <TabsTrigger value="hooks">Webhooks</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3 pt-3 text-sm">
                  <KV k="Message ID" v={selected.id} mono copy />
                  <KV k="From" v={selected.from} mono />
                  <KV k="To" v={selected.to} mono />
                  <KV k="Subject" v={selected.subject} />
                  <KV k="Sent at" v={fmtDateTime(selected.sentAt)} />
                  <KV k="Tags" v={(Array.isArray(selected.tags) ? selected.tags : []).join(", ") || "-"} />
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline"><RotateCw className="mr-2 h-3.5 w-3.5" />Replay</Button>
                    <Button size="sm" variant="outline">Export raw MIME</Button>
                  </div>
                </TabsContent>

                <TabsContent value="events" className="pt-3">
                  <MessageEvents messageId={selected.id} />
                </TabsContent>

                <TabsContent value="raw" className="pt-3">
                  <pre className="code-block max-h-[60vh] overflow-auto text-[12px] leading-relaxed">
{`Return-Path: <bounce+${selected.id}@${selected.domain}>
Received: from postly-edge-eu-1 ([10.0.4.21])
  by inbound-mx.example.com with ESMTPS
Date: ${new Date(selected.sentAt).toUTCString()}
From: ${selected.from}
To: ${selected.to}
Subject: ${selected.subject}
Message-ID: <${selected.id}@postly.eu>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="b1"

--b1
Content-Type: text/plain; charset=utf-8

Hi there,

Thanks for using Postly.

- The team

--b1--`}
                  </pre>
                </TabsContent>

                <TabsContent value="hooks" className="pt-3">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th className="py-2 text-left">Webhook</th><th className="text-left">Attempts</th><th className="text-left">Code</th><th className="text-right">Time</th></tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border"><td className="py-2 font-mono text-xs">whk_xyz789</td><td>1</td><td>200</td><td className="text-right text-xs text-muted-foreground">14:32:14</td></tr>
                      <tr className="border-t border-border"><td className="py-2 font-mono text-xs">whk_abc123</td><td>1</td><td>200</td><td className="text-right text-xs text-muted-foreground">14:32:15</td></tr>
                    </tbody>
                  </table>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

function MessageEvents({ messageId }: { messageId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "message", messageId],
    queryFn: () => dashboard.message(messageId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="ml-7 space-y-1">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const events = data?.events ?? [];

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events recorded yet.</p>;
  }

  return (
    <ol className="relative ml-3 border-l border-border">
      {events.map((e) => (
        <li key={e.id} className="ml-4 pb-5">
          <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary" />
          <div className="text-sm font-medium capitalize">
            {e.type}{" "}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {fmtDateTime(e.timestamp)}
            </span>
          </div>
          {e.payload && typeof e.payload === "object" && "response" in (e.payload as Record<string, unknown>) ? (
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {String((e.payload as Record<string, unknown>).response)}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function KV({ k, v, mono, copy }: { k: string; v: string; mono?: boolean; copy?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-28 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`flex-1 break-all ${mono ? "font-mono text-xs" : "text-sm"}`}>{v}</div>
      {copy && (
        <button onClick={() => navigator.clipboard.writeText(v)} className="text-muted-foreground hover:text-foreground">
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
