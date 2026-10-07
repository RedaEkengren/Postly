import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { BLOG_POSTS } from "@/lib/mock-data";

export const Route = createFileRoute("/blog/")({
  head: () => ({ meta: [{ title: "Blog - Postly" }] }),
  component: BlogIndex,
});

const GRADIENTS = [
  "from-teal-500/30 to-emerald-500/20",
  "from-amber-500/30 to-rose-500/20",
  "from-blue-500/30 to-violet-500/20",
  "from-emerald-500/30 to-cyan-500/20",
  "from-rose-500/30 to-orange-500/20",
  "from-violet-500/30 to-blue-500/20",
];

function BlogIndex() {
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">From the Postly team.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Notes on transactional email, EU infrastructure, and the unglamorous parts of bootstrapping a developer tool.
          </p>
        </div>
      </section>
      <section>
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {BLOG_POSTS.map((p, i) => (
              <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
                <div className={`aspect-[16/9] bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`} />
                <div className="flex flex-1 flex-col p-6">
                  <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wider">{p.category}</Badge>
                  <h3 className="mt-3 text-lg font-semibold leading-snug group-hover:text-primary">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>
                  <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{p.author}</span>
                    <span>·</span>
                    <span>{p.date}</span>
                    <span>·</span>
                    <span>{p.readTime}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
