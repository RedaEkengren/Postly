import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

export function AuthLayout({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background text-foreground md:grid-cols-2">
      <div className="flex flex-col p-8">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
        <div className="text-xs text-muted-foreground">
          <Link to="/">← Back to postly.eu</Link>
        </div>
      </div>
      <div className="relative hidden overflow-hidden md:block">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
        <div className="bg-grid absolute inset-0 opacity-[0.15]" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <blockquote className="max-w-md text-2xl font-medium leading-snug">
            "Switched from Resend after the pricing change. My bill went from $80 to €18 with no DX trade-off."
          </blockquote>
          <div className="mt-6 text-sm text-muted-foreground">Anna Lindgren, founder, Stockholm</div>
        </div>
      </div>
    </div>
  );
}
