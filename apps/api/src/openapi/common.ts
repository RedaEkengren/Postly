import { OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '../middleware/auth.js';

/**
 * A router whose request validation failures go through the error handler, so
 * they come back as the same RFC 7807 problem as every other 400.
 */
export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) throw result.error;
    },
  });
}

export const security = [{ bearerAuth: [] }];

export const Problem = z
  .object({
    type: z.string().openapi({ example: 'https://docs.postly.eu/errors/validation_error' }),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string().optional(),
  })
  .openapi('Problem');

const ERROR_DESCRIPTIONS = {
  400: 'Invalid request',
  401: 'Missing or invalid API key',
  403: 'API key lacks the required scope',
  404: 'Not found',
  409: 'Conflict',
  422: 'Template variables do not match the template\'s vars_schema',
} as const;

type ErrorStatus = keyof typeof ERROR_DESCRIPTIONS;

export function errors(...statuses: ErrorStatus[]) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      { description: ERROR_DESCRIPTIONS[status], content: { 'application/problem+json': { schema: Problem } } },
    ]),
  ) as Record<ErrorStatus, { description: string; content: { 'application/problem+json': { schema: typeof Problem } } }>;
}

export function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

export function jsonBody<T extends z.ZodType>(schema: T) {
  return { body: { content: { 'application/json': { schema } }, required: true } };
}

export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 25 }),
  cursor: z.string().optional().openapi({ description: '`next_cursor` from the previous page' }),
});

export function page<T extends z.ZodType>(item: T, name: string) {
  return z
    .object({
      data: z.array(item),
      next_cursor: z.string().nullable().openapi({ description: 'Pass as `cursor` for the next page; null on the last page' }),
    })
    .openapi(name);
}

export const IdempotencyHeaders = z.object({
  'idempotency-key': z
    .string()
    .optional()
    .openapi({ description: 'Makes the request safe to retry; the same key and body return the same response for 30 days' }),
});

export const Timestamp = z.string().openapi({ format: 'date-time', example: '2026-09-19T12:00:00.000Z' });
