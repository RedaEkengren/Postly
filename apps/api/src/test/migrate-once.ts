import path from 'node:path';
import { runMigrations } from '@postly/db';

/**
 * Integration tests write to Postgres and obliterate BullMQ queues, so they
 * refuse to run anywhere that could be real data: the database name must end
 * in `_test` and Redis must be on a numbered db other than 0.
 */
function assertThrowaway(databaseUrl: string | undefined, redisUrl: string | undefined) {
  const database = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
  const redisDb = redisUrl ? new URL(redisUrl).pathname.slice(1) : '';
  if (!database.endsWith('_test') || !/^[1-9]\d*$/.test(redisDb)) {
    throw new Error(
      'Integration tests need DATABASE_URL pointing at a *_test database and REDIS_URL at a numbered db other than 0, ' +
        'e.g. postgresql://postly:postly@localhost:5432/postly_test and redis://localhost:6379/15',
    );
  }
  return databaseUrl!;
}

export default async function migrateOnce() {
  const url = assertThrowaway(process.env.DATABASE_URL, process.env.REDIS_URL);
  await runMigrations(url, path.resolve(import.meta.dirname, '../../../../packages/db/drizzle'));
}
