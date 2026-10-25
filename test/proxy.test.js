import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)) };
}

const CONFIG = { proxy: { headers: { 'X-PLL-Web': '1' } } };

let routes;
let session;
let assigned;
let calls;

beforeEach(() => {
  vi.resetModules(); // the sign-in state is a module-level singleton; every test starts from signed out
  session = memoryStorage();
  assigned = [];
  calls = [];
  routes = { '/config.json': () => reply(200, CONFIG) };
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('location', { href: 'https://monitor.example.com/#/checks', assign: (u) => assigned.push(u) });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      const path = new URL(url, 'https://monitor.example.com/').pathname;
      calls.push({ path, init });
      const handler = routes[path];
      return handler ? handler() : reply(404, { message: 'not found' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const me = (scope = 'ADMIN') => () => reply(200, { method: 'jwt', name: 'alice', scope });
const hub = () => reply(200, { hubId: 'h1', version: '0.1.0' });
const noSession = () => reply(401, { message: 'sign in' });

async function fresh() {
  return import('../src/lib/auth.svelte.js');
}

describe('restore behind a sign-in proxy', () => {
  it('signs in with no token and no login page, as the signed-in administrator', async () => {
    routes['/web-api/v1/me'] = me();
    routes['/web-api/v1/hub'] = hub;
    const { auth, getApi, restore } = await fresh();

    expect(await restore()).toBe(true);
    expect(auth).toMatchObject({ mode: 'proxy', signedIn: true, user: 'alice', admin: true, token: '', gate: '', error: '' });
    expect(auth.hub.version).toBe('0.1.0');
    expect(getApi()).not.toBeNull();

    const call = calls.find((c) => c.path === '/web-api/v1/me');
    expect(call.init.headers['X-PLL-Web']).toBe('1');
    expect(call.init.headers.Authorization).toBeUndefined();
    expect(session.getItem('sm-auth')).toBeNull();
  });

  it('a visitor with no session is sent to sign in, once, and comes back to the same page', async () => {
    routes['/web-api/v1/me'] = noSession;
    const { auth, restore } = await fresh();

    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'proxy', signedIn: false, gate: 'signin', redirecting: true });
    expect(assigned).toEqual(['/oauth2/start?rd=' + encodeURIComponent('https://monitor.example.com/#/checks')]);

    // Back from the sign-in page still without a session: show the gate instead of looping.
    expect(await restore()).toBe(false);
    expect(assigned).toHaveLength(1);
    expect(auth.redirecting).toBe(false);
    expect(auth.gate).toBe('signin');
  });

  it("the gate's button goes to sign in even right after a redirect", async () => {
    routes['/web-api/v1/me'] = noSession;
    const { redirectToSignIn, restore } = await fresh();
    await restore();
    await restore();
    expect(redirectToSignIn()).toBe(true);
    expect(assigned).toHaveLength(2);
  });

  it('an account the gateway refuses gets a gate with the reason, not a redirect', async () => {
    routes['/web-api/v1/me'] = () => reply(403, { message: 'Only administrators may use the hub' });
    const { auth, restore } = await fresh();

    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ signedIn: false, gate: 'forbidden', error: 'Only administrators may use the hub' });
    expect(assigned).toEqual([]);
  });

  it('a signed-in identity without ADMIN scope is not shown admin controls', async () => {
    routes['/web-api/v1/me'] = me('READ');
    routes['/web-api/v1/hub'] = hub;
    const { auth, restore } = await fresh();
    await restore();
    expect(auth.admin).toBe(false);
  });

  it('a session that ends later brings the gate back with a message', async () => {
    routes['/web-api/v1/me'] = me();
    routes['/web-api/v1/hub'] = hub;
    routes['/web-api/v1/status'] = noSession;
    const { auth, getApi, restore } = await fresh();
    await restore();

    await expect(getApi().status()).rejects.toMatchObject({ status: 401 });
    expect(auth).toMatchObject({ signedIn: false, gate: 'signin', admin: false });
    expect(auth.error).toMatch(/session has ended/i);
    expect(getApi()).toBeNull();
    expect(assigned).toEqual([]); // no jump away from a page the user may have unsaved work on
  });

  it("Sign out leaves through the proxy's sign-out address", async () => {
    routes['/web-api/v1/me'] = me();
    routes['/web-api/v1/hub'] = hub;
    const { auth, getApi, logout, restore } = await fresh();
    await restore();

    logout();
    expect(assigned).toEqual(['/oauth2/sign_out']);
    expect(auth.signedIn).toBe(false);
    expect(getApi()).toBeNull();
  });
});

