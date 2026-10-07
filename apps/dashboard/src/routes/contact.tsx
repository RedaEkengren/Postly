import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact - Postly" }] }),
  component: Contact,
});

function Contact() {
  const [sending, setSending] = React.useState(false);
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Contact us</h1>
            <p className="mt-4 text-muted-foreground">
              We read every message. Replies within one EU business day.
            </p>
            <dl className="mt-10 space-y-4 text-sm">
              {[
                ["General", "hello@postly.eu"],
                ["Support", "support@postly.eu"],
                ["Data Protection Officer", "dpo@postly.eu"],
                ["Security disclosures", "security@postly.eu"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border py-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd><a href={`mailto:${v}`} className="text-primary hover:underline">{v}</a></dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 text-sm text-muted-foreground">
              Postly AB<br />Kungsgatan 32<br />111 35 Stockholm, Sweden
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSending(true);
              setTimeout(() => { setSending(false); toast.success("Thanks, we'll be in touch shortly."); }, 700);
            }}
            className="space-y-4 rounded-2xl border border-border bg-card p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Name</Label><Input required /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" required /></div>
            </div>
            <div className="space-y-2"><Label>Company</Label><Input /></div>
            <div className="space-y-2">
              <Label>What's this about?</Label>
              <Select defaultValue="general">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General question</SelectItem>
                  <SelectItem value="sales">Sales / pricing</SelectItem>
                  <SelectItem value="support">Technical support</SelectItem>
                  <SelectItem value="compliance">Compliance / DPA</SelectItem>
                  <SelectItem value="security">Security disclosure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Message</Label><Textarea rows={6} required /></div>
            <Button type="submit" disabled={sending} className="w-full">{sending ? "Sending…" : "Send message"}</Button>
          </form>
        </div>
      </section>
    </MarketingLayout>
  );
}
