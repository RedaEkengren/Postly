import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEMPLATES } from "@/lib/mock-data";
import { ArrowLeft, Copy, Send, Archive } from "lucide-react";

export const Route = createFileRoute("/app/templates/$slug")({
  head: () => ({ meta: [{ title: "Template - Postly" }] }),
  component: TemplateEditor,
});

const MJML = `<mjml>
  <mj-head>
    <mj-title>Welcome to Bokflow</mj-title>
    <mj-attributes>
      <mj-all font-family="Inter, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#FAFAF9">
    <mj-section padding="32px 0">
      <mj-column>
        <mj-text font-size="24px" font-weight="600">
          Welcome, {{first_name}}
        </mj-text>
        <mj-text color="#57534E" line-height="1.6">
          Thanks for signing up. Activate your account
          to start sending.
        </mj-text>
        <mj-button background-color="#0F766E"
          href="{{activation_url}}">
          Activate account
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

function TemplateEditor() {
  const { slug } = Route.useParams();
  const t = TEMPLATES.find((x) => x.slug === slug) || TEMPLATES[0];

  return (
    <DashboardLayout title={t.name}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link to="/app/templates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />Templates
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{t.slug}</span>
              <span>·</span>
              <Badge variant="outline" className="text-[10px]">{t.format}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue={`v${t.versions}`}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: t.versions }, (_, i) => i + 1).reverse().map((v) => (
                  <SelectItem key={v} value={`v${v}`}>v{v} {v === t.versions && "(current)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm"><Copy className="mr-2 h-3.5 w-3.5" />Duplicate</Button>
            <Button variant="outline" size="sm"><Archive className="mr-2 h-3.5 w-3.5" />Archive</Button>
            <Button variant="outline" size="sm"><Send className="mr-2 h-3.5 w-3.5" />Test send</Button>
            <Button size="sm">Save new version</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">template.mjml</div>
            <pre className="code-block !rounded-none max-h-[600px] overflow-auto text-[12px]">{MJML}</pre>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5">
              <Tabs defaultValue="desktop">
                <TabsList className="h-7">
                  <TabsTrigger value="desktop" className="text-xs">Desktop</TabsTrigger>
                  <TabsTrigger value="mobile" className="text-xs">Mobile</TabsTrigger>
                  <TabsTrigger value="text" className="text-xs">Plain text</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="p-6 bg-[oklch(0.985_0.003_80)]">
              <div className="mx-auto max-w-md rounded-lg border border-border bg-white p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-[#0C0A09]">Welcome, Anna</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#57534E]">
                  Thanks for signing up. Activate your account to start sending.
                </p>
                <button className="mt-5 rounded-md bg-[#0F766E] px-5 py-2.5 text-sm font-medium text-white">
                  Activate account
                </button>
              </div>
            </div>
            <div className="border-t border-border p-4">
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Variables</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">first_name</label>
                  <Input defaultValue="Anna" className="mt-0.5 h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">activation_url</label>
                  <Input defaultValue="https://bokflow.se/activate?t=…" className="mt-0.5 h-8 font-mono text-xs" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
