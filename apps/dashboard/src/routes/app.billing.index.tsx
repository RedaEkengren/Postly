import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { INVOICES, dailySeries } from "@/lib/mock-data";
import { Download } from "lucide-react";
import { Bar, Line, ComposedChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/app/billing/")({
  head: () => ({ meta: [{ title: "Billing - Postly" }] }),
  component: BillingPage,
});

const usage = dailySeries(30).map((d) => ({ ...d, cost: (d.sent / 1000) * 0.4 }));

function BillingPage() {
  return (
    <DashboardLayout title="Billing">
      <div className="space-y-5">
        <div className="rounded-md border border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 px-4 py-3 text-sm dark:bg-[oklch(0.25_0.05_85)]/30">
          Preview - billing integration coming soon. Data shown below is illustrative.
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pay-as-you-go usage and invoices.</p>
        </div>

        <Card className="p-6 bg-gradient-to-br from-primary/5 via-card to-card">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current period</div>
              <h2 className="mt-1 text-2xl font-semibold">May 2026</h2>
              <p className="text-sm text-muted-foreground">Resets in 12 days</p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Total estimated</div>
              <div className="mt-1 text-3xl font-semibold tracking-tight">€11.51</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Emails sent</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">23,481</div>
              <div className="mt-2 h-1 w-full rounded-full bg-muted">
                <div className="h-1 rounded-full bg-primary" style={{ width: "62%" }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">PAYG · no cap</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Postly fee</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">€9.39</div>
              <div className="mt-1 text-[11px] text-muted-foreground">€0.40 per 1k emails</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Delivery</div>
              <div className="mt-0.5 text-xl font-semibold">Included</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Postly's own EU infrastructure, no pass-through fees</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Daily volume & cost</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={usage}>
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <YAxis yAxisId="l" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <YAxis yAxisId="r" orientation="right" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="sent" fill="var(--primary)" opacity={0.7} radius={[2, 2, 0, 0]} />
                <Line yAxisId="r" dataKey="cost" stroke="oklch(0.78 0.17 70)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-1 font-semibold">Credit balance</h3>
            <p className="text-sm text-muted-foreground">Prepay for discounted rates.</p>
            <div className="mt-4 text-3xl font-semibold tabular-nums">8,420 <span className="text-base text-muted-foreground font-normal">credits</span></div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="mt-4">Buy credits</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Buy credit pack</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  {[
                    { c: 10_000, p: 4, save: null },
                    { c: 100_000, p: 36, save: "10% off" },
                    { c: 1_000_000, p: 320, save: "20% off" },
                  ].map((p) => (
                    <button key={p.c} className="flex items-center justify-between rounded-lg border border-border p-4 text-left hover:border-primary hover:bg-accent">
                      <div>
                        <div className="font-semibold tabular-nums">{p.c.toLocaleString()} credits</div>
                        {p.save && <div className="text-xs text-[oklch(0.55_0.17_145)]">{p.save}</div>}
                      </div>
                      <div className="text-lg font-semibold">€{p.p}</div>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </Card>

          <Card className="p-5">
            <h3 className="mb-1 font-semibold">Payment method</h3>
            <p className="text-sm text-muted-foreground">Charged on the 1st of each month.</p>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex h-8 w-12 items-center justify-center rounded bg-gradient-to-br from-[#1A1F71] to-[#2D3F8C] text-[10px] font-bold text-white">VISA</div>
              <div className="flex-1 text-sm">
                <div>•••• •••• •••• 4242</div>
                <div className="text-xs text-muted-foreground">Expires 03/28</div>
              </div>
              <Button variant="outline" size="sm">Update</Button>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-4">
            <h3 className="font-semibold">Invoices</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Period</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {[...INVOICES,
                { id: "inv_2025_12", month: "December 2025", amount: 9.04, status: "paid" },
                { id: "inv_2025_11", month: "November 2025", amount: 7.92, status: "paid" }].map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-4 py-2.5">{inv.month}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">€{inv.amount.toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium bg-[oklch(0.95_0.06_145)] text-[oklch(0.4_0.13_145)] dark:bg-[oklch(0.25_0.05_145)] dark:text-[oklch(0.85_0.12_145)] capitalize">{inv.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm"><Download className="mr-2 h-3.5 w-3.5" />PDF</Button>
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
