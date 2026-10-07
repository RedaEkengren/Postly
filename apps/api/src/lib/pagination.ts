import { sql, type Column, type SQL } from '@postly/db';
import { paginationSchema } from '@postly/shared';
import { ApiError } from './errors.js';

/**
 * Keyset position: `t` is created_at as Postgres renders it (microseconds;
 * a JS Date would round to milliseconds and skip or repeat rows), `k` is the
 * tie-breaking key of the last row returned.
 */
export type Cursor = { t: string; k: string };

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function invalidCursorError() {
  return new ApiError(400, 'invalid_cursor', 'Invalid cursor', 'The pagination cursor is malformed');
}

export function decodeCursor(raw: string): Cursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as Cursor).t === 'string' &&
      typeof (parsed as Cursor).k === 'string' &&
      !Number.isNaN(Date.parse((parsed as Cursor).t))
    ) {
      return parsed as Cursor;
    }
  } catch {
    // Falls through to the typed error below.
  }
  throw invalidCursorError();
}

export function parsePage(query: { cursor?: string; limit?: string }) {
  const parsed = paginationSchema.safeParse(query);
  if (!parsed.success) {
    throw new ApiError(400, 'validation_error', 'Validation error', 'limit must be an integer from 1 to 100');
  }
  return {
    limit: parsed.data.limit,
    cursor: parsed.data.cursor ? decodeCursor(parsed.data.cursor) : null,
  };
}

/** `created_at` as text, selected alongside each row to build the next cursor. */
export function cursorTimestamp(createdAt: Column): SQL<string> {
  return sql<string>`${createdAt}::text`;
}

/** Rows strictly older than the cursor, in (created_at desc, key desc) order. */
export function olderThan(createdAt: Column, key: Column, cursor: Cursor, keyType: 'uuid' | 'citext'): SQL {
  // keyType is one of two literals, never user input, so sql.raw is safe here.
  return sql`(${createdAt}, ${key}) < (${cursor.t}::timestamptz, ${cursor.k}::${sql.raw(keyType)})`;
}

/** Trims the extra row fetched to detect a next page and builds its cursor. */
export function toPage<T>(rows: T[], limit: number, cursorOf: (row: T) => Cursor) {
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  return { data, next_cursor: hasMore && last ? encodeCursor(cursorOf(last)) : null };
}
