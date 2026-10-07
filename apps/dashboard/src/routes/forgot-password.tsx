import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password - Postly" }] }),
  component: () => (
  <AuthLayout title="Reset your password" sub="We'll send you a link." footer={<Link to="/login" className="hover:underline">← Back to sign in</Link>}>
    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
      <div className="rounded-md border border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 px-3 py-2 text-sm dark:bg-[oklch(0.25_0.05_85)]/30">
        Password reset is not yet available. Contact support for account recovery.
      </div>
      <div className="space-y-2"><Label>Email</Label><Input type="email" required /></div>
      <Button className="w-full" disabled>Send reset link</Button>
    </form>
  </AuthLayout>
)});
