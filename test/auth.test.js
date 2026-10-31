import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The hub's sign-in as the page sees it: a cookie it cannot read, so the fake hub below decides by its own state who
// is signed in, and the tests check what the page sends and what it keeps.

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: vi.fn((k, v) => m.set(k, String(v))),
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()],
  };
}

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a much longer passphrase';

const signedIn = (role = 'ADMIN', mustChangePassword = false) => ({
  signedIn: true,
  user: { id: 'u1', name: 'alice', role },
  mustChangePassword,
  expiresAt: Date.now() + 3_600_000,
});

let routes;
let calls;
let session;
let remembered;

beforeEach(() => {
  vi.resetModules(); // the sign-in state is a module-level singleton; every test starts from signed out
  session = memoryStorage();
  remembered = memoryStorage();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', remembered);
  calls = [];
  routes = {
    'GET /config.json': () => reply(404),
    'GET /api/v1/session': () => reply(200, { signedIn: false }),
    'GET /api/v1/hub': () => reply(200, { hubId: 'h1', version: '0.2.0' }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const path = new URL(url, 'http://hub').pathname;
      const key = `${init.method ?? 'GET'} ${path}`;
      calls.push({ key, init });
      const handler = routes[key];
      return handler ? handler(init) : reply(404, { error: 'not_found', message: 'not found' });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const fresh = () => import('../src/lib/auth.svelte.js');
const callsTo = (key) => calls.filter((c) => c.key === key);

describe('opening the page', () => {
  it('resumes a sign-in the hub still has, as an administrator', async () => {
    routes['GET /api/v1/session'] = () => reply(200, signedIn('ADMIN'));
    const { auth, getApi, restore, screen } = await fresh();

    expect(await restore()).toBe(true);
    expect(auth).toMatchObject({ signedIn: true, user: 'alice', role: 'ADMIN', admin: true, mustChangePassword: false, error: '' });
    expect(auth.hub.version).toBe('0.2.0');
    expect(getApi()).not.toBeNull();
    expect(screen(true)).toBe('app');

    for (const { init } of calls.filter((c) => c.key.includes('/api/'))) {
      expect(init.credentials).toBe('same-origin');
      expect(init.headers['X-Svcmon-Request']).toBe('1');
      expect(init.headers.Authorization).toBeUndefined();
    }
  });

  it('a read-only user gets no admin controls', async () => {
    routes['GET /api/v1/session'] = () => reply(200, signedIn('READ'));
    const { auth, restore } = await fresh();
    await restore();
    expect(auth).toMatchObject({ signedIn: true, role: 'READ', admin: false });
  });

  it('shows the sign-in form when the hub has no sign-in for this browser', async () => {
    const { auth, getApi, restore, screen } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ signedIn: false, error: '' });
    expect(getApi()).toBeNull();
    expect(screen(true)).toBe('login');
    expect(callsTo('GET /api/v1/hub')).toHaveLength(0);
  });

  it('says so when the hub cannot be reached', async () => {
    routes['GET /api/v1/session'] = () => {
      throw new TypeError('Failed to fetch');
    };
    const { auth, restore, screen } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth.error).toMatch(/Cannot reach the hub/);
    expect(screen(true)).toBe('login');
  });

  it('a password that must be changed leads to the change form and nothing else', async () => {
    routes['GET /api/v1/session'] = () => reply(200, signedIn('ADMIN', true));
    const { auth, getApi, restore, screen } = await fresh();

    expect(await restore()).toBe(false);
    expect(auth).toMatchObject({ signedIn: false, mustChangePassword: true, user: 'alice' });
    expect(getApi()).not.toBeNull();
    expect(screen(true)).toBe('change-password');
    expect(callsTo('GET /api/v1/hub')).toHaveLength(0); // the hub answers 403 password_change_required until then
  });

  it('shows the sign-in page, whatever the hub would say to a sign-in from here', async () => {
    routes['GET /api/v1/session'] = () => reply(200, { signedIn: false, passwordSignIn: true });
    const { auth, getApi, restore, screen } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth.access).toEqual({ passwordSignIn: true, provider: null });
    expect(getApi()).toBeNull();
    expect(screen(true)).toBe('login');
  });

  it('keeps nothing of where an older hub says the browser is, and shows the sign-in page all the same', async () => {
    routes['GET /api/v1/session'] = () =>
      reply(200, { signedIn: false, network: 'outside', address: '203.0.113.7', signInAllowed: false, signInRefusal: 'outside_not_allowed' });
    const { auth, restore, screen } = await fresh();
    await restore();
    expect(auth.access).toEqual({ passwordSignIn: true, provider: null });
    expect(screen(true)).toBe('login');
  });

  it('deletes what older versions kept in this browser, a token among it, and leaves the rest', async () => {
    for (const store of [session, remembered]) {
      store.setItem('sm-auth', JSON.stringify({ hubUrl: '', token: 'svm_a_old-token-000000000000000000000' }));
      store.setItem('sm-login-mode', 'token');
      store.setItem('sm-theme', 'dark');
    }
    const { restore } = await fresh();
    await restore();
    for (const store of [session, remembered]) expect(store.keys()).toEqual(['sm-theme']);
  });

  it('still starts when browser storage is blocked', async () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', blocked);
    vi.stubGlobal('sessionStorage', blocked);
    routes['GET /api/v1/session'] = () => reply(200, signedIn());
    const { restore } = await fresh();
    expect(await restore()).toBe(true);
  });
});

