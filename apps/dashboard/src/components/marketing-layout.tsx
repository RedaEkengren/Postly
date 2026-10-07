import * as React from "react";
import { MarketingNav } from "./marketing-nav";
import { MarketingFooter } from "./marketing-footer";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
