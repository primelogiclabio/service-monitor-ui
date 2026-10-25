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

  it('a hub that cannot be reached gets a gate that can try again', async () => {
    routes['/web-api/v1/me'] = () => reply(503, { message: 'keys unavailable' });
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ gate: 'unreachable', error: 'keys unavailable' });
    expect(assigned).toEqual([]);

    routes['/web-api/v1/me'] = me();
    routes['/web-api/v1/hub'] = hub;
    expect(await restore()).toBe(true);
    expect(auth).toMatchObject({ signedIn: true, gate: '', error: '' });
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