describe('signing in', () => {
  it('sends the name and password to the hub once and keeps neither', async () => {
    routes['POST /api/v1/session'] = () => reply(200, signedIn('ADMIN'));
    const { auth, signIn, screen } = await fresh();

    await signIn({ username: ' alice ', password: PASSWORD });

    const [post] = callsTo('POST /api/v1/session');
    expect(JSON.parse(post.init.body)).toEqual({ username: 'alice', password: PASSWORD });
    expect(post.init.headers['X-Svcmon-Request']).toBe('1');
    expect(post.init.headers['Content-Type']).toBe('application/json');
    expect(post.init.headers.Authorization).toBeUndefined();
    expect(post.init.credentials).toBe('same-origin');

    expect(auth).toMatchObject({ signedIn: true, user: 'alice', admin: true });
    expect(screen(true)).toBe('app');
    expect(session.setItem).not.toHaveBeenCalled();
    expect(remembered.setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(auth)).not.toContain(PASSWORD);
  });

  it.each([
    [401, 'wrong_credentials', 'Wrong user name or password'],
    [403, 'initial_password_inside_only', 'This password has to be changed, and that works only from the internal network'],
    [429, 'too_many_attempts', 'Too many wrong attempts; try again in 600 seconds'],
    [404, 'not_found', 'Sign-in with a user name and password is turned off on this hub'],
  ])('a refusal (%i %s) starts no session, adds no banner, and keeps its code', async (status, code, message) => {
    routes['POST /api/v1/session'] = () => reply(status, { error: code, message });
    const { auth, getApi, signIn } = await fresh();
    await expect(signIn({ username: 'alice', password: PASSWORD })).rejects.toMatchObject({ name: 'ApiError', status, code, message });
    expect(auth).toMatchObject({ signedIn: false, mustChangePassword: false, error: '' });
    expect(getApi()).toBeNull();
  });

  it.each(['outside_not_allowed', 'insecure_transport'])(
    'a sign-in refused for where the browser is (%s) stays on the sign-in page, which says so',
    async (code) => {
      routes['POST /api/v1/session'] = () => reply(403, { error: code, message: 'from the hub' });
      const { auth, getApi, signIn, screen } = await fresh();
      await expect(signIn({ username: 'alice', password: PASSWORD })).rejects.toMatchObject({ code });
      expect(auth).toMatchObject({ signedIn: false, error: '' });
      expect(getApi()).toBeNull();
      expect(screen(true)).toBe('login');
    },
  );

  it('a failed attempt leaves an existing session alone', async () => {
    routes['POST /api/v1/session'] = () => reply(200, signedIn('ADMIN'));
    const { auth, getApi, signIn } = await fresh();
    await signIn({ username: 'alice', password: PASSWORD });
    const before = getApi();

    routes['POST /api/v1/session'] = () => reply(401, { error: 'wrong_credentials', message: 'Wrong user name or password' });
    await expect(signIn({ username: 'bob', password: 'nope nope nope' })).rejects.toMatchObject({ code: 'wrong_credentials' });
    expect(getApi()).toBe(before);
    expect(auth).toMatchObject({ signedIn: true, user: 'alice', error: '' });
  });
});

