import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/code-block";
import { BLOG_POSTS } from "@/lib/mock-data";

export const Route = createFileRoute("/blog/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${BLOG_POSTS.find((p) => p.slug === params.slug)?.title ?? "Blog"} - Postly` }],
  }),
  component: BlogPost,
});

const BLOG_CONTENT: Record<string, React.ReactNode> = {
  "why-we-built-postly": (
    <>
      <p className="text-lg text-muted-foreground">
        In January 2026, Resend announced their new pricing tiers. My monthly bill for a modest SaaS
        went from $12 to $80 overnight. That was the catalyst, but the real problem had been bothering
        me for years.
      </p>

      <h2>The subscription trap</h2>
      <p>
        Every transactional email provider follows the same playbook: a generous free tier to get you
        integrated, then monthly subscriptions that charge for capacity you rarely use. You pay $20/month
        for 50,000 emails even if you send 8,000. The overage charges are steep enough to make you
        upgrade to the next tier "just in case." You never downgrade because re-evaluating billing plans
        is nobody's idea of a good Tuesday.
      </p>
      <p>
        Resend, Postmark, SendGrid, Mailgun - they all do this. The economics work because customers
        over-provision. It's the gym membership model applied to API calls.
      </p>

      <h2>What Postly does instead</h2>
      <p>
        Postly is pay-as-you-go. You pay EUR 0.40 per 1,000 emails. No tiers, no monthly minimum, no
        overage pricing. Your first 3,000 emails each month are free. If you send nothing, you pay nothing.
      </p>
      <p>
        The math is simple. If you send 25,000 emails in a month, you pay EUR 8.80. The next month
        you send 4,000, you pay EUR 0.40. No plan changes, no support tickets, no "please contact sales
        for a custom quote."
      </p>
      <p>
        Our costs are mostly fixed: servers, sending IPs, monitoring. They do not scale with your
        volume the way a subscription does, so we do not price as if they did. The margin grows as we
        send more, instead of being a markup on somebody else's invoice.
      </p>

      <h2>EU-hosted, and EU-delivered</h2>
      <p>
        I'm based in Stockholm. Most of our early customers are European. When your compliance team
        asks where email data is processed, "San Francisco" is not a great answer.
      </p>
      <p>
        Postly started as a control plane in front of Amazon SES, which meant every message still
        transited a US provider. So we built the sending side ourselves. Postly now runs its own mail
        transfer agents in the EU: we generate a DKIM key per domain, sign your mail with it, shape
        traffic per mailbox provider and take bounces back on your own return-path subdomain. There is
        no other email provider in the path. The DPA is pre-signed at signup, no emailing
        legal@vendor.com and waiting three weeks.
      </p>

      <h2>What that costs us</h2>
      <p>
        Honesty about the trade-off: reputation is now ours to build. Our IPs start with none, warm-up
        takes weeks of real traffic, and one abusive sender can hurt everyone on the pool. That is why
        every account has sending limits, why complaint and hard-bounce spikes pause sending
        automatically, and why the free tier is capped at 100 emails a day. A provider that skips those
        controls is spending your deliverability, not theirs.
      </p>

      <h2>What Postly is not</h2>
      <p>
        Postly is not a marketing email platform. No drag-and-drop campaign builders, no contact lists,
        no A/B subject line testing. We handle transactional email: password resets, invoices, receipts,
        notifications. The kind of email your app sends because something happened, not because your
        marketing team scheduled it.
      </p>
      <p>
        We also do not compete on features like inbound email parsing (yet) or SMS. The scope is
        intentionally narrow: send transactional email reliably, cheaply, and in compliance with EU law.
        That's it.
      </p>

      <h2>Try it</h2>
      <p>
        The API is live. The free tier doesn't require a credit card. If you're currently overpaying
        for a Resend or Postmark subscription, the migration takes about five minutes.
      </p>
    </>
  ),

  "999-uptime-with-one-founder": (
    <>
      <p className="text-lg text-muted-foreground">
        Postly targets 99.9% uptime and I'm the only person who works on it. No on-call rotation, no
        SRE team, no Kubernetes cluster. What makes that possible is not heroics: it is that the queue,
        not the API, is what a customer actually depends on.
      </p>

      <h2>The queue is the promise</h2>
      <p>
        A message is written to Postgres before the API answers, then queued. That single ordering is
        what lets one person run this: if the API is down you get a connection error and retry, and if
        a worker or the MTA is down the job sits in Redis until it isn't. Nothing in the path is allowed
        to accept a message and then lose it.
      </p>
      <p>
        We do run our own mail transfer agents now, in the EU, instead of handing mail to Amazon. That
        is more machine to look after, not more risk to the promise above: the workers talk to a
        <code>DeliveryEngine</code> interface and inject over SMTP on the private network, so a dead MTA
        is a retry, the same as a dead upstream would have been.
      </p>

      <h2>The stack</h2>
      <p>
        The API is a Hono server running on Node.js 22. Hono is fast, typed, and small - around 14KB.
        It handles routing, middleware, and request validation. Behind it sits BullMQ for job queuing
        (backed by Redis 7) and Postgres 16 for everything else.
      </p>
      <CodeBlock language="ts" code={`// Simplified send flow
app.post("/v1/emails", authMiddleware, async (c) => {
  const body = validateSendRequest(c);

  // Check idempotency (30-day window)
  const existing = await checkIdempotency(body);
  if (existing) return c.json(existing, 200);

  // Check suppression list
  const suppressed = await checkSuppression(body.to);
  if (suppressed) return c.json({ id: null, status: "suppressed" }, 200);

  // Verify domain ownership
  await verifyDomainOwnership(body.from, c.get("tenantId"));

  // Enqueue for delivery
  const message = await createMessage(body, c.get("tenantId"));
  await sendQueue.add("send", { messageId: message.id });

  return c.json({ id: message.id, status: "queued" }, 202);
});`} />

      <h2>Aggressive timeouts everywhere</h2>
      <p>
        Every external call has a timeout. SMTP injection gets 5 seconds. Postgres queries time out at 3 seconds.
        Redis operations at 1 second. Webhook deliveries get 10 seconds. If anything takes longer,
        we fail fast and retry through BullMQ's backoff strategy.
      </p>
      <CodeBlock language="ts" code={`// BullMQ worker with timeout + retries
const sendWorker = new Worker("send", async (job) => {
  const message = await db.query.messages.findFirst({
    where: eq(messages.id, job.data.messageId),
  });

  // Injects into our own MTA on the private network. The envelope
  // sender is VERP, so a bounce days later maps back to this message.
  await engine.deliver({
    from: message.from,
    envelopeFrom: verpSender(message),
    to: message.to,
    subject: message.subject,
    html: message.html,
    dkim: await signingKeyFor(message.domainId),
  });

  await updateMessageStatus(message.id, "sent");
}, {
  connection: redis,
  concurrency: 20,
  limiter: { max: 50, duration: 1000 },
});`} />

      <h2>Monitoring: Better Stack + Sentry EU</h2>
      <p>
        Better Stack pings the <code>/health</code> endpoint every 30 seconds from multiple EU locations.
        If it fails twice in a row, I get a push notification, an SMS, and a Slack message. The status
        page at postly.eu/status updates automatically.
      </p>
      <p>
        Sentry (EU region, hosted in Germany) captures unhandled exceptions. I configured it to never
        capture request bodies or email content - just stack traces, route names, and timing data. No
        PII in error tracking.
      </p>

      <h2>What actually causes downtime</h2>
      <p>
        In five months of operation, the three incidents we had were:
      </p>
      <ul>
        <li>A Neon Postgres maintenance window that took 90 seconds longer than advertised (12 minutes total downtime)</li>
        <li>A bad deploy where I forgot to run migrations first (4 minutes, caught by health check)</li>
        <li>A Redis memory spike from a customer sending 50k emails in a burst (8 minutes, fixed by adjusting <code>maxmemory-policy</code>)</li>
      </ul>
      <p>
        None of these lost a single email. BullMQ queued everything during the outage and drained
        the backlog within seconds of recovery. That's the advantage of async delivery - the
        queue is the buffer.
      </p>

      <h2>Why this works for one person</h2>
      <p>
        The reliability layer is the queue, not any one process. Every component is allowed to fail and
        be restarted; none of them is allowed to acknowledge a message it has not stored. That turns
        most outages into latency instead of loss, and latency does not need a pager at 3am.
      </p>
      <p>
        Boring infrastructure, no microservices, no Kubernetes, no multi-cloud. Postgres, Redis, the
        API, the workers and our MTA, deployed as one compose stack. I can hold the entire system in my
        head, and that's exactly the point.
      </p>
      <p>
        The honest caveat: running our own MTA means IP reputation is our problem, and it is a different
        kind of uptime. Mail that is accepted and then junked is not an outage on any status page, which
        is why per-tenant limits and automatic pauses shipped before our first customer did.
      </p>
    </>
  ),

  "we-deliver-the-mail-ourselves": (
    <>
      <p className="text-lg text-muted-foreground">
        The usual way to make transactional email GDPR-defensible is a transfer impact assessment: you
        send through a US provider's EU region, then write several pages explaining why FISA 702 is an
        acceptable residual risk. We wrote that document. Then we deleted the reason for it.
      </p>

      <h2>What the assessment was actually saying</h2>
      <p>
        Postly used to be a control plane in front of Amazon SES. Data stayed in EU regions, the DPF
        certification was in place, the standard contractual clauses were signed, and the content of
        every email still passed through infrastructure operated by a US-headquartered company. Under
        FISA 702 that company can, in principle, be compelled regardless of where the servers are.
      </p>
      <p>
        Every mitigation we could honestly claim was a reason the risk was small, not a reason it was
        absent. A reviewer who read carefully would see that, and the reviewers who read carefully are
        exactly the ones whose sign-off takes three months.
      </p>

      <h2>What we changed</h2>
      <p>
        Postly delivers its own mail now. Our mail transfer agents run in the EU, we generate an
        RSA-2048 DKIM key per customer domain and keep the private key encrypted at rest, we sign and
        inject every message ourselves, and asynchronous bounces and feedback reports come back to a
        return-path subdomain we operate. No other email provider touches the message.
      </p>

      <h2>What is still open, said out loud</h2>
      <p>
        Removing SES removed the largest transfer, not every question. Two decisions are still in front
        of us, and we would rather publish them than let you find them in the subprocessor list.
      </p>
      <p>
        Our Postgres is with Neon, a US company. Its EU region keeps the data in Europe, but the company
        is still subject to US law, and the database holds message content until delivery. And if the API
        sits behind Cloudflare's proxy, Cloudflare terminates TLS and sees the body of every send. Both
        have EU-native alternatives, both are being decided before launch, and we will say where they
        landed. Until then the honest claim is the narrow one: nobody but Postly accepts, signs, queues
        or delivers your mail.
      </p>

      <h2>Why this is the easier answer, not the braver one</h2>
      <p>
        A transfer impact assessment is a document you maintain forever. It has to be revisited when
        case law moves, when an adequacy decision is challenged, when your provider changes a
        subprocessor. Removing the transfer removes the document, the review cycle and the argument.
      </p>
      <p>
        There is a real cost, and it is not legal. Sending IP reputation is now ours: our addresses
        started with none, warm-up is weeks of gradually increasing real traffic, and one abusive sender
        can damage delivery for everyone on the shared pool. That is a deliverability problem we own,
        and we would rather own it than explain it away.
      </p>

      <h2>What to tell your reviewer</h2>
      <p>
        Personal data in email content and recipient addresses is processed and stored in the EU, and
        delivered from EU infrastructure operated by Postly AB. No email provider, and no third party of
        any kind, handles the delivery. For the subprocessors that support the product around it, the
        list at /legal/subprocessors names each one, its role and its jurisdiction, including the two
        open items above. The DPA is countersigned at signup and we notify 30 days before that list
        changes. Questions we have not answered here go to dpo@postly.eu.
      </p>
    </>
  ),

  "idempotency-30-day": (
    <>
      <p className="text-lg text-muted-foreground">
        Most APIs that claim idempotency support have a 24-hour key window and no protection against
        partial failures. Postly's implementation uses SHA-256 request-body hashing with a 30-day
        retention window, and it handles crashes, retries, and race conditions correctly.
      </p>

      <h2>The duplicate email problem</h2>
      <p>
        Transactional email has a unique failure mode: sending the same email twice is often worse
        than not sending it at all. A duplicate password reset is confusing. A duplicate invoice is
        alarming. A duplicate "your account has been deleted" is a support ticket waiting to happen.
      </p>
      <p>
        Duplicates happen when your application retries a request that actually succeeded but returned
        a network timeout. The HTTP request made it to the server, the email was queued, but the
        response never reached the client. Your retry logic sends it again. Now the recipient gets two
        emails.
      </p>

      <h2>How most APIs handle it</h2>
      <p>
        The standard approach is an <code>Idempotency-Key</code> header. The client generates a UUID,
        attaches it to the request, and the server stores the key with the response. If the same key
        arrives again, the server returns the stored response without re-processing.
      </p>
      <p>
        The problems with typical implementations:
      </p>
      <ul>
        <li>Key windows are 24 hours. If your retry happens after a deploy cycle (which can be days), the key has expired.</li>
        <li>Keys are stored in memory or Redis with TTL. A server restart wipes them.</li>
        <li>There's no protection against different request bodies with the same key (accidental key reuse).</li>
        <li>Race conditions between concurrent requests with the same key are often unhandled.</li>
      </ul>

      <h2>Postly's approach: body hashing + Postgres</h2>
      <p>
        When a request arrives with an <code>Idempotency-Key</code> header, Postly computes a SHA-256
        hash of the canonical request body and stores it alongside the key in Postgres.
      </p>
      <CodeBlock language="ts" code={`import { createHash } from "node:crypto";

function computeBodyHash(body: unknown): string {
  const canonical = JSON.stringify(body, Object.keys(body as object).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

async function checkIdempotency(
  key: string,
  bodyHash: string,
  tenantId: string,
) {
  const existing = await db.query.idempotencyKeys.findFirst({
    where: and(
      eq(idempotencyKeys.key, key),
      eq(idempotencyKeys.tenantId, tenantId),
    ),
  });

  if (!existing) return null;

  // Same key, different body = client error
  if (existing.bodyHash !== bodyHash) {
    throw new ApiError(422, "Idempotency key reused with different body");
  }

  return existing.response;
}`} />
      <p>
        The canonical serialization (sorted keys) ensures that <code>{`{"to":"a@b.com","subject":"hi"}`}</code> and
        <code>{`{"subject":"hi","to":"a@b.com"}`}</code> produce the same hash. This catches cases where JSON
        serialization order varies between retries.
      </p>

      <h2>The Postgres dedup table</h2>
      <p>
        The idempotency keys live in Postgres, not Redis. This is a deliberate choice: Postgres
        survives restarts, has proper transactional guarantees, and its storage cost at our scale
        is negligible.
      </p>
      <CodeBlock language="sql" code={`CREATE TABLE idempotency_keys (
  key         TEXT NOT NULL,
  tenant_id   TEXT NOT NULL,
  body_hash   TEXT NOT NULL,
  response    JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'processing',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days',
  PRIMARY KEY (tenant_id, key)
);

-- Cleanup job runs daily
CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at)
  WHERE expires_at < now();`} />
      <p>
        The 30-day retention means that even if your application retries a request weeks later (after
        a failed deploy, a stuck job queue, or a long outage recovery), the dedup still works. A daily
        cleanup job deletes expired rows.
      </p>

      <h2>Handling race conditions</h2>
      <p>
        What happens when two identical requests arrive at the same millisecond? The first request
        inserts the idempotency row with <code>status: 'processing'</code>. The second request sees
        the row exists but the response isn't ready yet. We handle this with a short poll:
      </p>
      <CodeBlock language="ts" code={`async function waitForIdempotencyResult(
  key: string,
  tenantId: string,
  maxWaitMs = 5000,
): Promise<IdempotencyRecord | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const record = await db.query.idempotencyKeys.findFirst({
      where: and(
        eq(idempotencyKeys.key, key),
        eq(idempotencyKeys.tenantId, tenantId),
      ),
    });
    if (record?.status === "completed") return record;
    if (record?.status === "failed") return null; // Let it retry
    await new Promise((r) => setTimeout(r, 100));
  }
  // Timed out waiting - treat as new request
  return null;
}`} />
      <p>
        If the first request fails (crashes, times out), the status stays at <code>'processing'</code>.
        A background job marks stale processing rows as <code>'failed'</code> after 60 seconds,
        allowing the next retry to proceed normally.
      </p>

      <h2>Edge cases we handle</h2>
      <ul>
        <li>
          <strong>Key reuse with different body:</strong> Returns 422 with an explicit error.
          This catches accidental UUID collisions or client bugs.
        </li>
        <li>
          <strong>Server crash mid-processing:</strong> The row exists with <code>status: 'processing'</code>.
          After 60 seconds, the cleanup job marks it failed. The next retry processes normally.
        </li>
        <li>
          <strong>No Idempotency-Key header:</strong> The request is processed normally without
          dedup. We don't force idempotency on every request - it's opt-in.
        </li>
        <li>
          <strong>Tenant isolation:</strong> Keys are scoped by <code>tenant_id</code>. Two different
          tenants using the same key value will each get their own independent processing.
        </li>
      </ul>

      <h2>Why 30 days</h2>
      <p>
        Most providers use 24 hours. We picked 30 days because real-world retry scenarios don't
        respect short windows. A customer's background job crashes on Friday, the on-call engineer
        fixes it Monday, the job retries Tuesday - that's 4 days. With a 24-hour window, that retry
        sends a duplicate. With 30 days, it returns the cached response. The storage cost of keeping
        keys for 30 days is trivial: each row is roughly 500 bytes. A million idempotency keys is
        about 500MB.
      </p>
    </>
  ),

  "migrating-from-resend": (
    <>
      <p className="text-lg text-muted-foreground">
        If you're switching from Resend to Postly, the CLI migration tool handles domains, API keys,
        and templates in a single command. Here's what to expect.
      </p>

      <h2>What migrates</h2>
      <ul>
        <li><strong>Domains:</strong> DNS records are imported and re-verified against Postly's DKIM configuration. You will need to update your DNS records since Postly uses different DKIM selectors.</li>
        <li><strong>API keys:</strong> New Postly API keys are generated to match your Resend key names and scopes. The actual key values change (they must - we can't import hashed secrets).</li>
        <li><strong>Templates:</strong> HTML and React Email templates are imported with their current active version. Version history is not migrated.</li>
      </ul>
      <p>
        What does not migrate: message history, suppression lists, webhook endpoints, or analytics data.
        Suppression lists can be exported from Resend and imported separately via the API.
      </p>

      <h2>Step 1: Install the CLI</h2>
      <CodeBlock language="bash" code={`npm install -g @postly/cli

# Verify installation
postly --version`} />

      <h2>Step 2: Authenticate</h2>
      <CodeBlock language="bash" code={`# Log in to your Postly account
postly auth login

# Or set an API key directly
export POSTLY_API_KEY=pst_live_your_key_here`} />

      <h2>Step 3: Run the migration</h2>
      <p>
        The migration command reads from the Resend API using your Resend API key and creates
        the corresponding resources in Postly.
      </p>
      <CodeBlock language="bash" code={`postly migrate --from resend

# You'll be prompted for your Resend API key:
# ? Resend API key: re_xxxxxxxxxxxx
#
# Output:
# Fetching domains from Resend...
#   ✓ bokflow.se - imported (DKIM pending)
#   ✓ tallvik.example - imported (DKIM pending)
# Fetching templates from Resend...
#   ✓ welcome-email (React) - imported
#   ✓ password-reset (HTML) - imported
#   ✓ invoice-receipt (HTML) - imported
# Creating API keys...
#   ✓ "Production" - pst_live_a1b2...
#   ✓ "Staging" - pst_test_q9w8...
#
# Migration complete. 2 domains, 3 templates, 2 API keys.
# Next: update DNS records for DKIM verification.`} />

      <h2>Step 4: Update DNS records</h2>
      <p>
        After migration, run <code>postly domains</code> to see the required DNS records. Postly
        uses three CNAME records for DKIM (similar to Resend, but different selector names).
        Update your DNS provider and verify:
      </p>
      <CodeBlock language="bash" code={`# Check domain verification status
postly domains

# Trigger re-verification after DNS update
postly domain:verify bokflow.se`} />

      <h2>Step 5: Swap the SDK</h2>
      <p>
        The Postly Node SDK is designed to be a close match to Resend's API shape. Most send calls
        require minimal changes.
      </p>
      <p>
        <strong>Before (Resend):</strong>
      </p>
      <CodeBlock language="ts" code={`import { Resend } from "resend";
const resend = new Resend("re_xxxxxxxxxxxx");

await resend.emails.send({
  from: "noreply@bokflow.se",
  to: "anna@example.com",
  subject: "Your invoice is ready",
  html: "<p>Invoice #1234 is attached.</p>",
});`} />
      <p>
        <strong>After (Postly):</strong>
      </p>
      <CodeBlock language="ts" code={`import { Postly } from "@postly/node";
const postly = new Postly("pst_live_a1b2c3d4");

await postly.emails.send({
  from: "noreply@bokflow.se",
  to: "anna@example.com",
  subject: "Your invoice is ready",
  html: "<p>Invoice #1234 is attached.</p>",
});`} />
      <p>
        The request shape is identical. The main differences:
      </p>
      <ul>
        <li>Import <code>Postly</code> from <code>@postly/node</code> instead of <code>Resend</code> from <code>resend</code></li>
        <li>API keys start with <code>pst_live_</code> or <code>pst_test_</code></li>
        <li>The response includes an <code>idempotencyKey</code> field if you sent one</li>
        <li>API base URL is <code>https://api.postly.eu/v1/</code> (EU-hosted)</li>
      </ul>

      <h2>After migration</h2>
      <p>
        Keep both services running in parallel for a day or two. Send a few test emails through
        Postly to verify deliverability and DNS propagation. Once you're confident, remove the
        Resend SDK and API keys from your codebase. The whole process should take about five
        minutes of active work, plus DNS propagation time.
      </p>
    </>
  ),

  "why-no-open-tracking": (
    <>
      <p className="text-lg text-muted-foreground">
        Postly does not track opens or clicks. No pixel in your HTML, no rewritten links, no
        email.opened event to subscribe to. This is a deliberate omission, and this is the reasoning.
      </p>

      <h2>Open rates stopped meaning anything</h2>
      <p>
        An open is a request for a 1x1 image. Apple Mail Privacy Protection fetches that image from a
        proxy whether or not a human looked at the message, and it is the default for a large share of
        consumer mail. Other clients block remote images entirely. The number you get back is a mix of
        machines and people in a ratio you cannot see, and it is not comparable between audiences or
        over time.
      </p>
      <p>
        For transactional email the metric was never the point anyway. You do not need to know whether
        someone opened their password reset. You need to know it was accepted by their mail server, and
        that is a delivery event, not a tracking event.
      </p>

      <h2>Click tracking costs deliverability</h2>
      <p>
        Rewriting links means every URL in your receipt points at a shared tracking domain instead of
        your own. Shared redirect domains are exactly what phishing uses, so they get scanned,
        rate-limited and sometimes blocklisted. The reputation of that domain is shared with every other
        sender on it, and none of them are your problem until they are.
      </p>

      <h2>And it is personal data</h2>
      <p>
        A tracking pixel reads an IP address and a user agent, and it does it without the recipient
        asking. Under ePrivacy that is a consent question, which means a lawful basis, a record of that
        basis, and a retention policy, for a number you established above is not reliable. Not
        collecting it removes all of that.
      </p>

      <h2>What you get instead</h2>
      <p>
        Every message carries its own delivery story: queued, sent, delivered, bounced, complained or
        failed, with the receiving server's SMTP response attached. Hard and soft bounces are told
        apart, complaints are suppressed automatically, and both feed the reputation checks that pause
        sending before a mailbox provider does it for you.
      </p>
      <CodeBlock language="json" code={`{
  "type": "email.bounced",
  "message_id": "msg_01HX8L4N0Q3R5S7T9V",
  "bounce": {
    "kind": "hard",
    "smtp_code": "550",
    "smtp_response": "5.1.1 The email account does not exist"
  },
  "suppressed": true
}`} />
      <p>
        If you genuinely need engagement data, it belongs in your product, where the click lands on a
        URL you control and the event is attached to a user you already have a lawful basis for. That is
        a better signal than a proxy fetching an image, and it does not put your links behind somebody
        else's reputation.
      </p>
    </>
  ),
};

function BlogPost() {
  const { slug } = useParams({ from: "/blog/$slug" });
  const post = BLOG_POSTS.find((p) => p.slug === slug) ?? BLOG_POSTS[0];
  const content = BLOG_CONTENT[slug];

  return (
      <article className="mx-auto max-w-3xl px-6 py-16">
        <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">← All posts</Link>
        <Badge variant="secondary" className="mt-6 text-[10px] uppercase tracking-wider">{post.category}</Badge>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{post.title}</h1>
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-xs text-primary">{post.author.split(" ").map(s => s[0]).join("")}</AvatarFallback></Avatar>
          <div>{post.author}</div>
          <span>·</span>
          <span>{post.date}</span>
          <span>·</span>
          <span>{post.readTime}</span>
        </div>
        <div className="mt-10 aspect-[16/8] rounded-xl bg-gradient-to-br from-teal-500/30 to-emerald-500/10" />
        <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
          {content ?? (
            <>
              <p className="text-lg text-muted-foreground">{post.excerpt}</p>
              <p>This post walks through the engineering decisions, trade-offs, and pricing math behind the topic. We try to be honest about what worked and what didn't.</p>
              <h2>Context</h2>
              <p>Most transactional email vendors are priced as if you'll forget to look at your bill. We don't. This piece explains what we did instead.</p>
              <h2>How we approached it</h2>
              <p>Boring infrastructure, aggressive timeouts, and a willingness to delete features that didn't earn their keep.</p>
              <h2>What we learned</h2>
              <p>The interesting work is in observability and bounce handling, not the send loop itself.</p>
              <h2>What's next</h2>
              <p>More posts like this. Subscribe to the changelog feed if you want fewer surprises.</p>
            </>
          )}
        </div>
      </article>
  );
}
