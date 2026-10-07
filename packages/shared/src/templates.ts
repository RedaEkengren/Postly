import Handlebars from 'handlebars';
import { convert } from 'html-to-text';

/**
 * Variable substitution for templates (PRD §6.4: Handlebars-compatible).
 * An isolated instance, so no helper registered elsewhere leaks in.
 */
const handlebars = Handlebars.create();

export type RenderInput = { subject: string; html: string };
export type Rendered = { subject: string; html: string; text: string };

const cache = new Map<string, HandlebarsTemplateDelegate>();
const CACHE_LIMIT = 500;

function compiled(source: string, escapeHtml: boolean): HandlebarsTemplateDelegate {
  const key = `${escapeHtml ? 'h' : 's'}:${source}`;
  let template = cache.get(key);
  if (!template) {
    // strict: false leaves an unknown variable empty; vars_schema is what
    // makes a variable required.
    template = handlebars.compile(source, { noEscape: !escapeHtml, strict: false });
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, template);
  }
  return template;
}

/**
 * Subject and HTML with the variables filled in, plus a plain-text part
 * derived from the HTML: multipart/alternative is what mailbox providers
 * expect, and templates are authored as HTML only.
 * Values are HTML-escaped in the body but not in the subject, which is plain
 * text; `{{{triple}}}` opts out of escaping in the body.
 */
export function renderTemplate(input: RenderInput, variables: Record<string, unknown> = {}): Rendered {
  const html = compiled(input.html, true)(variables);
  return {
    subject: compiled(input.subject, false)(variables).replace(/[\r\n]+/g, ' ').trim(),
    html,
    text: convert(html, { wordwrap: 78, selectors: [{ selector: 'img', format: 'skip' }] }),
  };
}

/** Throws with Handlebars' own message when a source does not parse. */
export function assertTemplateParses(source: string) {
  handlebars.precompile(source);
}
