import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { INVOICES } from "@/lib/mock-data";
import { Download } from "lucide-react";

export const Route = createFileRoute("/app/billing/invoices")({
  head: () => ({ meta: [{ title: "Invoices - Postly" }] }),
  component: InvoicesPage,
});

const ALL_INVOICES = [
  ...INVOICES,
  { id: "inv_2025_12", month: "December 2025", amount: 9.04, status: "paid" },
  { id: "inv_2025_11", month: "November 2025", amount: 7.92, status: "paid" },
  { id: "inv_2025_10", month: "October 2025", amount: 6.51, status: "paid" },
  { id: "inv_2025_09", month: "September 2025", amount: 5.80, status: "paid" },
];

function InvoicesPage() {
  return (
    <DashboardLayout title="Billing" tabs={[
      { label: "Overview", to: "/app/billing" },
      { label: "Invoices", to: "/app/billing/invoices" },
    ]}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Download past invoices for your records.</p>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Period</th>
                <th className="px-4 py-2.5 text-left font-medium">Invoice ID</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Download</th>
              </tr>
            </thead>
            <tbody>
              {ALL_INVOICES.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="px-4 py-2.5">{inv.month}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{inv.id}</td>
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
