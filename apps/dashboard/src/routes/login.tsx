import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in - Postly" }] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await auth.login(form.get("email") as string, form.get("password") as string);
      await qc.invalidateQueries({ queryKey: ["auth"] });
      nav({ to: "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back"
      footer={<>New to Postly? <Link to="/signup" className="text-primary hover:underline">Create an account</Link></>}>
      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
        <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required autoComplete="username" /></div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Password</Label><Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot?</Link></div>
          <Input name="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
    </AuthLayout>
  );
}
