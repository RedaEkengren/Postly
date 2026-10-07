import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

const COLS = [
  {
    title: "Product",
    links: [
      ["Features", "/product"],
      ["Pricing", "/pricing"],
      ["Compare", "/compare/resend"],
      ["Changelog", "/changelog"],
      ["Status", "/status"],
    ],
  },
  {
    title: "Developers",
    links: [
      ["Docs", "/docs"],
      ["API Reference", "/docs/api-reference"],
      ["CLI", "/docs/cli"],
      ["SDKs", "/docs/sdks"],
      ["GitHub", "https://github.com/postly"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Customers", "/customers"],
      ["Blog", "/blog"],
      ["Careers", "/about#hiring"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/legal/privacy"],
      ["Terms", "/legal/terms"],
      ["DPA", "/legal/dpa"],
      ["Subprocessors", "/legal/subprocessors"],
      ["AUP", "/legal/aup"],
      ["Security", "/security"],
      ["Cookies", "/legal/cookies"],
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Transactional email for developers who read RFCs. €0.40 per 1,000 emails.
              EU-hosted.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-semibold">{c.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("http") ? (
                      <a href={href} className="text-sm text-muted-foreground hover:text-foreground">
                        {label}
                      </a>
                    ) : (
                      <Link to={href} className="text-sm text-muted-foreground hover:text-foreground">
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <div>© 2026 Postly AB · Built in Stockholm · 🇪🇺 EU-hosted · 🇸🇪</div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.65_0.17_145)]" />
            <Link to="/status" className="hover:text-foreground">All systems operational</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
