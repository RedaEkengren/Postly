import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { ApiError, problemResponse, validationError } from '../lib/errors.js';

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return problemResponse(c, err);
  }

  // c.req.json() throws a SyntaxError on a body that is not JSON. That is the
  // client's error, not ours.
  if (err instanceof SyntaxError) {
    return problemResponse(c, validationError('Request body is not valid JSON'));
  }

  // Hono's request validators reject a malformed body with an HTTPException.
  if (err instanceof HTTPException && err.status < 500) {
    return problemResponse(c, new ApiError(err.status, 'validation_error', 'Validation error', err.message));
  }

  if (err instanceof ZodError) {
    const detail = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return problemResponse(c, validationError(detail));
  }

  console.error('Unhandled error:', err);
  return c.json(
    {
      type: 'https://docs.postly.eu/errors/internal_error',
      title: 'Internal server error',
      status: 500,
      detail: 'An unexpected error occurred',
    },
    500,
  );
}
