import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  // KumoMTA's injection listener on the private network (ADR-020).
  KUMO_SMTP_HOST: z.string().default('localhost'),
  KUMO_SMTP_PORT: z.coerce.number().default(2525),
  // KumoMTA's admin API, to suspend a paused tenant's queued mail.
  KUMO_HTTP_URL: z.url().default('http://127.0.0.1:8000'),
  // Postly's own DNS, used when checking customers' domains (see apps/api/src/env.ts).
  POSTLY_SPF_INCLUDE: z.string().default('_spf.postly.eu'),
  POSTLY_BOUNCE_MX: z.string().default('mx.postly.eu'),
  POSTLY_DMARC_REPORTS: z.string().default('dmarc@postly.eu'),
});

export const env = envSchema.parse(process.env);
