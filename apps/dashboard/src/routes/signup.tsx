import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { auth } from "@/lib/api";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up - Postly" }] }),
  component: Signup,
});

function Signup() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [agreed, setAgreed] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!agreed) {
      setError("You must agree to the Terms and DPA.");
      setLoading(false);
      return;
    }
    const form = new FormData(e.currentTarget);
    try {
      await auth.signup(
        form.get("email") as string,
        form.get("password") as string,
        (form.get("orgName") as string) || "My Workspace",
      );
      await qc.invalidateQueries({ queryKey: ["auth"] });
      nav({ to: "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create your Postly account" sub="3,000 free emails / month. No credit card."
      footer={<>Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link></>}>
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
        <div className="space-y-2"><Label>Password</Label><Input name="password" type="password" required minLength={8} /></div>
        <div className="space-y-2"><Label>Company (optional)</Label><Input name="orgName" /></div>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
          <span className="text-muted-foreground">I agree to the <Link to="/legal/terms" className="text-foreground hover:underline">Terms</Link> and <Link to="/legal/dpa" className="text-foreground hover:underline">DPA</Link>.</span>
        </label>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
      </form>
    </AuthLayout>
  );
}
