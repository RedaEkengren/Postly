import mjml2html from 'mjml';
import { Ajv, type ValidateFunction } from 'ajv';
import { and, desc, eq, max, templates, templateVersions } from '@postly/db';
import { assertTemplateParses, renderTemplate, type Rendered } from '@postly/shared';
import { getDb } from './db.js';
import { ApiError, notFoundError } from './errors.js';

type Version = typeof templateVersions.$inferSelect;

export function invalidTemplateError(detail: string) {
  return new ApiError(400, 'invalid_template', 'Invalid template', detail);
}

/**
 * The HTML a version renders from. MJML is compiled here, once; HTML and
 * pre-compiled React Email output are used as given. Every format must also
 * parse as a Handlebars template.
 */
export async function compileSource(format: string, source: string): Promise<string> {
  let html = source;
  if (format === 'mjml') {
    try {
      html = (await mjml2html(source, { validationLevel: 'strict', minify: false })).html;
    } catch (err) {
      // mjml's formattedMessage names a file path on this server; the bare
      // message and line do not.
      const issues = (err as { errors?: { message: string; line?: number }[] }).errors;
      const detail = issues?.map((d) => (d.line ? `line ${d.line}: ${d.message}` : d.message)).join('; ');
      throw invalidTemplateError(detail || 'MJML could not be compiled');
    }
  }
  try {
    assertTemplateParses(html);
  } catch (err) {
    throw invalidTemplateError((err as Error).message.split('\n')[0]!);
  }
  return html;
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map<string, ValidateFunction>();

/** A vars_schema must itself be a valid JSON Schema, checked when the version is created. */
export function assertValidVarsSchema(schema: Record<string, unknown> | undefined) {
  if (!schema) return;
  try {
    ajv.compile(schema);
  } catch (err) {
    throw invalidTemplateError(`vars_schema is not a valid JSON Schema: ${(err as Error).message}`);
  }
}

export function assertVariablesMatch(version: Version, variables: Record<string, unknown>) {
  if (!version.varsSchema) return;
  let validate = validators.get(version.id);
  if (!validate) {
    validate = ajv.compile(version.varsSchema as object);
    validators.set(version.id, validate);
  }
  if (!validate(variables)) {
    const detail = (validate.errors ?? [])
      .map((e) => `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`)
      .join('; ');
    throw new ApiError(422, 'template_variables_invalid', 'Template variables invalid', detail);
  }
}

/** The requested version of a tenant's template; `null` means the current one. */
export async function resolveVersion(tenantId: string, slug: string, version: number | null | undefined) {
  const db = getDb();
  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.tenantId, tenantId), eq(templates.slug, slug)));
  if (!template) throw notFoundError(`Template '${slug}'`);

  const [row] = await db
    .select()
    .from(templateVersions)
    .where(
      and(
        eq(templateVersions.templateId, template.id),
        version != null
          ? eq(templateVersions.version, version)
          : template.currentVersionId
            ? eq(templateVersions.id, template.currentVersionId)
            : undefined,
      ),
    )
    .orderBy(desc(templateVersions.version))
    .limit(1);
  if (!row) throw notFoundError(`Version ${version ?? 'current'} of template '${slug}'`);
  return row;
}

/** Validates the variables and renders the version, compiling it first if it predates compiled_html. */
export async function renderVersion(version: Version, variables: Record<string, unknown> = {}): Promise<Rendered> {
  assertVariablesMatch(version, variables);
  let html = version.compiledHtml;
  if (html === null) {
    html = await compileSource(version.format, version.source);
    await getDb().update(templateVersions).set({ compiledHtml: html }).where(eq(templateVersions.id, version.id));
  }
  return renderTemplate({ subject: version.subject, html }, variables);
}

type VersionInput = { format: string; source: string; subject: string; vars_schema?: Record<string, unknown> };

/** Everything that can be wrong with a new version is found before anything is written. */
export async function prepareVersion(input: VersionInput) {
  assertValidVarsSchema(input.vars_schema);
  try {
    assertTemplateParses(input.subject);
  } catch (err) {
    throw invalidTemplateError(`subject: ${(err as Error).message.split('\n')[0]}`);
  }
  return compileSource(input.format, input.source);
}

/** Creates the template and version 1, or returns null if the slug is taken. */
export async function createTemplate(tenantId: string, input: VersionInput & { slug: string }) {
  const compiledHtml = await prepareVersion(input);
  return getDb().transaction(async (tx) => {
    // The unique (tenant, slug) index decides a race between two creates.
    const [template] = await tx.insert(templates).values({ tenantId, slug: input.slug }).onConflictDoNothing().returning();
    if (!template) return null;
    const [version] = await tx
      .insert(templateVersions)
      .values({
        templateId: template.id,
        version: 1,
        format: input.format,
        source: input.source,
        compiledHtml,
        subject: input.subject,
        varsSchema: input.vars_schema ?? null,
      })
      .returning();
    await tx.update(templates).set({ currentVersionId: version!.id }).where(eq(templates.id, template.id));
    return { template, version: version! };
  });
}

/** Adds the next version and makes it current, or returns null if the template does not exist. */
export async function addVersion(tenantId: string, slug: string, input: VersionInput) {
  const compiledHtml = await prepareVersion(input);
  return getDb().transaction(async (tx) => {
    // Locking the template row serialises concurrent new versions, so they
    // get consecutive numbers instead of colliding on the unique index.
    const [template] = await tx
      .select()
      .from(templates)
      .where(and(eq(templates.tenantId, tenantId), eq(templates.slug, slug)))
      .for('update');
    if (!template) return null;
    const [maxRow] = await tx
      .select({ maxVer: max(templateVersions.version) })
      .from(templateVersions)
      .where(eq(templateVersions.templateId, template.id));
    const [version] = await tx
      .insert(templateVersions)
      .values({
        templateId: template.id,
        version: (maxRow?.maxVer ?? 0) + 1,
        format: input.format,
        source: input.source,
        compiledHtml,
        subject: input.subject,
        varsSchema: input.vars_schema ?? null,
      })
      .returning();
    await tx.update(templates).set({ currentVersionId: version!.id }).where(eq(templates.id, template.id));
    return version!;
  });
}