describe('when no proxy answers', () => {
  const GOOD = 'svm_a_good-token-0000000000000000000000';
  const tokenSignInRoutes = () => {
    routes['/api/v1/hub'] = hub;
    routes['/api/v1/tokens'] = () => reply(200, []);
  };

  it('a sign-in service that is down falls back to the token and password sign-in, and says why', async () => {
    routes['/web-api/v1/me'] = () => reply(503, { message: 'keys unavailable' });
    const { auth, restore } = await fresh();

    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'token', signedIn: false, gate: '', error: '' });
    expect(auth.fallback).toMatch(/answered 503/);
    expect(assigned).toEqual([]);
  });

  it('a site with no proxy at all (the hub reached on its own address) falls back too', async () => {
    // routes has no /web-api/ entry: the hub answers 404 to a path it does not know
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'token', signedIn: false });
    expect(auth.fallback).toMatch(/no sign-in service/);
  });

  it('a host that answers every path with the page itself is not mistaken for a proxy', async () => {
    routes['/web-api/v1/me'] = () => reply(200, '<!doctype html><title>Service Monitor</title>');
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'token', signedIn: false });
    expect(auth.fallback).toMatch(/no sign-in service/);
  });

  it('a network failure falls back with its own wording', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('config.json')) return reply(200, CONFIG);
      throw new TypeError('Failed to fetch');
    }));
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'token', signedIn: false });
    expect(auth.fallback).toMatch(/did not answer/);
  });

  it('signing in with a token then works, and the session survives a reload while the proxy is still down', async () => {
    tokenSignInRoutes();
    const first = await fresh();
    await first.restore();
    await first.login({ hubUrl: '', token: GOOD, remember: false });
    expect(first.auth).toMatchObject({ mode: 'token', signedIn: true, admin: true });
    expect(calls.find((c) => c.path === '/api/v1/hub').init.headers.Authorization).toBe(`Bearer ${GOOD}`);

    vi.resetModules(); // a reload: new module state, same session storage
    const second = await fresh();
    expect(await second.restore()).toBe(true);
    expect(second.auth).toMatchObject({ mode: 'token', signedIn: true, admin: true });
  });

  it('the password sign-in works too', async () => {
    tokenSignInRoutes();
    routes['/api/v1/login'] = () => reply(200, { token: GOOD, expiresAt: '2026-10-26T00:00:00Z', scope: 'ADMIN', name: 'local-login' });
    const { auth, loginWithPassword, restore } = await fresh();
    await restore();
    await loginWithPassword({ hubUrl: '', username: 'admin', password: 'correct horse battery' });
    expect(auth).toMatchObject({ mode: 'token', signedIn: true, admin: true });
    expect(calls.find((c) => c.path === '/api/v1/login').init.body).toContain('correct horse battery');
    expect(session.getItem('sm-auth')).not.toContain('correct horse battery'); // only the token is kept
  });

  it('trying the proxy again goes back to it as soon as it answers', async () => {
    routes['/web-api/v1/me'] = () => reply(503, { message: 'keys unavailable' });
    const { auth, restore } = await fresh();
    await restore();
    expect(auth.mode).toBe('token');

    routes['/web-api/v1/me'] = me();
    routes['/web-api/v1/hub'] = hub;
    expect(await restore()).toBe(true);
    expect(auth).toMatchObject({ mode: 'proxy', signedIn: true, user: 'alice', fallback: '' });
  });

  it('a saved token does not override a working proxy, and a proxy that wants a sign-in still redirects', async () => {
    session.setItem('sm-auth', JSON.stringify({ hubUrl: '', token: GOOD }));
    tokenSignInRoutes();
    routes['/web-api/v1/me'] = noSession;
    const { auth, restore } = await fresh();

    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'proxy', gate: 'signin', redirecting: true, signedIn: false });
    expect(assigned).toHaveLength(1);
    expect(calls.some((c) => c.path === '/api/v1/hub')).toBe(false);
  });

  it('an account the proxy refuses is not sent to the fallback form', async () => {
    routes['/web-api/v1/me'] = () => reply(403, { message: 'Only administrators may use the hub' });
    const { auth, restore } = await fresh();
    await restore();
    expect(auth).toMatchObject({ mode: 'proxy', gate: 'forbidden' });
    expect(auth.fallback).toBe('');
  });
});

describe('without a proxy setting', () => {
  it('a deployment with no config.json keeps the token sign-in and never calls the proxy path', async () => {
    routes = {};
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth.mode).toBe('token');
    expect(calls.map((c) => c.path)).toEqual(['/config.json']);
  });

  it('a wrong config.json is reported on the sign-in page', async () => {
    routes['/config.json'] = () => reply(200, { proxy: { apiBase: 'nope' } });
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth.mode).toBe('token');
    expect(auth.error).toMatch(/config\.json/);
  });
});
