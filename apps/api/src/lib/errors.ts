import type { Context } from 'hono';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly type: string,
    public readonly title: string,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

export function problemResponse(c: Context, error: ApiError) {
  return c.json(
    {
      type: `https://docs.postly.eu/errors/${error.type}`,
      title: error.title,
      status: error.status,
      detail: error.detail,
      instance: c.req.header('x-request-id') ?? crypto.randomUUID(),
    },
    error.status as 400,
  );
}

export function validationError(detail: string) {
  return new ApiError(400, 'validation_error', 'Validation error', detail);
}

export function unauthorizedError() {
  return new ApiError(401, 'unauthorized', 'Unauthorized', 'Invalid or missing API key');
}

export function forbiddenError(scope: string) {
  return new ApiError(403, 'forbidden', 'Forbidden', `API key lacks required scope: ${scope}`);
}

export function notFoundError(resource: string) {
  return new ApiError(404, 'not_found', 'Not found', `${resource} does not exist`);
}

export function idempotencyConflictError() {
  return new ApiError(
    409,
    'idempotency_conflict',
    'Idempotency conflict',
    'Idempotency key reused with different request body',
  );
}

export function recipientSuppressedError(address: string) {
  return new ApiError(
    400,
    'recipient_suppressed',
    'Recipient suppressed',
    `Recipient ${address.slice(0, 3)}***@${address.split('@')[1]} is on the suppression list`,
  );
}

export function domainNotVerifiedError(domain: string) {
  return new ApiError(
    400,
    'domain_not_verified',
    'Domain not verified',
    `The sending domain '${domain}' has not completed DKIM verification`,
  );
}

export function quotaExceededError() {
  return new ApiError(
    422,
    'quota_exceeded',
    'Quota exceeded',
    'Plan quota exceeded or insufficient credits',
  );
}
