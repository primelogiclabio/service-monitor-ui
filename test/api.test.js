import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from '../src/lib/api.js';

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)) };
}

describe('createApi', () => {
  it('sends the bearer token and parses JSON', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { hubId: 'h1' }));
    const api = createApi({ base: 'http://hub:8080', token: 'tok', fetchImpl });
    expect(await api.hub()).toEqual({ hubId: 'h1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://hub:8080/api/v1/hub');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.method).toBe('GET');
  });

  it('sends JSON bodies with a content type', async () => {
    const fetchImpl = vi.fn(async () => reply(201, { id: 'c1' }));
    const api = createApi({ token: 't', fetchImpl });
    await api.createCheck({ name: 'x' });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"name":"x"}');
  });

  it('returns null for 204', async () => {
    const api = createApi({ token: 't', fetchImpl: async () => reply(204) });
    expect(await api.deleteCheck('c1')).toBeNull();
  });

  it('turns hub errors into ApiError with the hub message', async () => {
    const api = createApi({ token: 't', fetchImpl: async () => reply(400, { error: 'bad_request', message: 'name is required' }) });
    await expect(api.createCheck({})).rejects.toMatchObject({ name: 'ApiError', status: 400, message: 'name is required' });
  });

  it('reports 401 to the caller', async () => {
    const onUnauthorized = vi.fn();
    const api = createApi({ token: 'bad', fetchImpl: async () => reply(401, { message: 'nope' }), onUnauthorized });
    await expect(api.status()).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('explains network failures', async () => {
    const api = createApi({ token: 't', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
    await expect(api.status()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Cannot reach the hub') });
  });

  it('builds result queries and encodes ids', async () => {
    const fetchImpl = vi.fn(async () => reply(200, []));
    const api = createApi({ token: 't', fetchImpl });
    await api.results('a/b', { since: 123, limit: 50 });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/checks/a%2Fb/results?since=123&limit=50');
    await api.results('c1');
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/v1/checks/c1/results');
  });

  it('omits the Authorization header without a token', async () => {
    const fetchImpl = vi.fn(async () => reply(200, {}));
    await createApi({ fetchImpl }).hub();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
