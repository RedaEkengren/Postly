import { createRoute, z } from '@hono/zod-openapi';
import { eq, and, desc, templates, templateVersions } from '@postly/db';
import { createTemplateSchema } from '@postly/shared';
import { authMiddleware, requireScope } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';
import { cursorTimestamp, olderThan, parsePage, toPage } from '../lib/pagination.js';
import { ApiError, notFoundError } from '../lib/errors.js';
import { addVersion, createTemplate, renderVersion, resolveVersion } from '../lib/templates.js';
import { createRouter, errors, json, jsonBody, page, PageQuery, security, Timestamp } from '../openapi/common.js';

const TemplateSummary = z
  .object({ id: z.string(), slug: z.string(), created_at: Timestamp })
  .openapi('TemplateSummary');

const TemplateVersion = z
  .object({
    id: z.string(),
    version: z.number().int(),
    format: z.string().openapi({ example: 'mjml' }),
    source: z.string(),
    subject: z.string(),
    vars_schema: z.record(z.string(), z.unknown()).nullable(),
    created_at: Timestamp,
  })
  .openapi('TemplateVersion');

const Template = TemplateSummary.extend({ current_version: TemplateVersion.nullable() }).openapi('Template');

const CreatedTemplate = z
  .object({
    id: z.string(),
    slug: z.string(),
    current_version: z.number().int(),
    format: z.string(),
    subject: z.string(),
    created_at: Timestamp,
  })
  .openapi('CreatedTemplate');

const CreatedVersion = z
  .object({
    id: z.string(),
    template_id: z.string(),
    version: z.number().int(),
    format: z.string(),
    subject: z.string(),
    created_at: Timestamp,
  })
  .openapi('CreatedTemplateVersion');

const SlugParam = z.object({ slug: z.string() });

const PreviewRequest = z
  .object({
    variables: z.record(z.string(), z.unknown()).optional(),
    version: z.number().int().positive().nullable().optional().openapi({ description: 'Omit or null for the current version' }),
  })
  .openapi('TemplatePreviewRequest');

const Preview = z
  .object({ subject: z.string(), html: z.string(), text: z.string() })
  .openapi('TemplatePreview');

async function findTemplate(tenantId: string, slug: string) {
  const [template] = await getDb()
    .select()
    .from(templates)
    .where(and(eq(templates.tenantId, tenantId), eq(templates.slug, slug)));
  if (!template) throw notFoundError('Template');
  return template;
}

const templateRoutes = createRouter();

templateRoutes.use('*', authMiddleware);

templateRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    operationId: 'createTemplate',
    tags: ['Templates'],
    summary: 'Create a template with its first version',
    security,
    middleware: [requireScope('templates.write')] as const,
    request: jsonBody(createTemplateSchema),
    responses: { 201: json(CreatedTemplate, 'Created'), ...errors(400, 401, 403, 409) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const created = await createTemplate(auth.tenantId, input);
    if (!created) {
      throw new ApiError(409, 'conflict', 'Template slug already exists', `Slug "${input.slug}" is taken`);
    }

    return c.json(
      {
        id: created.template.id,
        slug: created.template.slug,
        current_version: 1,
        format: input.format,
        subject: input.subject,
        created_at: created.template.createdAt.toISOString(),
      },
      201,
    );
  },
);

templateRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    operationId: 'listTemplates',
    tags: ['Templates'],
    summary: 'List templates',
    security,
    middleware: [requireScope('templates.read')] as const,
    request: { query: PageQuery },
    responses: {
      200: json(page(TemplateSummary, 'TemplatePage'), 'A page of templates, newest first'),
      ...errors(400, 401, 403),
    },
  }),
  async (c) => {
    const auth = c.get('auth');
    const { limit, cursor } = parsePage(c.req.query());

    const rows = await getDb()
      .select({ template: templates, cursorTs: cursorTimestamp(templates.createdAt) })
      .from(templates)
      .where(
        and(
          eq(templates.tenantId, auth.tenantId),
          cursor ? olderThan(templates.createdAt, templates.id, cursor, 'uuid') : undefined,
        ),
      )
      .orderBy(desc(templates.createdAt), desc(templates.id))
      .limit(limit + 1);

    const result = toPage(rows, limit, (r) => ({ t: r.cursorTs, k: r.template.id }));
    return c.json(
      {
        data: result.data.map(({ template: t }) => ({ id: t.id, slug: t.slug, created_at: t.createdAt.toISOString() })),
        next_cursor: result.next_cursor,
      },
      200,
    );
  },
);

templateRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{slug}',
    operationId: 'getTemplate',
    tags: ['Templates'],
    summary: 'Get a template and its current version',
    security,
    middleware: [requireScope('templates.read')] as const,
    request: { params: SlugParam },
    responses: { 200: json(Template, 'The template'), ...errors(401, 403, 404) },
  }),
  async (c) => {
    const template = await findTemplate(c.get('auth').tenantId, c.req.valid('param').slug);
    const [version] = template.currentVersionId
      ? await getDb().select().from(templateVersions).where(eq(templateVersions.id, template.currentVersionId))
      : [];

    return c.json(
      {
        id: template.id,
        slug: template.slug,
        current_version: version
          ? {
              id: version.id,
              version: version.version,
              format: version.format,
              source: version.source,
              subject: version.subject,
              vars_schema: (version.varsSchema as Record<string, unknown> | null) ?? null,
              created_at: version.createdAt.toISOString(),
            }
          : null,
        created_at: template.createdAt.toISOString(),
      },
      200,
    );
  },
);

templateRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/{slug}/versions',
    operationId: 'createTemplateVersion',
    tags: ['Templates'],
    summary: 'Create a new immutable version and make it current',
    security,
    middleware: [requireScope('templates.write')] as const,
    request: { params: SlugParam, ...jsonBody(createTemplateSchema.omit({ slug: true })) },
    responses: { 201: json(CreatedVersion, 'Created'), ...errors(400, 401, 403, 404) },
  }),
  async (c) => {
    const input = c.req.valid('json');
    const { slug } = c.req.valid('param');
    const tenantId = c.get('auth').tenantId;
    const created = await addVersion(tenantId, slug, input);
    if (!created) throw notFoundError('Template');

    return c.json(
      {
        id: created.id,
        template_id: created.templateId,
        version: created.version,
        format: created.format,
        subject: created.subject,
        created_at: created.createdAt.toISOString(),
      },
      201,
    );
  },
);

templateRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/{slug}/preview',
    operationId: 'previewTemplate',
    tags: ['Templates'],
    summary: 'Render a template without sending',
    description: 'Renders exactly as a send would, including `vars_schema` validation.',
    security,
    middleware: [requireScope('templates.read')] as const,
    request: { params: SlugParam, ...jsonBody(PreviewRequest) },
    responses: { 200: json(Preview, 'The rendered email'), ...errors(400, 401, 403, 404, 422) },
  }),
  async (c) => {
    const { variables, version } = c.req.valid('json');
    const resolved = await resolveVersion(c.get('auth').tenantId, c.req.valid('param').slug, version);
    return c.json(await renderVersion(resolved, variables ?? {}), 200);
  },
);

templateRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{slug}',
    operationId: 'deleteTemplate',
    tags: ['Templates'],
    summary: 'Delete a template and all its versions',
    security,
    middleware: [requireScope('templates.write')] as const,
    request: { params: SlugParam },
    responses: { 204: { description: 'Deleted' }, ...errors(401, 403, 404) },
  }),
  async (c) => {
    const template = await findTemplate(c.get('auth').tenantId, c.req.valid('param').slug);
    await getDb().delete(templates).where(eq(templates.id, template.id));
    return c.body(null, 204);
  },
);

export { templateRoutes };
