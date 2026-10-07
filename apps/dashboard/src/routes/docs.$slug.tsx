import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { CodeBlock } from "@/components/code-block";

export const Route = createFileRoute("/docs/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${titleize(params.slug)} - Docs - Postly` }],
  }),
  component: DocsArticle,
});

function titleize(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const NAV = ["Quickstart", "Authentication", "Sending Email", "Domains", "Webhooks", "CLI"];

const DOCS: Record<string, { intro: string; sections: { title: string; body?: string; code?: string; lang?: string }[] }> = {
  quickstart: {
    intro: "Go from zero to a delivered email in under 60 seconds.",
    sections: [
      { title: "Install", body: "Install the Node SDK from npm.", code: "npm install @postly/node" },
      { title: "Set your API key", body: "Create a key in the dashboard under API Keys, then export it.", code: "export POSTLY_API_KEY=pst_live_..." },
      { title: "Send your first email", body: "Authenticate with your API key and send a transactional email.", code: `import { Postly } from '@postly/node';\n\nconst postly = new Postly({ apiKey: process.env.POSTLY_API_KEY });\n\nawait postly.emails.send({\n  from: 'team@yourdomain.com',\n  to: 'customer@example.com',\n  subject: 'Hello from Postly',\n  html: '<p>Your account is ready.</p>',\n});` },
      { title: "Next steps", body: "Verify your domain for production sending. Set up webhooks to follow delivery events. Install the CLI for local development." },
    ],
  },
  authentication: {
    intro: "Every API request requires an API key. Keys are scoped to a workspace and can have restricted permissions.",
    sections: [
      { title: "Creating an API key", body: "Navigate to Settings → API Keys in the dashboard. Give the key a name and select scopes (send, read, admin). The full key is shown once. Store it securely." },
      { title: "Using the key", body: "Pass the key as HTTP Basic auth (username = key, no password) or as a Bearer token.", code: `# Basic auth\ncurl https://api.postly.eu/v1/emails \\\n  -u "pst_live_abc123:"\n\n# Bearer token\ncurl https://api.postly.eu/v1/emails \\\n  -H "Authorization: Bearer pst_live_abc123"`, lang: "bash" },
      { title: "Scopes", body: "send - can send emails and manage templates. read - can list messages, events, and domains. admin - can manage API keys, webhooks, and account settings." },
      { title: "Revoking keys", body: "Revoked keys stop working immediately. There is no undo. Create a new key instead." },
    ],
  },
  "sending-email": {
    intro: "Send transactional emails via the REST API or any of the official SDKs.",
    sections: [
      { title: "Single send", body: "POST to /v1/emails with from, to, subject, and html (or text) fields.", code: `await postly.emails.send({\n  from: 'billing@yourdomain.com',\n  to: 'anna@example.com',\n  subject: 'Invoice #2026-042',\n  html: '<p>Your invoice is attached.</p>',\n  tags: ['billing', 'invoice'],\n});` },
      { title: "Idempotency", body: "Add an Idempotency-Key header to prevent duplicate sends. Keys are retained for 30 days. Re-sending with the same key returns the original response without sending again.", code: `await postly.emails.send({\n  from: 'team@yourdomain.com',\n  to: 'user@example.com',\n  subject: 'Welcome',\n  html: '<p>Welcome aboard.</p>',\n  idempotency_key: 'welcome-user-42',\n});` },
      { title: "Attachments", body: "Pass an attachments array with filename, content_base64, and content_type. The total request body is capped at 10MB." },
      { title: "Rate limits", body: "Pay-as-you-go: 50 requests/second. Free tier: 5 requests/second, 100 emails/day and 3,000/month. New pay-as-you-go accounts send up to 1,000/day for their first 14 days while we get a read on their traffic." },
    ],
  },
  domains: {
    intro: "Verify domain ownership via DNS to start sending. Each domain needs DKIM, SPF, and DMARC records.",
    sections: [
      { title: "Add a domain", body: "Use the dashboard or API to add a domain. Postly generates a DKIM key for it and returns the records to publish: a DKIM TXT record, an MX and SPF record on your return-path subdomain, and a recommended DMARC record.", code: `curl -X POST https://api.postly.eu/v1/domains \\\n  -u "$POSTLY_API_KEY:" \\\n  -d domain=yourdomain.com \\\n  -d return_path=bounces`, lang: "bash" },
      { title: "DNS records", body: "Add the TXT and MX records shown in the dashboard to your DNS provider. Verification usually completes within minutes but can take up to 72 hours." },
      { title: "Return path", body: "The return-path subdomain (bounces.yourdomain.com by default) is the envelope sender we send from, so asynchronous bounces and complaint reports come back to us and land on the right message. Its MX and SPF records are required to send." },
      { title: "Verify", body: "Click 'Verify DNS' in the dashboard or call POST /v1/domains/:domain/verify. A domain is verified once DKIM, the return-path MX and its SPF record are in place. DMARC is recommended, not required." },
    ],
  },
  webhooks: {
    intro: "Receive real-time notifications when emails are queued, delivered, bounced, or reported as spam.",
    sections: [
      { title: "Subscribing", body: "Create a webhook endpoint in the dashboard. Select which events you want to receive. Postly sends a POST request to your URL for each matching event." },
      { title: "Event types", body: "email.queued - message accepted and queued for sending.\nemail.sent - accepted by the recipient's mail server.\nemail.delivered - confirmed delivery to recipient's mail server.\nemail.bounced - hard or soft bounce received.\nemail.complained - recipient marked as spam.\nemail.failed - delivery failed permanently.\n\nPostly does not track opens or clicks, so there are no email.opened or email.clicked events." },
      { title: "Signature verification", body: "Every webhook request includes an X-Postly-Signature header. Verify it using HMAC-SHA256 with your webhook secret.", code: `import { verifyWebhook } from '@postly/node';\n\nconst isValid = verifyWebhook(\n  body,\n  headers['x-postly-signature'],\n  process.env.WEBHOOK_SECRET,\n);` },
      { title: "Retries", body: "Failed deliveries (non-2xx response or timeout) are retried 6 times over 32 hours with exponential backoff." },
    ],
  },
  cli: {
    intro: "The Postly CLI lets you manage domains, send test emails, and tail logs from your terminal.",
    sections: [
      { title: "Install", body: "Install globally via npm.", code: "npm install -g @postly/cli" },
      { title: "Setup", body: "Initialize a project and configure your API key.", code: `postly init yourdomain.com\n# Prompts for API key and configures DNS records`, lang: "bash" },
      { title: "Sending", body: "Send a test email from the command line.", code: `postly send \\\n  --from team@yourdomain.com \\\n  --to test@example.com \\\n  --subject "Test from CLI" \\\n  --html "<p>Hello from the terminal.</p>"`, lang: "bash" },
      { title: "Live logs", body: "Stream delivery events in real time.", code: "postly logs --tail", lang: "bash" },
      { title: "Migration", body: "Import domains, API keys, and templates from another provider.", code: "postly migrate --from resend --api-key $OLD_KEY", lang: "bash" },
    ],
  },
};

function DocsArticle() {
  const { slug } = useParams({ from: "/docs/$slug" });
  const title = titleize(slug);
  const doc = DOCS[slug];

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[220px_minmax(0,1fr)_200px]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 text-sm">
          <Link to="/docs" className="text-muted-foreground hover:text-foreground">&larr; All docs</Link>
          <div className="mt-6 space-y-1">
            {NAV.map((l) => {
              const navSlug = l.toLowerCase().replace(/\s+/g, "-");
              return (
                <Link
                  key={l}
                  to="/docs/$slug"
                  params={{ slug: navSlug }}
                  className={`block rounded-md px-2 py-1 hover:bg-secondary hover:text-foreground ${navSlug === slug ? "bg-secondary font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  {l}
                </Link>
              );
            })}
              <Link to="/docs/api-reference" className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                API Reference
              </Link>
          </div>
        </div>
      </aside>
      <article className="min-w-0">
        <div className="text-xs text-muted-foreground">
          <Link to="/docs">Docs</Link> / {title}
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {doc ? doc.intro : `A short, opinionated guide to ${title.toLowerCase()}. Code samples are runnable end-to-end.`}
        </p>

        {doc ? (
          doc.sections.map((s, i) => (
            <section key={i}>
              <h2 className="mt-10 text-2xl font-semibold">{s.title}</h2>
              {s.body && <p className="mt-2 text-muted-foreground whitespace-pre-line">{s.body}</p>}
              {s.code && (
                <div className="mt-4">
                  <CodeBlock code={s.code} language={s.lang ?? "ts"} />
                </div>
              )}
            </section>
          ))
        ) : (
          <>
            <h2 className="mt-12 text-2xl font-semibold">Install</h2>
            <p className="mt-2 text-muted-foreground">Install the Node SDK from npm.</p>
            <div className="mt-4"><CodeBlock code="npm install @postly/node" /></div>

            <h2 className="mt-10 text-2xl font-semibold">Send your first email</h2>
            <p className="mt-2 text-muted-foreground">Authenticate with your API key and send.</p>
            <div className="mt-4"><CodeBlock code={`import { Postly } from '@postly/node';\n\nconst postly = new Postly({ apiKey: process.env.POSTLY_API_KEY });\n\nawait postly.emails.send({\n  from: 'team@yourdomain.com',\n  to: 'anna@example.com',\n  subject: 'Hello',\n  html: '<p>Welcome.</p>',\n});`} /></div>

            <h2 className="mt-10 text-2xl font-semibold">Next steps</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
              <li>Verify your domain.</li>
              <li>Subscribe to webhooks.</li>
              <li>Set up the CLI for local dev.</li>
            </ul>
          </>
        )}

        <div className="mt-14 rounded-lg border border-border bg-card p-5 text-sm">
          Was this helpful?
          <button className="ml-4 rounded-md border border-border px-3 py-1 hover:bg-accent">Yes</button>
          <button className="ml-2 rounded-md border border-border px-3 py-1 hover:bg-accent">No</button>
        </div>
      </article>
      <aside className="hidden lg:block">
        <div className="sticky top-24 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">On this page</div>
          <ul className="mt-3 space-y-1.5">
            {(doc ? doc.sections : [{ title: "Install" }, { title: "First email" }, { title: "Next steps" }]).map((s) => (
              <li key={s.title}>
                <a href={`#${s.title.toLowerCase().replace(/\s+/g, "-")}`} className="text-muted-foreground hover:text-foreground">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
