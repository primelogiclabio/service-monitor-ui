import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from '../src/lib/api.js';

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)) };
}

describe('createApi', () => {
  it('calls the hub on the page’s own address with the browser’s cookie and no credential of its own', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { hubId: 'h1' }));
    const api = createApi({ fetchImpl });
    expect(await api.hub()).toEqual({ hubId: 'h1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/v1/hub');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['X-Svcmon-Request']).toBe('1');
    expect(init.headers['X-Svcmon-Background']).toBeUndefined();
  });

  it('marks every request as the page’s own, changes above all, since the hub refuses a cookie-signed change without it', async () => {
    const fetchImpl = vi.fn(async (url, init) => (init.method === 'GET' ? reply(200, {}) : reply(204)));
    const api = createApi({ fetchImpl });
    await api.createCheck({ name: 'x' });
    await api.deleteCheck('c1');
    await api.changePassword({ currentPassword: 'a', newPassword: 'b' });
    await api.signOut();
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init.headers['X-Svcmon-Request'], init.method).toBe('1');
      expect(init.credentials).toBe('same-origin');
    }
  });

  it('marks the requests the page makes by itself, so they do not keep the sign-in alive', async () => {
    const fetchImpl = vi.fn(async () => reply(200, {}));
    const api = createApi({ fetchImpl });
    await api.status({ background: true });
    await api.status();
    await api.liveTicket({ background: true });
    const headers = fetchImpl.mock.calls.map(([, init]) => init.headers['X-Svcmon-Background']);
    expect(headers).toEqual(['1', undefined, '1']);
  });

  it('sends JSON bodies with a content type', async () => {
    const fetchImpl = vi.fn(async () => reply(201, { id: 'c1' }));
    const api = createApi({ fetchImpl });
    await api.createCheck({ name: 'x' });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"name":"x"}');
  });

  it('returns null for 204', async () => {
    const api = createApi({ fetchImpl: async () => reply(204) });
    expect(await api.deleteCheck('c1')).toBeNull();
  });

  it("turns hub errors into ApiError with the hub's message and code", async () => {
    const api = createApi({ fetchImpl: async () => reply(409, { error: 'last_admin', message: 'This is the last administrator' }) });
    await expect(api.deleteUser('u1')).rejects.toMatchObject({ name: 'ApiError', status: 409, code: 'last_admin', message: 'This is the last administrator' });
    const plain = createApi({ fetchImpl: async () => reply(502, 'Bad gateway') });
    await expect(plain.status()).rejects.toMatchObject({ status: 502, code: '', message: 'Bad gateway' });
  });

  it('reports a 401 that means the sign-in ended to the caller', async () => {
    for (const code of ['no_session', 'unauthorized']) {
      const onUnauthorized = vi.fn();
      const api = createApi({ fetchImpl: async () => reply(401, { error: code, message: 'nope' }), onUnauthorized });
      await expect(api.status()).rejects.toBeInstanceOf(ApiError);
      expect(onUnauthorized, code).toHaveBeenCalledOnce();
    }
  });

  it('does not report refusals that leave the sign-in standing', async () => {
    const answers = [
      reply(401, { error: 'wrong_credentials', message: 'Wrong user name or password' }),
      reply(400, { error: 'wrong_password', message: 'The current password is wrong' }),
      reply(403, { error: 'password_change_required', message: 'Choose a new password first' }),
      reply(403, { error: 'forbidden', message: 'Your role does not allow it' }),
      reply(429, { error: 'too_many_attempts', message: 'try again later' }),
    ];
    const onUnauthorized = vi.fn();
    const api = createApi({ fetchImpl: async () => answers.shift(), onUnauthorized });
    await expect(api.signIn({ username: 'a', password: 'b' })).rejects.toMatchObject({ code: 'wrong_credentials' });
    await expect(api.changePassword({ currentPassword: 'x', newPassword: 'y' })).rejects.toMatchObject({ code: 'wrong_password' });
    await expect(api.status()).rejects.toMatchObject({ code: 'password_change_required' });
    await expect(api.users()).rejects.toMatchObject({ code: 'forbidden' });
    await expect(api.changePassword({ currentPassword: 'x', newPassword: 'y' })).rejects.toMatchObject({ code: 'too_many_attempts' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports a refusal for where the browser is, and no other 403, to the caller', async () => {
    const answers = [
      reply(403, { error: 'outside_not_allowed', message: 'Access from outside the internal network is not allowed' }),
      reply(403, { error: 'insecure_transport', message: 'HTTPS only from outside' }),
      reply(403, { error: 'forbidden', message: 'Your role does not allow it' }),
    ];
    const onRefused = vi.fn();
    const onUnauthorized = vi.fn();
    const api = createApi({ fetchImpl: async () => answers.shift(), onRefused, onUnauthorized });
    await expect(api.status()).rejects.toMatchObject({ status: 403, code: 'outside_not_allowed' });
    await expect(api.status()).rejects.toMatchObject({ status: 403, code: 'insecure_transport' });
    await expect(api.users()).rejects.toMatchObject({ code: 'forbidden' });
    expect(onRefused.mock.calls).toEqual([['outside_not_allowed'], ['insecure_transport']]);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('asks the hub where it may be used from at /access', async () => {
    const seen = [];
    const api = createApi({ fetchImpl: async (url, init) => (seen.push(`${init.method} ${url}`), reply(200, { allowOutside: false })) });
    expect(await api.access()).toEqual({ allowOutside: false });
    expect(seen).toEqual(['GET /api/v1/access']);
  });

  it('hands a 401 the hub did not send to the gateway handler, and no hub 401', async () => {
    const answers = [
      reply(401, { error: 'gateway_sign_in', message: 'Sign in at the gateway first' }),
      reply(401, ''),
      reply(401, { error: 'no_session', message: 'The sign-in has ended' }),
      reply(401, { error: 'wrong_credentials', message: 'Wrong user name or password' }),
    ];
    const onGateway = vi.fn();
    const onUnauthorized = vi.fn();
    const api = createApi({ fetchImpl: async () => answers.shift(), onGateway, onUnauthorized });
    await expect(api.status()).rejects.toMatchObject({ status: 401, code: 'gateway_sign_in' });
    await expect(api.status()).rejects.toMatchObject({ status: 401, code: '' });
    expect(onGateway).toHaveBeenCalledTimes(2);
    await expect(api.status()).rejects.toMatchObject({ code: 'no_session' });
    await expect(api.signIn({ username: 'a', password: 'b' })).rejects.toMatchObject({ code: 'wrong_credentials' });
    expect(onGateway).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('explains network failures', async () => {
    const api = createApi({ fetchImpl: async () => { throw new TypeError('fetch failed'); } });
    await expect(api.status()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Cannot reach the hub') });
  });

  it('builds result queries and encodes ids', async () => {
    const fetchImpl = vi.fn(async () => reply(200, []));
    const api = createApi({ fetchImpl });
    await api.results('a/b', { since: 123, limit: 50 });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/checks/a%2Fb/results?since=123&limit=50');
    await api.results('c1');
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/v1/checks/c1/results');
  });

  it('signs in and out, and gets live tickets, at the hub paths', async () => {
    const fetchImpl = vi.fn(async (url, init) => (init.method === 'DELETE' ? reply(204) : reply(200, {})));
    const api = createApi({ fetchImpl });
    await api.session();
    await api.signIn({ username: 'alice', password: 'pw' });
    await api.liveTicket();
    await api.signOut();
    await api.sessions();
    await api.endSession('s 1');
    expect(fetchImpl.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'GET /api/v1/session',
      'POST /api/v1/session',
      'POST /api/v1/session/live-ticket',
      'DELETE /api/v1/session',
      'GET /api/v1/sessions',
      'DELETE /api/v1/sessions/s%201',
    ]);
  });

  it('manages users at the hub paths', async () => {
    const fetchImpl = vi.fn(async (url, init) => (init.method === 'DELETE' ? reply(204) : reply(200, {})));
    const api = createApi({ fetchImpl });
    await api.users();
    await api.createUser({ username: 'bob', role: 'READ' });
    await api.updateUser('u/1', { role: 'ADMIN' });
    await api.resetPassword('u1');
    await api.deleteUser('u1');
    await api.changePassword({ currentPassword: 'a', newPassword: 'b' });
    expect(fetchImpl.mock.calls.map(([url, init]) => [init.method, url, init.body])).toEqual([
      ['GET', '/api/v1/users', undefined],
      ['POST', '/api/v1/users', '{"username":"bob","role":"READ"}'],
      ['PATCH', '/api/v1/users/u%2F1', '{"role":"ADMIN"}'],
      ['POST', '/api/v1/users/u1/password-reset', undefined],
      ['DELETE', '/api/v1/users/u1', undefined],
      ['PUT', '/api/v1/me/password', '{"currentPassword":"a","newPassword":"b"}'],
    ]);
  });
});
