import { OpenAPIHono } from '@hono/zod-openapi';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { emailRoutes } from './routes/emails.js';
import { domainRoutes } from './routes/domains.js';
import { suppressionRoutes } from './routes/suppressions.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { webhookRoutes } from './routes/webhooks.js';
import { templateRoutes } from './routes/templates.js';
import { accountRoutes } from './routes/account.js';
import { devEventRoutes } from './routes/dev-events.js';
import { authRoutes } from './routes/auth.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { internalRoutes } from './routes/internal.js';
import { errorHandler } from './middleware/error-handler.js';
import { env } from './env.js';
import { buildHealthReport } from './lib/health.js';
import { gatherHealthInput } from './lib/health-check.js';

const app = new OpenAPIHono();

/** What the spec says about itself. Shared with the snapshot test so both describe the same document. */
export const OPENAPI_CONFIG = {
  openapi: '3.1.0',
  info: {
    title: 'Postly API',
    version: '1.0.0',
    license: { name: 'Proprietary', identifier: 'LicenseRef-Proprietary' },
    description:
      'Transactional email from EU infrastructure. Every list pages with `limit` and `cursor`; errors are RFC 7807 problem details.',
  },
  servers: [{ url: 'https://api.postly.eu' }],
};

app.use('*', logger());
app.use('*', cors({
  origin: env.DASHBOARD_URL,
  credentials: true,
}));
app.use('*', secureHeaders());

app.onError(errorHandler);

app.get('/health', async (c) => {
  const report = buildHealthReport(await gatherHealthInput(), Date.now());
  return c.json(report, report.status === 'unhealthy' ? 503 : 200);
});

app.get('/v1', (c) => {
  return c.json({
    name: 'Postly API',
    version: '0.0.1',
    docs: 'https://docs.postly.eu',
  });
});

app.route('/v1/emails', emailRoutes);
app.route('/v1/domains', domainRoutes);
app.route('/v1/suppressions', suppressionRoutes);
app.route('/v1/api-keys', apiKeyRoutes);
app.route('/v1/webhooks', webhookRoutes);
app.route('/v1/templates', templateRoutes);
app.route('/v1/account', accountRoutes);

app.route('/auth', authRoutes);
app.route('/dashboard', dashboardRoutes);
app.route('/internal', internalRoutes);

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'An API key: `pst_live_…` or `pst_test_…`',
});
app.doc31('/v1/openapi.json', OPENAPI_CONFIG);

if (env.NODE_ENV === 'development') {
  app.route('/dev', devEventRoutes);
}

export { app };
