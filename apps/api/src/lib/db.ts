import { createDb } from '@postly/db';
import { env } from '../env.js';

let db: ReturnType<typeof createDb>;

export function getDb() {
  if (!db) {
    db = createDb(env.DATABASE_URL);
  }
  return db;
}
