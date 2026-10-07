import { createRoute, z } from '@hono/zod-openapi';
import { eq, tenants } from '@postly/db';
import { authMiddleware, requireScope } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';
import { notFoundError } from '../lib/errors.js';
import { createRouter, errors, json, security, Timestamp } from '../openapi/common.js';

const Account = z
  .object({
    id: z.string(),
    name: z.string(),
    plan: z.string().openapi({ example: 'payg' }),
    status: z.string().openapi({ example: 'active' }),
    credit_balance: z.number().int(),
    created_at: Timestamp,
  })
  .openapi('Account');

const accountRoutes = createRouter();

accountRoutes.use('*', authMiddleware);

accountRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    operationId: 'getAccount',
    tags: ['Account'],
    summary: 'Get the account the API key belongs to',
    security,
    middleware: [requireScope('account.read')] as const,
    responses: { 200: json(Account, 'The account'), ...errors(401, 403, 404) },
  }),
  async (c) => {
    const auth = c.get('auth');
    const [tenant] = await getDb().select().from(tenants).where(eq(tenants.id, auth.tenantId));
    if (!tenant) throw notFoundError('Tenant');

    return c.json(
      {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
        credit_balance: tenant.creditBalance,
        created_at: tenant.createdAt.toISOString(),
      },
      200,
    );
  },
);

export { accountRoutes };
