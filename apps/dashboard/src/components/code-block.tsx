import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { codeToHtml } from "shiki";

const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  php: "php",
  bash: "bash",
  sh: "bash",
  curl: "bash",
  json: "json",
};

export function CodeBlock({ code, language = "ts", className }: { code: string; language?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const [html, setHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: LANG_MAP[language] ?? language,
      theme: "github-dark-default",
    }).then((result) => {
      if (!cancelled) setHtml(result);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [code, language]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the button just skips the confirmation.
    }
  };

  return (
    <div className={cn("relative group rounded-lg", className)}>
      {html ? (
        <div className="code-block overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!p-4 [&_pre]:!m-0 [&_code]:!text-[12px] [&_code]:!leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="code-block overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
      <button
        onClick={copy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-white/70 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
