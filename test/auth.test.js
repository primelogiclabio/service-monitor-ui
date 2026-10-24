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
  return { ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

const GOOD = 'svm_a_good-token-0000000000000000000000';
const BAD = 'svm_a_bad-token-00000000000000000000000';

let routes;
let session;
let remembered;

beforeEach(() => {
  session = memoryStorage();
  remembered = memoryStorage();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', remembered);
  routes = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const path = new URL(url, 'http://hub').pathname.replace('/api/v1', '');
      const handler = routes[path];
      return handler ? handler() : reply(404, { message: 'not found' });
    }),
  );
});

afterEach(async () => {
  const { signOut } = await import('../src/lib/auth.svelte.js');
  signOut('');
  vi.unstubAllGlobals();
});

const hubOk = () => reply(200, { hubId: 'h1', version: '0.1.0' });
const rejected = () => reply(401, { error: 'unauthorized', message: 'A valid bearer token is required' });

describe('login', () => {
  it('a rejected token fails the sign-in without a session banner', async () => {
    routes['/hub'] = rejected;
    const { auth, login } = await import('../src/lib/auth.svelte.js');
    await expect(login({ hubUrl: '', token: BAD })).rejects.toMatchObject({ status: 401 });
    expect(auth.error).toBe('');
    expect(auth.token).toBe('');
  });

  it('a failed attempt leaves an existing session alone', async () => {
    routes['/hub'] = hubOk;
    routes['/tokens'] = () => reply(200, []);
    const { auth, getApi, login } = await import('../src/lib/auth.svelte.js');
    await login({ hubUrl: '', token: GOOD });

    routes['/hub'] = rejected;
    await expect(login({ hubUrl: '', token: BAD })).rejects.toMatchObject({ status: 401 });
    expect(auth.token).toBe(GOOD);
    expect(auth.error).toBe('');
    expect(getApi()).not.toBeNull();
    expect(session.getItem('sm-auth')).toContain(GOOD);
  });

  it('an ADMIN token starts an admin session kept for this tab only', async () => {
    routes['/hub'] = hubOk;
    routes['/tokens'] = () => reply(200, []);
    const { auth, login } = await import('../src/lib/auth.svelte.js');
    await login({ hubUrl: 'http://hub:8080/', token: ` ${GOOD} `, remember: false });
    expect(auth.token).toBe(GOOD);
    expect(auth.admin).toBe(true);
    expect(auth.hubUrl).toBe('http://hub:8080');
    expect(auth.hub.hubId).toBe('h1');
    expect(session.getItem('sm-auth')).toContain(GOOD);
    expect(remembered.getItem('sm-auth')).toBeNull();
  });

  it('remembering moves the token to local storage', async () => {
    routes['/hub'] = hubOk;
    routes['/tokens'] = () => reply(200, []);
    const { login } = await import('../src/lib/auth.svelte.js');
    await login({ hubUrl: '', token: GOOD, remember: true });
    expect(remembered.getItem('sm-auth')).toContain(GOOD);
    expect(session.getItem('sm-auth')).toBeNull();
  });

  it('a READ token signs in without admin rights', async () => {
    routes['/hub'] = hubOk;
    routes['/tokens'] = () => reply(403, { error: 'forbidden', message: 'scope' });
    const { auth, login } = await import('../src/lib/auth.svelte.js');
    await login({ hubUrl: '', token: GOOD });
    expect(auth.token).toBe(GOOD);
    expect(auth.admin).toBe(false);
  });

  it('an unexpected error while checking admin rights fails the sign-in', async () => {
    routes['/hub'] = hubOk;
    routes['/tokens'] = () => reply(500, { message: 'boom' });
    const { auth, getApi, login } = await import('../src/lib/auth.svelte.js');
    await expect(login({ hubUrl: '', token: GOOD })).rejects.toMatchObject({ status: 500 });
    expect(auth.token).toBe('');
    expect(getApi()).toBeNull();
  });
});

describe('an active session', () => {
  it('ends with a message when the hub starts rejecting its token', async () => {
    routes['/hub'] = hubOk;
    routes['/tokens'] = () => reply(200, []);
    routes['/status'] = rejected;
    const { auth, getApi, login } = await import('../src/lib/auth.svelte.js');
    await login({ hubUrl: '', token: GOOD, remember: true });

    await expect(getApi().status()).rejects.toMatchObject({ status: 401 });
    expect(auth.token).toBe('');
    expect(auth.error).toMatch(/rejected/i);
    expect(getApi()).toBeNull();
    expect(remembered.getItem('sm-auth')).toBeNull();
  });
});
