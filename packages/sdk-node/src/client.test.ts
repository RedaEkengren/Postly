import { afterEach, describe, expect, it, vi } from 'vitest';
import { Postly } from './client.js';

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Postly client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a 204 DELETE without parsing a body', async () => {
    mockFetch(new Response(null, { status: 204 }));
    const postly = new Postly({ apiKey: 'pst_test_x', baseUrl: 'https://api.test' });
    await expect(postly.webhooks.delete('wh_1')).resolves.toBeUndefined();
  });

  it('passes limit and cursor on every list', async () => {
    const fetchMock = mockFetch(Response.json({ data: [], next_cursor: null }));
    const postly = new Postly({ apiKey: 'pst_test_x', baseUrl: 'https://api.test' });
    await postly.domains.list({ limit: 10, cursor: 'abc' });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.test/v1/domains?limit=10&cursor=abc');
  });

  it('omits the query string when no options are given', async () => {
    const fetchMock = mockFetch(Response.json({ data: [], next_cursor: null }));
    const postly = new Postly({ apiKey: 'pst_test_x', baseUrl: 'https://api.test' });
    await postly.templates.list();
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.test/v1/templates');
  });

  it('throws the problem details on an error status', async () => {
    mockFetch(Response.json({ type: 'x', title: 'Not found', status: 404, detail: 'nope' }, { status: 404 }));
    const postly = new Postly({ apiKey: 'pst_test_x', baseUrl: 'https://api.test' });
    await expect(postly.emails.get('msg_1')).rejects.toMatchObject({ status: 404 });
  });
});
