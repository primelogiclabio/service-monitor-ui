import { isRefusal } from './access.js';
import { ApiError, createApi } from './api.js';
import { loadConfig } from './config.js';

const REDIRECT_KEY = 'sm-signin-redirect';
/** A second automatic redirect to the sign-in page this soon means signing in is not taking effect: stop looping. */
const REDIRECT_GUARD_MS = 30_000;
/** What earlier versions kept in this browser: an API token (!) and the sign-in form's last choice. */
const OLD_KEYS = ['sm-auth', 'sm-login-mode'];

export const SESSION_ENDED = 'Your sign-in has ended. Sign in again.';

/**
 * Who is signed in. `mode` is 'session' (the hub's own user sign-in: a cookie the page cannot read, so the page keeps
 * no credential) or 'proxy' (nginx signs the user in and adds the credential). `signedIn` means the dashboard may be
 * used; a user whose password must be changed first has `mustChangePassword` instead, and can do only that.
 * `role` is 'ADMIN' or 'READ' and `admin` says which.
 *
 * In proxy mode a visitor who is not signed in sees a gate: `gate` says why ('signin', 'forbidden' or 'unreachable')
 * and `error` carries the hub's message. When nothing answers as the proxy ('unreachable'), the page falls back to
 * `mode` 'session' so the password form stays usable; `fallback` then says why, in words for the sign-in page, and
 * `proxy` is kept so the page can offer to try the proxy again.
 *
 * `access` is how the hub sees this browser, from GET /session: `{ network, address, signInAllowed, refusal }`, where
 * `refusal` is the hub's code ('outside_not_allowed' or 'insecure_transport') when it does not let people in from
 * here. It is null when the hub did not say (an older hub).
 */
export const auth = $state({
  admin: false,
  role: '',
  hub: null,
  error: '',
  signedIn: false,
  mustChangePassword: false,
  mode: 'session',
  user: '',
  proxy: null,
  gate: '',
  redirecting: false,
  fallback: '',
  access: null,
});

let api = null;

/**
 * Which screen the page shows: 'loading', 'gate' (behind a proxy, not signed in), 'refused' (the hub does not let
 * people in from where this browser is), 'login', 'change-password' or 'app'.
 * While the page is being sent to the proxy's sign-in page it stays on 'loading', so no sign-in screen flashes up
 * before the redirect.
 */
export function screen(ready) {
  if (!ready || auth.redirecting) return 'loading';
  if (auth.signedIn) return 'app';
  if (auth.mustChangePassword) return 'change-password';
  if (auth.mode === 'proxy') return 'gate';
  return auth.access?.refusal ? 'refused' : 'login';
}

/**
 * The browser brought this page back from its cache (the Back button from the sign-in page): the redirect it was
 * waiting for is over, so show the gate with its Sign in button instead of "Loading…" for good.
 */
export function redirectEnded() {
  auth.redirecting = false;
}

/** The API client for the current session, or null when signed out. */
export function getApi() {
  return api;
}

function forgetOldKeys() {
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const store = globalThis[name];
      for (const key of OLD_KEYS) store.removeItem(key);
    } catch {
      // storage unavailable: then nothing was kept there either
    }
  }
}

function sessionClient() {
  const client = createApi({
    // Only a client that became the active session can end it. A rejected sign-in attempt is reported to the form by
    // signIn() throwing, and must not touch an existing session or add a banner.
    onUnauthorized: () => {
      if (api === client) signOut(SESSION_ENDED);
    },
    onRefused: (code) => {
      if (api === client) refuse(code);
    },
  });
  return client;
}

/** What GET or POST /session said about this browser's network, or null when the hub did not say. */
function accessFrom(state) {
  if (!state?.network) return null;
  return {
    network: state.network,
    address: state.address ?? '',
    signInAllowed: state.signInAllowed !== false,
    refusal: state.signInRefusal ?? '',
  };
}

function markRefused(code) {
  auth.access = { ...(auth.access ?? { network: 'outside', address: '' }), signInAllowed: false, refusal: code };
}

/**
 * The hub refused a request because of where this browser is (it left the internal network, say). Nothing else will
 * work from here, so show the refusal instead of a dashboard full of errors, and ask the hub for the current address.
 */
function refuse(code) {
  signOut();
  markRefused(code);
  sessionClient()
    .session()
    .then((state) => {
      if (!auth.signedIn && accessFrom(state)) auth.access = accessFrom(state);
    })
    .catch(() => {});
}

/** Makes `client` the session the hub described in `state` (the body of GET or POST /session). */
async function adopt(client, state) {
  const must = Boolean(state.mustChangePassword);
  // The version and the hub's warnings are extras; the dashboard works without them. Until the password is changed
  // the hub answers nothing else anyway.
  const hub = must ? null : await client.hub().catch(() => null);
  api = client;
  auth.mode = 'session';
  auth.user = state.user?.name ?? '';
  auth.role = state.user?.role ?? '';
  auth.admin = auth.role === 'ADMIN';
  auth.mustChangePassword = must;
  auth.signedIn = !must;
  if (state.network) auth.access = accessFrom(state);
  auth.hub = hub;
  auth.error = '';
  auth.gate = '';
  auth.redirecting = false;
}