describe('a password that must be changed', () => {
  async function signedInMustChange() {
    routes['POST /api/v1/session'] = () => reply(200, signedIn('READ', true));
    const mod = await fresh();
    await mod.signIn({ username: 'alice', password: 'admin' });
    return mod;
  }

  it('is changed with the current one, and then the dashboard opens', async () => {
    routes['PUT /api/v1/me/password'] = () => reply(204);
    const { auth, changePassword, screen } = await signedInMustChange();
    expect(screen(true)).toBe('change-password');

    await changePassword({ currentPassword: 'admin', newPassword: NEW_PASSWORD });

    const [put] = callsTo('PUT /api/v1/me/password');
    expect(JSON.parse(put.init.body)).toEqual({ currentPassword: 'admin', newPassword: NEW_PASSWORD });
    expect(put.init.headers['X-Svcmon-Request']).toBe('1');
    expect(auth).toMatchObject({ signedIn: true, mustChangePassword: false, user: 'alice', role: 'READ', admin: false });
    expect(auth.hub.version).toBe('0.2.0');
    expect(screen(true)).toBe('app');
    expect(session.setItem).not.toHaveBeenCalled();
    expect(remembered.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong_password', 'The current password is wrong'],
    ['weak_password', 'The password must be 12 to 128 characters'],
    ['same_password', 'Choose a password different from the current one'],
  ])('a refusal (%s) is a 400 that keeps the user signed in', async (code, message) => {
    routes['PUT /api/v1/me/password'] = () => reply(400, { error: code, message });
    const { auth, changePassword, getApi, screen } = await signedInMustChange();
    await expect(changePassword({ currentPassword: 'admin', newPassword: 'short' })).rejects.toMatchObject({ status: 400, code, message });
    expect(getApi()).not.toBeNull();
    expect(auth.error).toBe('');
    expect(screen(true)).toBe('change-password');
  });

  it('can be left with Sign out', async () => {
    routes['DELETE /api/v1/session'] = () => reply(204);
    const { auth, logout, screen } = await signedInMustChange();
    await logout();
    expect(callsTo('DELETE /api/v1/session')).toHaveLength(1);
    expect(auth).toMatchObject({ signedIn: false, mustChangePassword: false, user: '' });
    expect(screen(true)).toBe('login');
  });
});

describe('behind a sign-in gateway', () => {
  const gatewaySaysSignIn = () => reply(401, { error: 'gateway_sign_in', message: 'Sign in at the gateway first' });

  it('reloads the page once when the gateway sign-in ends, so the gateway can ask again', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    routes['GET /api/v1/session'] = () => reply(200, signedIn('ADMIN'));
    const { auth, getApi, restore } = await fresh();
    await restore();

    routes['GET /api/v1/status'] = gatewaySaysSignIn;
    await expect(getApi().status()).rejects.toMatchObject({ status: 401, code: 'gateway_sign_in' });
    expect(reload).toHaveBeenCalledOnce();
    expect(session.setItem).toHaveBeenCalledWith('sm-gateway-reload', expect.any(String));
    expect(auth.signedIn).toBe(true); // the reload takes the page away; nothing to undo first
  });

  it('says so instead of reloading in a loop when the gateway keeps answering', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    session.setItem('sm-gateway-reload', String(Date.now() - 1000));
    routes['GET /api/v1/session'] = () => reply(200, signedIn('ADMIN'));
    const { auth, GATEWAY_STUCK, getApi, restore, screen } = await fresh();
    await restore();

    routes['GET /api/v1/status'] = gatewaySaysSignIn;
    await expect(getApi().status()).rejects.toMatchObject({ code: 'gateway_sign_in' });
    expect(reload).not.toHaveBeenCalled();
    expect(auth).toMatchObject({ signedIn: false, error: GATEWAY_STUCK });
    expect(screen(true)).toBe('login');
  });

  it('a hub that answers itself never makes the page reload', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    routes['GET /api/v1/session'] = () => reply(200, signedIn('ADMIN'));
    const { getApi, restore } = await fresh();
    await restore();
    routes['GET /api/v1/status'] = () => reply(401, { error: 'no_session', message: 'The sign-in has ended; sign in again' });
    await expect(getApi().status()).rejects.toMatchObject({ code: 'no_session' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('a config.json from the proxy sign-in days is reported, and the form still works', async () => {
    routes['GET /config.json'] = () => reply(200, { proxy: { apiBase: '/web-api', headers: { 'X-PLL-Web': '1' } } });
    const { auth, restore, screen } = await fresh();
    expect(await restore()).toBe(false);
    expect(auth.error).toMatch(/"proxy" was removed/);
    expect(screen(true)).toBe('login');
    expect(callsTo('GET /api/v1/session')).toHaveLength(1);
    expect(calls.some((c) => c.key.includes('/web-api'))).toBe(false);
  });
});

describe('an active session', () => {
  async function signedInAdmin() {
    routes['GET /api/v1/session'] = () => reply(200, signedIn('ADMIN'));
    const mod = await fresh();
    await mod.restore();
    return mod;
  }

  it('ends with a message when the hub says the sign-in is over', async () => {
    routes['GET /api/v1/status'] = () => reply(401, { error: 'no_session', message: 'The sign-in has ended; sign in again' });
    const { auth, getApi, screen } = await signedInAdmin();

    await expect(getApi().status()).rejects.toMatchObject({ status: 401, code: 'no_session' });
    expect(auth).toMatchObject({ signedIn: false, admin: false, user: '', hub: null });
    expect(auth.error).toMatch(/sign-in has ended/i);
    expect(getApi()).toBeNull();
    expect(screen(true)).toBe('login');
  });

  it('stays signed in when a call is refused for another reason', async () => {
    routes['GET /api/v1/users'] = () => reply(403, { error: 'forbidden', message: 'Your role does not allow GET /api/v1/users' });
    routes['PUT /api/v1/me/password'] = () => reply(400, { error: 'wrong_password', message: 'The current password is wrong' });
    const { auth, changePassword, getApi } = await signedInAdmin();

    await expect(getApi().users()).rejects.toMatchObject({ status: 403 });
    await expect(changePassword({ currentPassword: 'wrong', newPassword: NEW_PASSWORD })).rejects.toMatchObject({ code: 'wrong_password' });
    expect(auth.signedIn).toBe(true);
    expect(getApi()).not.toBeNull();
  });

  it('leaves the dashboard for the sign-in page when the browser is no longer on the internal network', async () => {
    const { auth, getApi, screen } = await signedInAdmin();
    routes['GET /api/v1/status'] = () => reply(403, { error: 'outside_not_allowed', message: 'Access from outside the internal network is not allowed' });
    routes['GET /api/v1/session'] = () =>
      reply(200, { signedIn: false, passwordSignIn: false, provider: { label: 'Sign in with Keycloak', startUrl: 'https://m.example/s' } });

    await expect(getApi().status()).rejects.toMatchObject({ status: 403, code: 'outside_not_allowed' });
    expect(auth).toMatchObject({ signedIn: false, user: '', error: 'Your sign-in has ended. Sign in again.' });
    expect(getApi()).toBeNull();
    expect(screen(true)).toBe('login');
    // ... with what the hub offers from here now.
    await vi.waitFor(() => expect(auth.access.provider?.label).toBe('Sign in with Keycloak'));
  });

  it('Sign out asks the hub to end the sign-in, then shows the form', async () => {
    routes['DELETE /api/v1/session'] = () => reply(204);
    const { auth, getApi, logout, screen } = await signedInAdmin();

    await logout();
    const [del] = callsTo('DELETE /api/v1/session');
    expect(del.init.headers['X-Svcmon-Request']).toBe('1');
    expect(del.init.credentials).toBe('same-origin');
    expect(auth).toMatchObject({ signedIn: false, admin: false, error: '' });
    expect(getApi()).toBeNull();
    expect(screen(true)).toBe('login');
  });

  it('Sign out still leaves the dashboard when the hub cannot be reached, and says the sign-in may live on', async () => {
    routes['DELETE /api/v1/session'] = () => {
      throw new TypeError('Failed to fetch');
    };
    const { auth, getApi, logout } = await signedInAdmin();
    await logout();
    expect(auth.signedIn).toBe(false);
    expect(getApi()).toBeNull();
    expect(auth.error).toMatch(/could not be reached/);
  });
});

describe('with an identity provider', () => {
  const PROVIDER = { label: 'Sign in with Keycloak', startUrl: 'https://monitor.example/api/v1/oidc/start' };
  const outside = (extra = {}) => ({
    signedIn: false,
    passwordSignIn: false,
    provider: PROVIDER,
    ...extra,
  });

  it('offers the provider and, from outside, no password form', async () => {
    routes['GET /api/v1/session'] = () => reply(200, outside());
    const { auth, restore, screen } = await fresh();
    await restore();
    expect(auth.access).toEqual({ passwordSignIn: false, provider: PROVIDER });
    expect(screen(true)).toBe('login');

    routes['GET /api/v1/session'] = () => reply(200, outside({ passwordSignIn: true }));
    const inside = await fresh();
    await inside.restore();
    expect(inside.auth.access).toMatchObject({ passwordSignIn: true, provider: PROVIDER });
  });

  it('an older hub that says nothing about either still gets the password form', async () => {
    routes['GET /api/v1/session'] = () => reply(200, { signedIn: false, network: 'inside', address: '10.0.0.5', signInAllowed: true });
    const { auth, restore } = await fresh();
    await restore();
    expect(auth.access).toMatchObject({ passwordSignIn: true, provider: null });
  });

  it('never follows a start address that is not a web address', async () => {
    routes['GET /api/v1/session'] = () => reply(200, outside({ provider: { ...PROVIDER, startUrl: 'javascript:alert(1)' } }));
    const { auth, restore } = await fresh();
    await restore();
    expect(auth.access.provider).toBeNull();
  });

  it('explains a sign-in that came back with an error, and takes it out of the address', async () => {
    const replaceState = vi.fn();
    vi.stubGlobal('location', { search: '?signin_error=no_role', pathname: '/', hash: '#/settings' });
    vi.stubGlobal('history', { replaceState });
    routes['GET /api/v1/session'] = () => reply(200, outside());
    const { auth, restore } = await fresh();
    await restore();
    expect(auth.error).toMatch(/none of the roles/);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/#/settings');
  });

  it('knows a user who signed in with the provider, who has no password here', async () => {
    routes['GET /api/v1/session'] = () =>
      reply(200, { ...signedIn('ADMIN'), user: { id: 'u1', name: 'alice', role: 'ADMIN', provider: true } });
    const { auth, restore } = await fresh();
    await restore();
    expect(auth).toMatchObject({ signedIn: true, viaProvider: true, admin: true });
  });

  it('Sign out goes on to the provider when the hub names its sign-out', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    routes['GET /api/v1/session'] = () =>
      reply(200, { ...signedIn('ADMIN'), user: { id: 'u1', name: 'alice', role: 'ADMIN', provider: true } });
    routes['DELETE /api/v1/session'] = () =>
      reply(200, { providerSignOut: 'https://auth.example/realms/main/logout?client_id=svcmon' });
    const { auth, logout, restore } = await fresh();
    await restore();
    await logout();
    expect(auth.signedIn).toBe(false);
    expect(assign).toHaveBeenCalledWith('https://auth.example/realms/main/logout?client_id=svcmon');

    routes['DELETE /api/v1/session'] = () => reply(200, { providerSignOut: 'javascript:alert(1)' });
    const again = await fresh();
    await again.restore();
    await again.logout();
    expect(assign).toHaveBeenCalledOnce();
  });

  it('a password sign-in refused outside hides the form and keeps the provider', async () => {
    routes['GET /api/v1/session'] = () => reply(200, outside({ passwordSignIn: true }));
    routes['POST /api/v1/session'] = () =>
      reply(403, { error: 'password_inside_only', message: 'From outside the internal network, sign in with the identity provider' });
    const { auth, restore, screen, signIn } = await fresh();
    await restore();
    await expect(signIn({ username: 'alice', password: PASSWORD })).rejects.toMatchObject({ code: 'password_inside_only' });
    expect(auth.access).toMatchObject({ passwordSignIn: false, provider: PROVIDER });
    expect(screen(true)).toBe('login');
  });

  it('a password sign-in that stops working outside leaves for the provider sign-in, not a refusal', async () => {
    routes['GET /api/v1/session'] = () => reply(200, signedIn('ADMIN'));
    const { auth, getApi, restore, screen } = await fresh();
    await restore();
    routes['GET /api/v1/status'] = () =>
      reply(403, { error: 'password_inside_only', message: 'From outside the internal network, sign in with the identity provider' });
    routes['GET /api/v1/session'] = () => reply(200, outside());

    await expect(getApi().status()).rejects.toMatchObject({ status: 403, code: 'password_inside_only' });
    expect(auth.signedIn).toBe(false);
    expect(auth.error).toBe('Your sign-in has ended. Sign in again.');
    expect(screen(true)).toBe('login');
    await vi.waitFor(() => expect(auth.access.provider).toMatchObject(PROVIDER));
  });
});
