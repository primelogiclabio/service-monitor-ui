import { createApi } from './api.js';
import { loadConfig } from './config.js';

const KEY = 'sm-auth';
const REDIRECT_KEY = 'sm-signin-redirect';
/** A second automatic redirect to the sign-in page this soon means signing in is not taking effect: stop looping. */
const REDIRECT_GUARD_MS = 30_000;

/**
 * Who is signed in. `admin` is discovered from the hub (only ADMIN tokens may list tokens).
 * `mode` is 'token' (an API token pasted by the user) or 'proxy' (nginx signs the user in and adds the credential,
 * so the page holds none). In proxy mode a visitor who is not signed in sees a gate: `gate` says why
 * ('signin', 'forbidden' or 'unreachable') and `error` carries the hub's message.
 */
export const auth = $state({
  hubUrl: '',
  token: '',
  admin: false,
  hub: null,
  error: '',
  signedIn: false,
  mode: 'token',
  user: '',
  proxy: null,
  gate: '',
  redirecting: false,
});

let api = null;

/** The API client for the current session, or null when signed out. */
export function getApi() {
  return api;
}

function normalizeUrl(url) {
  return (url ?? '').trim().replace(/\/+$/, '');
}

function store(remember) {
  return remember ? localStorage : sessionStorage;
}

function forget() {
  for (const s of [sessionStorage, localStorage]) {
    try {
      s.removeItem(KEY);
    } catch {
      // storage unavailable
    }
  }
}

/** Verifies a token against the hub and starts a session. Throws with a readable message on failure. */
export async function login({ hubUrl, token, remember = false }) {
  const base = normalizeUrl(hubUrl);
  const candidate = createApi({
    base,
    token: token.trim(),
    // Only a client that became the active session can end it. A rejected sign-in attempt is reported
    // to the sign-in form by login() throwing, and must not touch an existing session or add a banner.
    onUnauthorized: () => {
      if (api === candidate) signOut('Your session was rejected by the hub. Sign in again.');
    },
  });
  const hub = await candidate.hub();

  let admin = false;
  try {
    await candidate.tokens();
    admin = true;
  } catch (e) {
    if (e.status !== 403) throw e; // 403 just means a READ token
  }

  api = candidate;
  auth.mode = 'token';
  auth.signedIn = true;
  auth.hubUrl = base;
  auth.token = token.trim();
  auth.user = '';
  auth.admin = admin;
  auth.hub = hub;
  auth.error = '';
  auth.gate = '';
  try {
    forget();
    store(remember).setItem(KEY, JSON.stringify({ hubUrl: base, token: token.trim() }));
  } catch {
    // The session still works; it just will not survive a reload.
  }
}

/** Resumes a saved session, or finds the proxy's. Returns true when signed in. */
export async function restore() {
  let config;
  try {
    config = await loadConfig();
  } catch (e) {
    auth.error = e.message; // a wrong config.json is shown on the sign-in page, not ignored
    config = { proxy: null };
  }
  if (config.proxy) return startProxy(config.proxy, { auto: true });

  let saved = null;
  for (const s of [sessionStorage, localStorage]) {
    try {
      const raw = s.getItem(KEY);
      if (raw) {
        saved = { ...JSON.parse(raw), remember: s === localStorage };
        break;
      }
    } catch {
      // ignore unreadable storage
    }
  }
  if (!saved?.token) return false;
  try {
    await login(saved);
    return true;
  } catch (e) {
    auth.error = e.message;
    return false;
  }
}

/**
 * Behind a sign-in proxy: asks the hub who this is. 401 means no session (sent to the sign-in page, once), 403 that
 * the account may not use the hub, anything else that the hub could not be reached.
 */
export async function startProxy(settings, { auto = false } = {}) {
  const candidate = createApi({
    proxy: settings,
    onUnauthorized: () => {
      if (api === candidate) endProxySession('signin', 'Your session has ended. Sign in again.');
    },
  });
  try {
    const me = await candidate.me();
    const hub = await candidate.hub();
    api = candidate;
    auth.mode = 'proxy';
    auth.proxy = settings;
    auth.signedIn = true;
    auth.token = '';
    auth.hubUrl = '';
    auth.user = me.name ?? '';
    auth.admin = me.scope === 'ADMIN';
    auth.hub = hub;
    auth.error = '';
    auth.gate = '';
    auth.redirecting = false;
    return true;
  } catch (e) {
    api = null;
    auth.mode = 'proxy';
    auth.proxy = settings;
    auth.signedIn = false;
    auth.user = '';
    auth.hub = null;
    auth.admin = false;
    auth.gate = e.status === 401 ? 'signin' : e.status === 403 ? 'forbidden' : 'unreachable';
    auth.error = e.status === 401 ? '' : e.message;
    auth.redirecting = auth.gate === 'signin' && auto && redirectToSignIn({ guarded: true });
    return false;
  }
}

function endProxySession(gate, message) {
  api = null;
  auth.signedIn = false;
  auth.admin = false;
  auth.hub = null;
  auth.user = '';
  auth.gate = gate;
  auth.error = message;
  auth.redirecting = false;
}

/**
 * Goes to the proxy's sign-in page, which returns here afterwards. Guarded, it refuses to do so twice in a row
 * within a short time, so a sign-in that does not take effect shows the gate instead of looping.
 * Returns true when it navigated.
 */
export function redirectToSignIn({ guarded = false } = {}) {
  const url = auth.proxy?.signInUrl;
  if (!url) return false;
  if (guarded) {
    try {
      const last = Number(sessionStorage.getItem(REDIRECT_KEY) || 0);
      if (Date.now() - last < REDIRECT_GUARD_MS) return false;
    } catch {
      // without storage there is no guard; a single redirect is still the likely outcome
    }
  }
  try {
    sessionStorage.setItem(REDIRECT_KEY, String(Date.now()));
  } catch {
    // see above
  }
  location.assign(`${url}${url.includes('?') ? '&' : '?'}rd=${encodeURIComponent(location.href)}`);
  return true;
}

/** The Sign out button: in proxy mode the proxy owns the session, so leave through its sign-out address. */
export function logout() {
  if (auth.mode === 'proxy') {
    const url = auth.proxy?.signOutUrl;
    api = null;
    auth.signedIn = false;
    auth.gate = 'signedout';
    auth.error = '';
    if (url) location.assign(url);
    return;
  }
  signOut();
}

export function signOut(message = '') {
  api = null;
  auth.signedIn = false;
  auth.token = '';
  auth.admin = false;
  auth.hub = null;
  auth.error = message;
  forget();
}
