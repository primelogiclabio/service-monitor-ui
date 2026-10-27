import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()],
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
      return handler ? handler(init ?? {}) : reply(404, { message: 'not found' });
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
    expect(auth).toMatchObject({ mode: 'proxy', signedIn: true, user: 'alice', admin: true, gate: '', error: '' });
    expect(auth.hub.version).toBe('0.1.0');
    expect(getApi()).not.toBeNull();

    const call = calls.find((c) => c.path === '/web-api/v1/me');
    expect(call.init.headers['X-PLL-Web']).toBe('1');
    expect(call.init.headers.Authorization).toBeUndefined();
    expect(calls.some((c) => c.path.startsWith('/api/'))).toBe(false); // the hub's own sign-in is not asked
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

  it('no sign-in screen shows before the redirect; it does when the redirect is refused', async () => {
    routes['/web-api/v1/me'] = noSession;
    const { screen, restore } = await fresh();
    expect(screen(false)).toBe('loading');

    await restore(); // sent to the proxy's sign-in page
    expect(screen(true)).toBe('loading');

    await restore(); // back without a session: the guard refuses a second redirect
    expect(screen(true)).toBe('gate');
  });

  it('a page brought back from the cache after the redirect shows the gate, not "Loading…" for good', async () => {
    routes['/web-api/v1/me'] = noSession;
    const { redirectEnded, restore, screen } = await fresh();
    await restore();
    expect(screen(true)).toBe('loading');
    redirectEnded();
    expect(screen(true)).toBe('gate');
  });

  it('the other screens: the dashboard when signed in, the forms when the proxy is not used', async () => {
    routes['/web-api/v1/me'] = me();
    routes['/web-api/v1/hub'] = hub;
    const signedIn = await fresh();
    await signedIn.restore();
    expect(signedIn.screen(true)).toBe('app');

    vi.resetModules();
    routes['/web-api/v1/me'] = () => reply(503, { message: 'down' });
    const fallback = await fresh();
    await fallback.restore();
    expect(fallback.screen(true)).toBe('login');
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
  const PASSWORD = 'correct horse battery staple';

  /** The hub's own sign-in, as the cookie would make it behave: signed in after a POST, across reloads. */
  function hubSignIn() {
    let signedIn = false;
    const state = () => ({ signedIn: true, user: { id: 'u1', name: 'bob', role: 'ADMIN' }, mustChangePassword: false, expiresAt: Date.now() + 3_600_000 });
    routes['/api/v1/hub'] = hub;
    routes['/api/v1/session'] = (init) => {
      if (init.method === 'POST') {
        signedIn = true;
        return reply(200, state());
      }
      return reply(200, signedIn ? state() : { signedIn: false });
    };
  }

  it('a sign-in service that is down falls back to the password sign-in, and says why', async () => {
    hubSignIn();
    routes['/web-api/v1/me'] = () => reply(503, { message: 'keys unavailable' });
    const { auth, restore, screen } = await fresh();

    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'session', signedIn: false, gate: '', error: '' });
    expect(auth.fallback).toMatch(/answered 503/);
    expect(screen(true)).toBe('login');
    expect(assigned).toEqual([]);
  });

  it('a site with no proxy at all (the hub reached on its own address) falls back too', async () => {
    // routes has no /web-api/ entry: the hub answers 404 to a path it does not know
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'session', signedIn: false });
    expect(auth.fallback).toMatch(/no sign-in service/);
  });

  it('a host that answers every path with the page itself is not mistaken for a proxy', async () => {
    routes['/web-api/v1/me'] = () => reply(200, '<!doctype html><title>Service Monitor</title>');
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'session', signedIn: false });
    expect(auth.fallback).toMatch(/no sign-in service/);
  });

  it('a network failure falls back with its own wording', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('config.json')) return reply(200, CONFIG);
      throw new TypeError('Failed to fetch');
    }));
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'session', signedIn: false });
    expect(auth.fallback).toMatch(/did not answer/);
  });

  it('signing in with a password then works, keeps nothing in the browser, and survives a reload while the proxy is down', async () => {
    hubSignIn();
    const first = await fresh();
    await first.restore();
    await first.signIn({ username: 'bob', password: PASSWORD });
    expect(first.auth).toMatchObject({ mode: 'session', signedIn: true, admin: true, user: 'bob' });
    const post = calls.find((c) => c.path === '/api/v1/session' && c.init.method === 'POST');
    expect(post.init.headers.Authorization).toBeUndefined();
    expect(post.init.headers['X-PLL-Web']).toBeUndefined(); // the proxy's marker is for the proxy only
    expect(session.keys()).toEqual([]);

    vi.resetModules(); // a reload: new module state, the same cookie at the hub
    const second = await fresh();
    expect(await second.restore()).toBe(true);
    expect(second.auth).toMatchObject({ mode: 'session', signedIn: true, admin: true, user: 'bob' });
  });

  it('trying the proxy again goes back to it as soon as it answers', async () => {
    routes['/web-api/v1/me'] = () => reply(503, { message: 'keys unavailable' });
    const { auth, restore } = await fresh();
    await restore();
    expect(auth.mode).toBe('session');

    routes['/web-api/v1/me'] = me();
    routes['/web-api/v1/hub'] = hub;
    expect(await restore()).toBe(true);
    expect(auth).toMatchObject({ mode: 'proxy', signedIn: true, user: 'alice', fallback: '' });
  });

  it("a proxy that wants a sign-in still redirects, and the hub's own sign-in is not asked", async () => {
    hubSignIn();
    routes['/web-api/v1/me'] = noSession;
    const { auth, restore } = await fresh();

    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ mode: 'proxy', gate: 'signin', redirecting: true, signedIn: false });
    expect(assigned).toHaveLength(1);
    expect(calls.some((c) => c.path.startsWith('/api/'))).toBe(false);
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
  it('a deployment with no config.json asks the hub who is signed in and never calls the proxy path', async () => {
    routes = {};
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth.mode).toBe('session');
    expect(calls.map((c) => c.path)).toEqual(['/config.json', '/api/v1/session']);
  });

  it('a wrong config.json is reported on the sign-in page', async () => {
    routes['/config.json'] = () => reply(200, { proxy: { apiBase: 'nope' } });
    const { auth, restore } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth.mode).toBe('session');
    expect(auth.error).toMatch(/config\.json/);
  });
});
