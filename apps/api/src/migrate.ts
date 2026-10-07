import { runMigrations } from '@postly/db';
import { env } from './env.js';

// Container entrypoint step: runs before the server starts, so a container
// that is up is a container whose schema matches its code.
await runMigrations(env.DATABASE_URL, env.MIGRATIONS_DIR);
console.log(`Migrations applied from ${env.MIGRATIONS_DIR}`);
