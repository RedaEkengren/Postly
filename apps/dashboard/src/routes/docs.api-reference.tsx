import { createFileRoute, Link } from "@tanstack/react-router";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import * as React from "react";

export const Route = createFileRoute("/docs/api-reference")({
  head: () => ({ meta: [{ title: "API Reference - Docs - Postly" }] }),
  component: ApiReference,
});

type Param = { name: string; type: string; required?: boolean; desc: string };
type Endpoint = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  desc: string;
  params?: Param[];
  query?: Param[];
  headers?: Param[];
  response: string;
  curl: string;
  node: string;
  errors?: { status: number; type: string; when: string }[];
};
type Section = { id: string; title: string; desc: string; endpoints: Endpoint[] };

const METHOD_COLOR: Record<string, string> = {
  GET: "bg-[oklch(0.6_0.13_240)] text-white",
  POST: "bg-[oklch(0.55_0.17_145)] text-white",
  PUT: "bg-[oklch(0.6_0.17_70)] text-white",
  DELETE: "bg-destructive text-destructive-foreground",
};

const SECTIONS: Section[] = [
  {
    id: "emails",
    title: "Emails",
    desc: "Send transactional emails and retrieve delivery status.",
    endpoints: [
      {
        method: "POST",
        path: "/v1/emails",
        desc: "Send a transactional email. The message is queued for delivery and processed asynchronously. Returns 202 with the message ID.",
        params: [
          { name: "from", type: "string", required: true, desc: "Sender address. Domain must be verified." },
          { name: "to", type: "string[]", required: true, desc: "Recipient addresses (min 1)." },
          { name: "subject", type: "string", desc: "Email subject (max 998 chars). Required unless using a template." },
          { name: "html", type: "string", desc: "HTML body. Required unless text or template is provided." },
          { name: "text", type: "string", desc: "Plain text body. Falls back to stripped HTML." },
          { name: "cc", type: "string[]", desc: "Carbon copy addresses." },
          { name: "bcc", type: "string[]", desc: "Blind carbon copy addresses." },
          { name: "reply_to", type: "string", desc: "Reply-to address." },
          { name: "tags", type: "object", desc: "Key-value metadata for filtering." },
          { name: "attachments", type: "array", desc: "Array of { filename, content_type, content_base64 }." },
          { name: "scheduled_at", type: "string", desc: "ISO 8601 datetime. Delays delivery until this time." },
          { name: "template", type: "object", desc: "{ slug, version?, variables? }. Render from a stored template." },
        ],
        headers: [
          { name: "Idempotency-Key", type: "string", desc: "Prevents duplicate sends. Retained for 30 days." },
        ],
        response: `{
  "id": "msg_01HX7K3M9P2Q4R5S6T8V",
  "status": "queued",
  "to": ["anna@example.com"],
  "subject": "Your invoice is ready",
  "created_at": "2026-05-27T14:32:00.000Z"
}`,
        curl: `curl -X POST https://api.postly.eu/v1/emails \\
  -H "Authorization: Bearer pst_live_abc123" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: inv-2026-042" \\
  -d '{
    "from": "billing@yourapp.com",
    "to": ["anna@example.com"],
    "subject": "Your invoice is ready",
    "html": "<p>Hi Anna, invoice attached.</p>"
  }'`,
        node: `const msg = await postly.emails.send({
  from: 'billing@yourapp.com',
  to: ['anna@example.com'],
  subject: 'Your invoice is ready',
  html: '<p>Hi Anna, invoice attached.</p>',
}, { idempotencyKey: 'inv-2026-042' });

console.log(msg.id); // msg_01HX7K3M...`,
        errors: [
          { status: 400, type: "domain_not_verified", when: "Sending domain has not completed DKIM verification." },
          { status: 400, type: "recipient_suppressed", when: "Recipient is on the suppression list." },
          { status: 409, type: "idempotency_conflict", when: "Same key reused with a different request body." },
          { status: 422, type: "quota_exceeded", when: "Plan quota exceeded." },
        ],
      },
      {
        method: "GET",
        path: "/v1/emails",
        desc: "List sent emails with cursor-based pagination. Ordered by most recent first.",
        query: [
          { name: "limit", type: "integer", desc: "Results per page (1–100, default 25)." },
          { name: "cursor", type: "string", desc: "Cursor from previous response's next_cursor." },
        ],
        response: `{
  "data": [
    {
      "id": "msg_01HX7K3M9P2Q4R5S6T8V",
      "status": "delivered",
      "to": ["anna@example.com"],
      "subject": "Your invoice is ready",
      "created_at": "2026-05-27T14:32:00.000Z"
    }
  ],
  "next_cursor": "eyJpZCI6Im1zZ18wMUhYN0..."
}`,
        curl: `curl https://api.postly.eu/v1/emails?limit=10 \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const { data, next_cursor } = await postly.emails.list({
  limit: 10,
});`,
      },
      {
        method: "GET",
        path: "/v1/emails/:id",
        desc: "Retrieve a single email with its full event timeline (queued → sent → delivered / bounced).",
        response: `{
  "id": "msg_01HX7K3M9P2Q4R5S6T8V",
  "status": "delivered",
  "from": "billing@yourapp.com",
  "to": ["anna@example.com"],
  "subject": "Your invoice is ready",
  "created_at": "2026-05-27T14:32:00.000Z",
  "events": [
    { "type": "queued", "timestamp": "2026-05-27T14:32:00Z" },
    { "type": "sent", "timestamp": "2026-05-27T14:32:01Z" },
    { "type": "delivered", "timestamp": "2026-05-27T14:32:03Z" }
  ]
}`,
        curl: `curl https://api.postly.eu/v1/emails/msg_01HX7K3M9P2Q4R5S6T8V \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const email = await postly.emails.get(
  'msg_01HX7K3M9P2Q4R5S6T8V'
);

console.log(email.status);  // "delivered"
console.log(email.events);  // timeline array`,
      },
    ],
  },
  {
    id: "domains",
    title: "Domains",
    desc: "Register sending domains and verify DNS records (DKIM, SPF, DMARC).",
    endpoints: [
      {
        method: "POST",
        path: "/v1/domains",
        desc: "Add a domain. Returns DNS records you need to configure at your DNS provider.",
        params: [
          { name: "domain", type: "string", required: true, desc: "Domain name (e.g. yourapp.com)." },
          { name: "return_path", type: "string", desc: "Single DNS label for the return-path subdomain. Defaults to bounces." },
        ],
        response: `{
  "id": "dom_01HX8L4N0Q3R5S7T9V",
  "domain": "yourapp.com",
  "return_path_domain": "bounces.yourapp.com",
  "dkim_status": "pending",
  "spf_status": "pending",
  "dmarc_status": "pending",
  "dns_records": [
    { "type": "TXT", "name": "pst1._domainkey.yourapp.com",
      "value": "v=DKIM1; k=rsa; p=MIIBIjANBgkq...",
      "purpose": "DKIM", "required": true },
    { "type": "MX", "name": "bounces.yourapp.com",
      "value": "10 mx.postly.eu",
      "purpose": "RETURN_PATH", "required": true },
    { "type": "TXT", "name": "bounces.yourapp.com",
      "value": "v=spf1 include:_spf.postly.eu -all",
      "purpose": "SPF", "required": true },
    { "type": "TXT", "name": "_dmarc.yourapp.com",
      "value": "v=DMARC1; p=none; rua=mailto:dmarc@postly.eu",
      "purpose": "DMARC", "required": false }
  ],
  "created_at": "2026-05-27T14:32:00.000Z"
}`,
        curl: `curl -X POST https://api.postly.eu/v1/domains \\
  -H "Authorization: Bearer pst_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{ "domain": "yourapp.com" }'`,
        node: `const domain = await postly.domains.create({
  domain: 'yourapp.com',
  return_path: 'bounces',
});

// Add these records to your DNS provider:
domain.dns_records.forEach((r) => {
  console.log(r.type, r.name, r.value);
});`,
      },
      {
        method: "GET",
        path: "/v1/domains",
        desc: "List all domains in your workspace.",
        response: `{
  "data": [
    {
      "id": "dom_01HX8L4N0Q3R5S7T9V",
      "domain": "yourapp.com",
      "return_path_domain": "bounces.yourapp.com",
      "dkim_status": "verified",
      "spf_status": "verified",
      "dmarc_status": "verified",
      "created_at": "2026-05-27T14:32:00.000Z"
    }
  ]
}`,
        curl: `curl https://api.postly.eu/v1/domains \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const { data } = await postly.domains.list();`,
      },
      {
        method: "GET",
        path: "/v1/domains/:domain",
        desc: "Get details for a single domain, including DNS records and verification status.",
        response: `{
  "id": "dom_01HX8L4N0Q3R5S7T9V",
  "domain": "yourapp.com",
  "return_path_domain": "bounces.yourapp.com",
  "dkim_status": "verified",
  "spf_status": "verified",
  "dmarc_status": "verified",
  "dns_records": [
    { "type": "TXT", "name": "pst1._domainkey.yourapp.com",
      "value": "v=DKIM1; k=rsa; p=MIIBIjANBgkq...",
      "purpose": "DKIM", "required": true },
    { "type": "MX", "name": "bounces.yourapp.com",
      "value": "10 mx.postly.eu",
      "purpose": "RETURN_PATH", "required": true },
    { "type": "TXT", "name": "bounces.yourapp.com",
      "value": "v=spf1 include:_spf.postly.eu -all",
      "purpose": "SPF", "required": true },
    { "type": "TXT", "name": "_dmarc.yourapp.com",
      "value": "v=DMARC1; p=none; rua=mailto:dmarc@postly.eu",
      "purpose": "DMARC", "required": false }
  ],
  "created_at": "2026-05-27T14:32:00.000Z"
}`,
        curl: `curl https://api.postly.eu/v1/domains/yourapp.com \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const domain = await postly.domains.get(
  'yourapp.com'
);`,
      },
      {
        method: "POST",
        path: "/v1/domains/:domain/verify",
        desc: "Trigger a DNS verification check. Updates DKIM, SPF, and DMARC status.",
        response: `{
  "domain": "yourapp.com",
  "dkim_status": "verified",
  "spf_status": "verified",
  "dmarc_status": "pending"
}`,
        curl: `curl -X POST https://api.postly.eu/v1/domains/yourapp.com/verify \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const result = await postly.domains.verify(
  'yourapp.com'
);`,
      },
      {
        method: "DELETE",
        path: "/v1/domains/:domain",
        desc: "Delete a domain. Emails in flight will still be delivered, but no new sends are accepted.",
        response: `204 No Content`,
        curl: `curl -X DELETE https://api.postly.eu/v1/domains/yourapp.com \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `await postly.domains.delete('yourapp.com');`,
      },
    ],
  },
  {
    id: "suppressions",
    title: "Suppressions",
    desc: "Manage the suppression list. Suppressed addresses are blocked from receiving emails.",
    endpoints: [
      {
        method: "GET",
        path: "/v1/suppressions",
        desc: "List suppressed email addresses with optional reason filter.",
        query: [
          { name: "limit", type: "integer", desc: "Results per page (1–100, default 25)." },
          { name: "reason", type: "string", desc: "Filter: bounce, complaint, manual, unsubscribe, or all." },
          { name: "cursor", type: "string", desc: "Cursor from previous response." },
        ],
        response: `{
  "data": [
    {
      "address": "bounce@invalid.test",
      "reason": "bounce",
      "source_message_id": "msg_01HX7K3M...",
      "created_at": "2026-05-23T10:00:00.000Z"
    }
  ],
  "next_cursor": null
}`,
        curl: `curl "https://api.postly.eu/v1/suppressions?reason=bounce" \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const { data } = await postly.suppressions.list({
  reason: 'bounce',
});`,
      },
      {
        method: "POST",
        path: "/v1/suppressions",
        desc: "Manually add an address to the suppression list.",
        params: [
          { name: "address", type: "string", required: true, desc: "Email address to suppress." },
          { name: "reason", type: "string", required: true, desc: "One of: bounce, complaint, manual, unsubscribe." },
          { name: "note", type: "string", desc: "Optional note for your records." },
        ],
        response: `{
  "address": "user@example.com",
  "reason": "manual",
  "created_at": "2026-05-27T14:32:00.000Z"
}`,
        curl: `curl -X POST https://api.postly.eu/v1/suppressions \\
  -H "Authorization: Bearer pst_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "user@example.com",
    "reason": "manual"
  }'`,
        node: `await postly.suppressions.create({
  address: 'user@example.com',
  reason: 'manual',
});`,
      },
      {
        method: "DELETE",
        path: "/v1/suppressions/:address",
        desc: "Remove an address from the suppression list. The address can receive emails again.",
        response: `204 No Content`,
        curl: `curl -X DELETE https://api.postly.eu/v1/suppressions/user%40example.com \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `await postly.suppressions.delete(
  'user@example.com'
);`,
      },
    ],
  },
  {
    id: "api-keys",
    title: "API Keys",
    desc: "Create and manage API keys with fine-grained scopes.",
    endpoints: [
      {
        method: "POST",
        path: "/v1/api-keys",
        desc: "Create a new API key. The full key is returned once - store it securely.",
        params: [
          { name: "name", type: "string", required: true, desc: "Human-readable name (e.g. 'Production')." },
          { name: "scopes", type: "string[]", required: true, desc: "Permissions. See scopes table below." },
        ],
        response: `{
  "id": "key_01HX9M5O1R4S6T8U0W",
  "key": "pst_live_a1B2c3D4e5F6g7H8i9J0kL",
  "key_prefix": "pst_live_a1B2",
  "name": "Production",
  "scopes": ["emails.send", "emails.read"],
  "created_at": "2026-05-27T14:32:00.000Z"
}`,
        curl: `curl -X POST https://api.postly.eu/v1/api-keys \\
  -H "Authorization: Bearer pst_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production",
    "scopes": ["emails.send", "emails.read"]
  }'`,
        node: `const { key } = await postly.apiKeys.create({
  name: 'Production',
  scopes: ['emails.send', 'emails.read'],
});

// Save this - it won't be shown again
console.log(key); // pst_live_a1B2c3D4...`,
      },
      {
        method: "GET",
        path: "/v1/api-keys",
        desc: "List all active (non-revoked) API keys. The full key is never returned.",
        response: `{
  "data": [
    {
      "id": "key_01HX9M5O1R4S6T8U0W",
      "key_prefix": "pst_live_a1B2",
      "name": "Production",
      "scopes": ["emails.send", "emails.read"],
      "last_used_at": "2026-05-27T14:30:00.000Z",
      "created_at": "2026-05-27T14:32:00.000Z"
    }
  ]
}`,
        curl: `curl https://api.postly.eu/v1/api-keys \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const { data } = await postly.apiKeys.list();`,
      },
      {
        method: "DELETE",
        path: "/v1/api-keys/:id",
        desc: "Revoke an API key. Takes effect immediately. Cannot be undone - create a new key instead.",
        response: `204 No Content`,
        curl: `curl -X DELETE https://api.postly.eu/v1/api-keys/key_01HX9M5O1R4S6T8U0W \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `await postly.apiKeys.revoke(
  'key_01HX9M5O1R4S6T8U0W'
);`,
      },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    desc: "Receive real-time HTTP notifications for email events.",
    endpoints: [
      {
        method: "POST",
        path: "/v1/webhooks",
        desc: "Register a webhook endpoint. Returns a signing secret - save it, it's shown once.",
        params: [
          { name: "url", type: "string", required: true, desc: "Your HTTPS endpoint URL." },
          { name: "events", type: "string[]", required: true, desc: "Events to subscribe to. See events table below." },
          { name: "description", type: "string", desc: "Optional human-readable note." },
        ],
        response: `{
  "id": "whk_01HXA6N2P3Q5R7S9T1V",
  "url": "https://yourapp.com/webhooks/postly",
  "secret": "whsec_k8L9m0N1o2P3q4R5s6T7u8",
  "events": ["email.delivered", "email.bounced"],
  "active": true,
  "created_at": "2026-05-27T14:32:00.000Z"
}`,
        curl: `curl -X POST https://api.postly.eu/v1/webhooks \\
  -H "Authorization: Bearer pst_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://yourapp.com/webhooks/postly",
    "events": ["email.delivered", "email.bounced"]
  }'`,
        node: `const { secret } = await postly.webhooks.create({
  url: 'https://yourapp.com/webhooks/postly',
  events: ['email.delivered', 'email.bounced'],
});

// Save this signing secret
console.log(secret); // whsec_k8L9m0N1...`,
      },
      {
        method: "GET",
        path: "/v1/webhooks",
        desc: "List all webhook endpoints.",
        response: `{
  "data": [
    {
      "id": "whk_01HXA6N2P3Q5R7S9T1V",
      "url": "https://yourapp.com/webhooks/postly",
      "events": ["email.delivered", "email.bounced"],
      "active": true,
      "created_at": "2026-05-27T14:32:00.000Z"
    }
  ]
}`,
        curl: `curl https://api.postly.eu/v1/webhooks \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const { data } = await postly.webhooks.list();`,
      },
      {
        method: "DELETE",
        path: "/v1/webhooks/:id",
        desc: "Delete a webhook endpoint. Pending deliveries will still be attempted.",
        response: `204 No Content`,
        curl: `curl -X DELETE https://api.postly.eu/v1/webhooks/whk_01HXA6N2P3Q5R7S9T1V \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `await postly.webhooks.delete(
  'whk_01HXA6N2P3Q5R7S9T1V'
);`,
      },
    ],
  },
  {
    id: "templates",
    title: "Templates",
    desc: "Store and version email templates. Reference them by slug when sending.",
    endpoints: [
      {
        method: "POST",
        path: "/v1/templates",
        desc: "Create a template with its first version.",
        params: [
          { name: "slug", type: "string", required: true, desc: "URL-safe identifier (e.g. welcome-email)." },
          { name: "format", type: "string", required: true, desc: "One of: html, mjml, react." },
          { name: "source", type: "string", required: true, desc: "Template content with {{variable}} placeholders." },
          { name: "subject", type: "string", required: true, desc: "Subject line (can use {{variables}})." },
          { name: "vars_schema", type: "object", desc: "JSON Schema for template variables." },
        ],
        response: `{
  "id": "tpl_01HXB7O3Q4R6S8T0U2V",
  "slug": "welcome-email",
  "current_version": 1,
  "format": "html",
  "subject": "Welcome, {{name}}!",
  "created_at": "2026-05-27T14:32:00.000Z"
}`,
        curl: `curl -X POST https://api.postly.eu/v1/templates \\
  -H "Authorization: Bearer pst_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "slug": "welcome-email",
    "format": "html",
    "subject": "Welcome, {{name}}!",
    "source": "<h1>Hi {{name}}</h1><p>Welcome.</p>"
  }'`,
        node: `await postly.templates.create({
  slug: 'welcome-email',
  format: 'html',
  subject: 'Welcome, {{name}}!',
  source: '<h1>Hi {{name}}</h1><p>Welcome.</p>',
});`,
      },
      {
        method: "POST",
        path: "/v1/templates/:slug/versions",
        desc: "Publish a new version of an existing template. The latest version is used by default when sending.",
        params: [
          { name: "format", type: "string", required: true, desc: "Template format." },
          { name: "source", type: "string", required: true, desc: "Updated template content." },
          { name: "subject", type: "string", required: true, desc: "Updated subject line." },
        ],
        response: `{
  "id": "tplv_01HXC8P4R5S7T9U1V3W",
  "version": 2
}`,
        curl: `curl -X POST https://api.postly.eu/v1/templates/welcome-email/versions \\
  -H "Authorization: Bearer pst_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "format": "html",
    "subject": "Welcome aboard, {{name}}!",
    "source": "<h1>Hi {{name}}</h1><p>Glad to have you.</p>"
  }'`,
        node: `await postly.templates.createVersion(
  'welcome-email',
  {
    format: 'html',
    subject: 'Welcome aboard, {{name}}!',
    source: '<h1>Hi {{name}}</h1>...',
  }
);`,
      },
      {
        method: "GET",
        path: "/v1/templates",
        desc: "List all templates.",
        response: `{
  "data": [
    {
      "id": "tpl_01HXB7O3Q4R6S8T0U2V",
      "slug": "welcome-email",
      "created_at": "2026-05-27T14:32:00.000Z"
    }
  ]
}`,
        curl: `curl https://api.postly.eu/v1/templates \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const { data } = await postly.templates.list();`,
      },
      {
        method: "GET",
        path: "/v1/templates/:slug",
        desc: "Get a template by slug, including the current published version.",
        response: `{
  "slug": "welcome-email",
  "current_version": {
    "id": "tplv_01HX9N6P1R3S5T7V9X",
    "version": 4,
    "subject": "Welcome to {{company}}",
    "format": "mjml",
    "created_at": "2026-05-25T09:00:00.000Z"
  },
  "created_at": "2026-04-10T14:32:00.000Z"
}`,
        curl: `curl https://api.postly.eu/v1/templates/welcome-email \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const tpl = await postly.templates.get(
  'welcome-email'
);`,
      },
      {
        method: "DELETE",
        path: "/v1/templates/:slug",
        desc: "Delete a template and all its versions.",
        response: `{ "deleted": true }`,
        curl: `curl -X DELETE https://api.postly.eu/v1/templates/welcome-email \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `await postly.templates.delete('welcome-email');`,
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    desc: "Retrieve workspace information.",
    endpoints: [
      {
        method: "GET",
        path: "/v1/account",
        desc: "Get your workspace details, plan, and credit balance.",
        response: `{
  "id": "ws_01HXD9Q5S6T8U0V2W4X",
  "name": "My Workspace",
  "plan": "payg",
  "status": "active",
  "credit_balance": 1250,
  "created_at": "2026-04-01T10:00:00.000Z"
}`,
        curl: `curl https://api.postly.eu/v1/account \\
  -H "Authorization: Bearer pst_live_abc123"`,
        node: `const account = await postly.account.get();
console.log(account.plan);  // "payg"`,
      },
    ],
  },
];

