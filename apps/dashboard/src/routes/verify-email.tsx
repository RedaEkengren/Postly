import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify email - Postly" }] }),
  component: () => (
  <AuthLayout title="Check your inbox" sub="We sent a verification link to your email.">
    <p className="text-sm text-muted-foreground">Click the link in the email to verify. The link is valid for 24 hours.</p>
    <Button asChild className="mt-6 w-full"><Link to="/login">Back to sign in</Link></Button>
  </AuthLayout>
)});
