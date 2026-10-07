import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import * as React from "react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const authState = useAuth();
  const nav = useNavigate();

  React.useEffect(() => {
    if (authState.status === "unauthenticated") nav({ to: "/login" });
  }, [authState.status, nav]);

  if (authState.status !== "authenticated") return null;

  return <Outlet />;
}