const SCOPES = [
  ["emails.send", "Send emails"],
  ["emails.read", "List and view emails and events"],
  ["domains.read", "List and view domains"],
  ["domains.write", "Create, verify, and delete domains"],
  ["suppressions.read", "List suppressed addresses"],
  ["suppressions.write", "Add and remove suppressions"],
  ["templates.read", "List and view templates"],
  ["templates.write", "Create, version, and delete templates"],
  ["webhooks.read", "List and view webhooks"],
  ["webhooks.write", "Create and delete webhooks"],
  ["account.read", "View workspace info"],
];

const WEBHOOK_EVENTS = [
  ["email.queued", "Message accepted and queued for sending."],
  ["email.sent", "Accepted by the recipient's mail server for delivery."],
  ["email.delivered", "Confirmed delivery to recipient's mail server."],
  ["email.bounced", "Hard or soft bounce received."],
  ["email.complained", "Recipient marked the email as spam."],
  ["email.failed", "Delivery failed permanently."],
  ["domain.verified", "All DNS records verified successfully."],
  ["domain.verification_failed", "DNS verification check failed."],
];

const NAV_DOCS = ["Quickstart", "Authentication", "Sending Email", "Domains", "Webhooks", "CLI"];

function ApiReference() {
  const [tab, setTab] = React.useState<"curl" | "node">("curl");

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Left nav */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 text-sm">
            <Link to="/docs" className="text-muted-foreground hover:text-foreground">&larr; All docs</Link>
            <div className="mt-6 space-y-1">
              {NAV_DOCS.map((l) => (
                <Link key={l} to="/docs/$slug" params={{ slug: l.toLowerCase().replace(/\s+/g, "-") }} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  {l}
                </Link>
              ))}
              <Link to="/docs/api-reference" className="block rounded-md bg-secondary px-2 py-1 font-medium text-foreground">
                API Reference
              </Link>
            </div>

            <div className="mt-8 border-t border-border pt-4 text-xs uppercase tracking-wider text-muted-foreground">Endpoints</div>
            <div className="mt-2 space-y-1">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">
                  {s.title}
                </a>
              ))}
              <a href="#scopes" className="block rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">Scopes</a>
              <a href="#webhook-events" className="block rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">Webhook Events</a>
              <a href="#errors" className="block rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">Errors</a>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <Link to="/docs">Docs</Link> / API Reference
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">API Reference</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Complete reference for the Postly REST API. Base URL: <code className="rounded bg-secondary px-1.5 py-0.5 text-sm font-mono">https://api.postly.eu</code>
          </p>

          {/* Intro cards */}
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <IntroCard title="Authentication" body="Pass your API key as a Bearer token or HTTP Basic auth (username = key, no password)." code='Authorization: Bearer pst_live_...' />
            <IntroCard title="Pagination" body="List endpoints use cursor-based pagination. Pass limit (1–100) and cursor from the previous response." code='"next_cursor": "eyJpZCI6..."' />
            <IntroCard title="Idempotency" body="POST /v1/emails accepts an Idempotency-Key header. Keys are retained for 30 days." code='Idempotency-Key: inv-2026-042' />
            <IntroCard title="Errors" body="All errors return RFC 7807 problem details with type, title, status, and detail fields." code='{ "type": "validation_error", "status": 400 }' />
          </div>

          {/* Language toggle */}
          <div className="mt-12 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Examples in:</span>
            <div className="flex rounded-md border border-border text-sm">
              <button onClick={() => setTab("curl")} className={`px-3 py-1 rounded-l-md ${tab === "curl" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>curl</button>
              <button onClick={() => setTab("node")} className={`px-3 py-1 rounded-r-md ${tab === "node" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>Node.js</button>
            </div>
          </div>

          {/* Endpoint sections */}
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="mt-14">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className="mt-2 text-muted-foreground">{section.desc}</p>

              {section.endpoints.map((ep, i) => (
                <div key={i} className="mt-8 border-t border-border pt-8">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${METHOD_COLOR[ep.method]}`}>
                      {ep.method}
                    </span>
                    <code className="font-mono text-sm">{ep.path}</code>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{ep.desc}</p>

                  <div className="mt-6 grid gap-6 xl:grid-cols-2">
                    {/* Left: params + response schema */}
                    <div className="min-w-0 space-y-6">
                      {ep.headers && ep.headers.length > 0 && (
                        <ParamTable title="Headers" params={ep.headers} />
                      )}
                      {ep.params && ep.params.length > 0 && (
                        <ParamTable title="Body parameters" params={ep.params} />
                      )}
                      {ep.query && ep.query.length > 0 && (
                        <ParamTable title="Query parameters" params={ep.query} />
                      )}
                      {ep.errors && ep.errors.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Error codes</h4>
                          <div className="space-y-1.5 text-sm">
                            {ep.errors.map((e) => (
                              <div key={e.type} className="flex gap-2">
                                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{e.status}</Badge>
                                <code className="shrink-0 text-xs text-destructive">{e.type}</code>
                                <span className="text-xs text-muted-foreground">- {e.when}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response</h4>
                        <CodeBlock code={ep.response} language="json" />
                      </div>
                    </div>

                    {/* Right: code examples */}
                    <div className="min-w-0">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request</h4>
                      <CodeBlock code={tab === "curl" ? ep.curl : ep.node} language={tab === "curl" ? "bash" : "ts"} />
                    </div>
                  </div>
                </div>
              ))}
            </section>
          ))}

          {/* Scopes table */}
          <section id="scopes" className="mt-14">
            <h2 className="text-2xl font-semibold">API Key Scopes</h2>
            <p className="mt-2 text-muted-foreground">Assign scopes when creating an API key to restrict its permissions.</p>
            <table className="mt-4 w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Scope</th>
                  <th className="py-2 text-left font-medium">Permission</th>
                </tr>
              </thead>
              <tbody>
                {SCOPES.map(([scope, desc]) => (
                  <tr key={scope} className="border-b border-border">
                    <td className="py-2 font-mono text-xs">{scope}</td>
                    <td className="py-2 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Webhook events table */}
          <section id="webhook-events" className="mt-14">
            <h2 className="text-2xl font-semibold">Webhook Events</h2>
            <p className="mt-2 text-muted-foreground">Subscribe to any combination of these events when creating a webhook.</p>
            <table className="mt-4 w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Event</th>
                  <th className="py-2 text-left font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {WEBHOOK_EVENTS.map(([event, desc]) => (
                  <tr key={event} className="border-b border-border">
                    <td className="py-2 font-mono text-xs">{event}</td>
                    <td className="py-2 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="mt-8 text-lg font-semibold">Signature verification</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Every webhook request includes an <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">X-Postly-Signature</code> header
              in the format <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">t=&lt;timestamp&gt;,v1=&lt;hex&gt;</code>.
              Verify using HMAC-SHA256.
            </p>
            <div className="mt-4">
              <CodeBlock code={`import { verifyWebhookSignature } from '@postly/node';

const isValid = verifyWebhookSignature({
  payload: req.body,           // raw string
  signature: req.headers['x-postly-signature'],
  secret: process.env.WEBHOOK_SECRET,
  tolerance: 300,              // seconds (default)
});`} language="ts" />
            </div>
          </section>

          {/* Errors */}
          <section id="errors" className="mt-14">
            <h2 className="text-2xl font-semibold">Errors</h2>
            <p className="mt-2 text-muted-foreground">All errors follow RFC 7807 problem details format.</p>
            <div className="mt-4">
              <CodeBlock code={`{
  "type": "https://docs.postly.eu/errors/validation_error",
  "title": "Validation error",
  "status": 400,
  "detail": "from: Invalid email address",
  "instance": "req_01HXE0R6T7U9V1W3X5Y"
}`} language="json" />
            </div>
            <table className="mt-6 w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-left font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [400, "validation_error", "Invalid request parameters."],
                  [400, "domain_not_verified", "Sending domain lacks DKIM verification."],
                  [400, "recipient_suppressed", "Recipient is on the suppression list."],
                  [401, "unauthorized", "Missing or invalid API key."],
                  [403, "forbidden", "API key lacks the required scope."],
                  [404, "not_found", "Resource does not exist."],
                  [409, "idempotency_conflict", "Same key reused with a different request body."],
                  [422, "quota_exceeded", "Plan quota or credits exhausted."],
                  [429, "rate_limited", "Too many requests. Check X-RateLimit-* headers."],
                  [500, "internal_error", "Unexpected server error."],
                ].map(([status, type, when]) => (
                  <tr key={String(type)} className="border-b border-border">
                    <td className="py-2"><Badge variant="outline" className="font-mono text-[10px]">{status}</Badge></td>
                    <td className="py-2 font-mono text-xs">{type}</td>
                    <td className="py-2 text-muted-foreground">{when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Rate limits */}
          <section id="rate-limits" className="mt-14 mb-20">
            <h2 className="text-2xl font-semibold">Rate Limits</h2>
            <p className="mt-2 text-muted-foreground">Rate limit headers are included in every response.</p>
            <div className="mt-4">
              <CodeBlock code={`X-RateLimit-Limit: 50
X-RateLimit-Remaining: 49
X-RateLimit-Reset: 1748356320`} language="bash" />
            </div>
            <table className="mt-6 w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Plan</th>
                  <th className="py-2 text-left font-medium">Requests / sec</th>
                  <th className="py-2 text-left font-medium">Monthly limit</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Free", "5", "3,000 emails (100 / day)"],
                  ["Pay-as-you-go, first 14 days", "50", "1,000 emails / day"],
                  ["Pay-as-you-go", "50", "Unlimited"],
                ].map(([plan, rps, monthly]) => (
                  <tr key={plan} className="border-b border-border">
                    <td className="py-2 font-medium">{plan}</td>
                    <td className="py-2 font-mono text-xs">{rps}</td>
                    <td className="py-2 text-muted-foreground">{monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}

function IntroCard({ title, body, code }: { title: string; body: string; code: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      <code className="mt-2 block rounded bg-secondary px-2 py-1 font-mono text-[11px]">{code}</code>
    </div>
  );
}

function ParamTable({ title, params }: { title: string; params: Param[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="divide-y divide-border rounded-md border border-border">
        {params.map((p) => (
          <div key={p.name} className="px-3 py-2">
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs font-semibold">{p.name}</code>
              <span className="text-[10px] text-muted-foreground">{p.type}</span>
              {p.required && <span className="text-[10px] font-medium text-destructive">required</span>}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
