import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/2fa-setup")({
  head: () => ({ meta: [{ title: "2FA Setup - Postly" }] }),
  component: () => (
    <AuthLayout title="Set up two-factor" sub="Two-factor authentication is not yet available.">
      <div className="rounded-md border border-[oklch(0.78_0.17_85)]/40 bg-[oklch(0.98_0.04_85)]/40 px-4 py-3 text-sm dark:bg-[oklch(0.25_0.05_85)]/30">
        This feature is coming soon. You'll be able to add TOTP-based 2FA to your account.
      </div>
      <Button asChild variant="outline" className="mt-6 w-full"><Link to="/app">Back to dashboard</Link></Button>
    </AuthLayout>
  ),
});
