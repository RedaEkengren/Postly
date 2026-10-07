import { createFileRoute, useParams } from "@tanstack/react-router";
import { MarketingPageShell } from "@/components/marketing-page-shell";

export const Route = createFileRoute("/legal/$page")({
  head: ({ params }) => ({
    meta: [{ title: `${PAGES[params.page]?.title ?? "Legal"} - Postly` }],
  }),
  component: Legal,
});

const PAGES: Record<string, { title: string; lead: string; body: React.ReactNode }> = {
  privacy: {
    title: "Privacy policy",
    lead: "How we collect, use, and protect personal data.",
    body: (
      <>
        <h2>1. Who we are</h2><p>Postly AB, Kungsgatan 32, 111 35 Stockholm, Sweden.</p>
        <h2>2. Data we process</h2><p>Account data, message metadata, payment information, and message contents for the duration of idempotency windows.</p>
        <h2>3. Legal basis</h2><p>Performance of contract (Art. 6(1)(b)) and legitimate interest (Art. 6(1)(f)).</p>
        <h2>4. Subprocessors</h2><p>See <a href="/legal/subprocessors">/legal/subprocessors</a>.</p>
        <h2>5. Your rights</h2><p>Access, rectification, erasure, portability, restriction, objection. Contact dpo@postly.eu.</p>
      </>
    ),
  },
  terms: {
    title: "Terms of service",
    lead: "The legal agreement between you and Postly AB.",
    body: <><h2>1. Acceptance</h2><p>By using Postly you agree to these terms.</p><h2>2. Service</h2><p>Postly provides a transactional email API on a pay-as-you-go basis.</p><h2>3. Acceptable use</h2><p>See <a href="/legal/aup">/legal/aup</a>.</p><h2>4. Liability</h2><p>Limited to the fees paid in the prior 12 months.</p></>,
  },
  dpa: {
    title: "Data Processing Agreement",
    lead: "Pre-signed by Postly AB upon signup. Effective from your first send.",
    body: <><h2>1. Scope</h2><p>Postly acts as Data Processor for personal data in email contents and recipient lists. You are the Data Controller.</p><h2>2. Sub-processing</h2><p>We use the sub-processors listed at <a href="/legal/subprocessors">/legal/subprocessors</a>. We will notify you 30 days before adding or replacing any.</p><h2>3. International transfers</h2><p>Your data is stored in the EU and your mail is delivered from EU infrastructure operated by Postly AB. Where a subprocessor listed at <a href="/legal/subprocessors">/legal/subprocessors</a> is a US company or US-owned, its role, its EU region and the transfer basis are stated there. International transfers beyond that require your explicit instruction.</p></>,
  },
  subprocessors: {
    title: "Subprocessors",
    lead: "The third parties we use and where they operate.",
    body: (
      <table className="not-prose w-full text-sm">
        <thead><tr className="border-b border-border"><th className="py-2 text-left font-medium">Provider</th><th className="text-left font-medium">Role</th><th className="text-left font-medium">Jurisdiction</th></tr></thead>
        <tbody>
          {[
            ["Hetzner", "Application and mail servers", "EU (Germany, Finland)"],
            ["Neon", "Postgres database", "EU (Frankfurt)"],
            ["Stripe", "Payments", "Ireland"],
            ["Better Stack", "Logs & uptime", "EU (Germany)"],
            ["Cloudflare", "CDN, DDoS, DNS", "Global (EU edge)"],
          ].map((r) => <tr key={r[0]} className="border-b border-border"><td className="py-3">{r[0]}</td><td>{r[1]}</td><td className="text-muted-foreground">{r[2]}</td></tr>)}
        </tbody>
      </table>
    ),
  },
  aup: { title: "Acceptable use policy", lead: "What you can and can't send with Postly.", body: <><h2>Allowed</h2><p>Transactional email to your users: receipts, notifications, password resets, alerts.</p><h2>Prohibited</h2><p>Unsolicited bulk email, phishing, malware, illegal content. Suspected violations result in immediate suspension.</p></> },
  cookies: { title: "Cookie policy", lead: "What we store in your browser and why.", body: <><h2>Essential</h2><p>Session cookie for authenticated dashboard sessions.</p><h2>Preferences</h2><p>Theme preference (light/dark) stored locally.</p><h2>Analytics</h2><p>Self-hosted, anonymized. No third-party trackers.</p></> },
  sla: {
    title: "Service Level Agreement",
    lead: "Postly's uptime commitment for paid plans.",
    body: (
      <>
        <h2>1. Uptime target</h2>
        <p>99.9% monthly uptime for Pay-as-you-go. Free tier: best-effort, no SLA.</p>
        <h2>2. Measurement</h2>
        <p>Measured per calendar month on the <code>/v1</code> API endpoint. Excludes scheduled maintenance (max 4 hours/month, 48 hours advance notice via email and status page).</p>
        <h2>3. Credits</h2>
        <p>If uptime falls below 99.9% in a calendar month, affected tenants receive automatic account credit equal to 10× the fees attributable to the downtime minutes. Credits are applied to the next invoice.</p>
        <h2>4. Exclusions</h2>
        <p>Downtime caused by force majeure, upstream network or datacenter failure, or customer misconfiguration (e.g. invalid DNS records) is excluded. Mail slowed or rejected by a recipient's mail server is a delivery outcome, not downtime.</p>
        <h2>5. Claiming</h2>
        <p>Credits are applied automatically. No ticket required. You can verify uptime on <a href="/status">/status</a>.</p>
      </>
    ),
  },
};

function Legal() {
  const { page } = useParams({ from: "/legal/$page" });
  const p = PAGES[page];
  if (!p) return <MarketingPageShell eyebrow="Legal" title="Not found" lead="This legal page does not exist."><p>Return to <a href="/legal/terms">Terms</a> or <a href="/legal/privacy">Privacy policy</a>.</p></MarketingPageShell>;
  return <MarketingPageShell eyebrow="Legal" title={p.title} lead={p.lead}>{p.body}</MarketingPageShell>;
}
