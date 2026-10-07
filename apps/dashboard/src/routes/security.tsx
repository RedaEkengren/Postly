import { createFileRoute } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { ShieldCheck, Lock, Database, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [{ title: "Security - Postly" }] }),
  component: Security,
});

const PGP = `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQINBGY1z8ABEADr5jR3xV3oqQzKkXAFpQfg2lU6sQRkY8C8m6oXuVz5wq9HhYK0
... (truncated for the prototype) ...
=8XyZ
-----END PGP PUBLIC KEY BLOCK-----`;

function Security() {
  return (
    <MarketingLayout>
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Security & infrastructure</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            How we keep your data and your customers' data safe.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            ISO 27001 in progress · target 2027
          </span>
        </div>
      </section>
      <section>
        <div className="mx-auto max-w-4xl px-6 py-16 space-y-14">
          {[
            { icon: Lock, title: "Encryption", body: "TLS 1.3 in transit. AES-256 at rest. Per-tenant key derivation for sensitive fields." },
            { icon: Database, title: "Access controls", body: "Role-based access internally. Production database access requires hardware key + JIT approval. Audit log is append-only." },
            { icon: ShieldCheck, title: "Retention", body: "Message bodies retained 30 days for idempotency. Metadata 18 months. You can opt to redact bodies on send." },
            { icon: AlertTriangle, title: "Incident response", body: "On-call rotation. SLA: notification within 24h of any confirmed incident affecting customer data." },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title}>
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-semibold">{s.title}</h2>
                </div>
                <p className="mt-3 text-muted-foreground">{s.body}</p>
              </div>
            );
          })}
          <div>
            <h2 className="text-2xl font-semibold">Vulnerability disclosure</h2>
            <p className="mt-3 text-muted-foreground">Report to security@postly.eu. We aim to acknowledge within 24h and remediate within 30 days. Safe harbor for good-faith research.</p>
            <pre className="code-block mt-4 text-xs">{PGP}</pre>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
