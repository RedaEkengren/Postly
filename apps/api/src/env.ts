import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  // No default: an unset NODE_ENV used to mount the /dev routes in production.
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  DASHBOARD_URL: z.url().default('http://localhost:5173'),
  // AES-256-GCM key for DKIM private keys at rest: 32 random bytes, base64.
  // Generate with `openssl rand -base64 32`. Losing it means re-keying every domain.
  DKIM_ENCRYPTION_KEY: z.string().min(40),
  // Shared secret for the internal endpoints KumoMTA calls (/internal/*).
  INTERNAL_TOKEN: z.string().min(32),
  // Postly's own DNS, published in every customer's records (docs: .env.example).
  POSTLY_SPF_INCLUDE: z.string().default('_spf.postly.eu'),
  POSTLY_BOUNCE_MX: z.string().default('mx.postly.eu'),
  POSTLY_DMARC_REPORTS: z.string().default('dmarc@postly.eu'),
  // KumoMTA's HTTP listener, for /health.
  KUMO_HTTP_URL: z.url().default('http://127.0.0.1:8000'),
  MIGRATIONS_DIR: z
    .string()
    .default(path.resolve(import.meta.dirname, '../../../packages/db/drizzle')),
});

export const env = envSchema.parse(process.env);