/** Signs in with a user name and password. Throws an ApiError (with the hub's `code`) when the hub refuses. */
export async function signIn({ username, password }) {
  const client = sessionClient();
  let state;
  try {
    state = await client.signIn({ username: username.trim(), password });
  } catch (e) {
    // The browser is somewhere the hub does not let people in from: show that, not a form that cannot work.
    if (e.status === 403 && isRefusal(e.code)) markRefused(e.code);
    throw e;
  }
  if (!state?.signedIn) throw new ApiError(500, 'The hub did not sign you in');
  await adopt(client, state);
}

/**
 * Changes the signed-in user's own password. The hub renews the sign-in itself; a user who had to change it may now
 * go on to the dashboard. Errors (`wrong_password`, `weak_password`, `same_password`) are thrown and leave the user
 * signed in.
 */
export async function changePassword({ currentPassword, newPassword }) {
  const client = api;
  if (!client) throw new ApiError(401, SESSION_ENDED, 'no_session');
  await client.changePassword({ currentPassword, newPassword });
  if (auth.mustChangePassword) await adopt(client, { user: { name: auth.user, role: auth.role }, mustChangePassword: false });
}

/**
 * Finds the proxy's session, or the hub's own sign-in. Returns true when signed in. When a proxy is set but nothing
 * answers as one (the hub reached on its own address through an SSH tunnel, or the sign-in service is down), the
 * password sign-in takes over, so the dashboard is never stuck behind a gate with no way in.
 */
export async function restore() {
  forgetOldKeys();
  let config;
  try {
    config = await loadConfig();
  } catch (e) {
    auth.error = e.message; // a wrong config.json is shown on the sign-in page, not ignored
    config = { proxy: null };
  }
  if (config.proxy) {
    if (await startProxy(config.proxy, { auto: true })) return true;
    if (auth.gate !== 'unreachable') return false; // 401 and 403 are the proxy answering: its gate is the way on
    auth.mode = 'session';
    auth.gate = '';
    auth.error = '';
  }
  return resumeSession();
}

/** Asks the hub whether this browser is signed in already. */
async function resumeSession() {
  const client = sessionClient();
  let state;
  try {
    state = await client.session();
  } catch (e) {
    // Only an unreachable hub is worth a banner; any other answer just means there is nothing to resume.
    if (e.status === 0) auth.error = e.message;
    return false;
  }
  auth.access = accessFrom(state);
  if (!state?.signedIn) return false;
  await adopt(client, state);
  return auth.signedIn;
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
    // A host that answers every path with the page itself gives 200 and no JSON: that is no proxy either.
    if (!me || typeof me !== 'object') throw new ApiError(404, 'No sign-in service answered');
    const hub = await candidate.hub();
    api = candidate;
    auth.mode = 'proxy';
    auth.proxy = settings;
    auth.signedIn = true;
    auth.mustChangePassword = false;
    auth.user = me.name ?? '';
    auth.role = me.scope ?? '';
    auth.admin = me.scope === 'ADMIN';
    auth.hub = hub;
    auth.error = '';
    auth.gate = '';
    auth.fallback = '';
    auth.redirecting = false;
    return true;
  } catch (e) {
    api = null;
    auth.mode = 'proxy';
    auth.proxy = settings;
    auth.signedIn = false;
    auth.mustChangePassword = false;
    auth.user = '';
    auth.role = '';
    auth.hub = null;
    auth.admin = false;
    auth.gate = e.status === 401 ? 'signin' : e.status === 403 ? 'forbidden' : 'unreachable';
    auth.error = e.status === 401 ? '' : e.message;
    auth.fallback = auth.gate === 'unreachable' ? unreachableReason(e) : '';
    auth.redirecting = auth.gate === 'signin' && auto && redirectToSignIn({ guarded: true });
    return false;
  }
}

function unreachableReason(e) {
  if (!e.status) return 'the sign-in service did not answer';
  if (e.status === 404) return 'this address has no sign-in service';
  return `the sign-in service answered ${e.status}`;
}

function endProxySession(gate, message) {
  api = null;
  auth.signedIn = false;
  auth.admin = false;
  auth.role = '';
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

/**
 * The Sign out button. In proxy mode the proxy owns the session, so leave through its sign-out address; otherwise
 * the hub ends the sign-in and clears its cookie, which the page cannot do itself.
 */
export async function logout() {
  if (auth.mode === 'proxy') {
    const url = auth.proxy?.signOutUrl;
    api = null;
    auth.signedIn = false;
    auth.gate = 'signedout';
    auth.error = '';
    if (url) location.assign(url);
    return;
  }
  const client = api ?? sessionClient();
  try {
    await client.signOut();
    signOut();
  } catch {
    signOut('The hub could not be reached to end the sign-in. It ends by itself after a while without use.');
  }
}

/** Forgets the session on this page only; see logout() for ending it at the hub. */
export function signOut(message = '') {
  api = null;
  auth.signedIn = false;
  auth.mustChangePassword = false;
  auth.admin = false;
  auth.role = '';
  auth.user = '';
  auth.hub = null;
  auth.error = message;
}
