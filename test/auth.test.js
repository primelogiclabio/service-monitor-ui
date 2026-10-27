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
    expect(auth).toMatchObject({ mode: 'session', signedIn: true, user: 'alice', role: 'ADMIN', admin: true, mustChangePassword: false, error: '' });
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
    expect(auth).toMatchObject({ mode: 'session', signedIn: false, error: '' });
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
