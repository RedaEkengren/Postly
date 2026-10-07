import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, parsePage, toPage } from './pagination.js';

const T = '2026-09-19 12:00:00.123456+00';

describe('cursor', () => {
  it('round-trips, keeping microseconds', () => {
    const cursor = { t: T, k: '0b7c6f5e-0000-4000-8000-000000000001' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('is URL-safe', () => {
    expect(encodeCursor({ t: T, k: '?/+=' })).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects anything that is not a cursor with 400 invalid_cursor', () => {
    for (const raw of ['', 'not-base64!', encodeCursor({ t: 'yesterday', k: 'x' }), Buffer.from('[]').toString('base64url')]) {
      expect(() => decodeCursor(raw)).toThrowError(expect.objectContaining({ status: 400, type: 'invalid_cursor' }));
    }
  });
});

describe('parsePage', () => {
  it('defaults to 25 and accepts 1–100', () => {
    expect(parsePage({}).limit).toBe(25);
    expect(parsePage({ limit: '1' }).limit).toBe(1);
    expect(parsePage({ limit: '100' }).limit).toBe(100);
  });

  it('rejects limits that used to crash or reach SQL', () => {
    for (const limit of ['0', '-5', '101', 'abc', '2.5']) {
      expect(() => parsePage({ limit })).toThrowError(expect.objectContaining({ status: 400 }));
    }
  });
});

describe('toPage', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('returns a cursor when there is another page', () => {
    const page = toPage(rows, 2, (r) => ({ t: T, k: r.id }));
    expect(page.data).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(decodeCursor(page.next_cursor!)).toEqual({ t: T, k: 'b' });
  });

  it('returns null on the last page, including an empty one', () => {
    expect(toPage(rows, 3, (r) => ({ t: T, k: r.id })).next_cursor).toBeNull();
    expect(toPage([], 25, () => ({ t: T, k: '' }))).toEqual({ data: [], next_cursor: null });
  });
});
