import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Applies the migrations in `migrationsFolder` (drizzle's journal decides what
 * is pending). Migration 0000 uses citext and gen_random_uuid(), so the
 * extensions are created first; in dev infra/init.sql does that, but a managed
 * database (Neon) starts without them. `IF NOT EXISTS` makes this a no-op
 * after the first run.
 */
/** Arbitrary but fixed: identifies Postly's migration lock among other advisory locks. */
const MIGRATION_LOCK_KEY = 7_372_019_001;

export async function runMigrations(databaseUrl: string, migrationsFolder: string) {
  const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    // Two migrators starting at once (two deploys, parallel test suites) would
    // race on CREATE EXTENSION and on the migrations table. A session-level
    // advisory lock makes the second one wait and then find nothing to do.
    await client`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    await client`CREATE EXTENSION IF NOT EXISTS citext`;
    await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
