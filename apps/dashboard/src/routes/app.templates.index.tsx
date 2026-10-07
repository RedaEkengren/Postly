import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { relTime } from "@/lib/time";
import { Plus, Loader2, Trash2 } from "lucide-react";
import * as React from "react";

export const Route = createFileRoute("/app/templates/")({
  head: () => ({ meta: [{ title: "Templates - Postly" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [slug, setSlug] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [format, setFormat] = React.useState("html");
  const [source, setSource] = React.useState("<p>Hello {{name}},</p>");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "templates"],
    queryFn: () => dashboard.templates(),
    enabled: auth.status === "authenticated",
  });

  const createMutation = useMutation({
    mutationFn: () => dashboard.createTemplate(slug, format, source, subject),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "templates"] });
      setOpen(false);
      setSlug("");
      setSubject("");
      setSource("<p>Hello {{name}},</p>");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (s: string) => dashboard.deleteTemplate(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "templates"] });
    },
  });

  const templates = data?.data ?? [];

  return (
    <DashboardLayout title="Templates">
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${templates.length} templates`}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create template</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Slug</label>
                    <Input placeholder="welcome-email" value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1.5 font-mono text-xs" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Format</label>
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="mjml">MJML</SelectItem>
                        <SelectItem value="react">React</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Input placeholder="Welcome to {{company}}" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5" required />
                </div>
                <div>
                  <label className="text-sm font-medium">Source</label>
                  <Textarea placeholder="<p>Hello {{name}},</p>" value={source} onChange={(e) => setSource(e.target.value)} className="mt-1.5 font-mono text-xs" rows={6} required />
                </div>
                {createMutation.isError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {createMutation.error instanceof Error ? createMutation.error.message : "Failed to create template"}
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create template
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-32 w-full rounded-none" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </Card>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No templates yet. Create one to use in your emails.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card key={t.slug} className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                <Link to="/app/templates/$slug" params={{ slug: t.slug }}>
                  <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-accent/10 flex items-center justify-center text-xs text-muted-foreground">
                    <div className="w-3/4 space-y-2">
                      <div className="h-2 w-full rounded-full bg-foreground/10" />
                      <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
                      <div className="h-2 w-5/6 rounded-full bg-foreground/10" />
                      <div className="mt-3 h-5 w-20 rounded-md bg-primary/30" />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{t.slug}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Created {relTime(t.createdAt)}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {t.currentVersionId ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                </Link>
                <div className="border-t border-border px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete template "${t.slug}"?`)) deleteMutation.mutate(t.slug); }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
