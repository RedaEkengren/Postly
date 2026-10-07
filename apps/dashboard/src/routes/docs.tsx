import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";

export const Route = createFileRoute("/docs")({ component: DocsLayout });

function DocsLayout() {
  return (
    <MarketingLayout>
      <Outlet />
    </MarketingLayout>
  );
}
