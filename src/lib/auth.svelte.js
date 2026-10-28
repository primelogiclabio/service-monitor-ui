import { isRefusal } from './access.js';
import { ApiError, createApi } from './api.js';
import { loadConfig } from './config.js';

const RELOAD_KEY = 'sm-gateway-reload';
/** A second automatic reload for the gateway this soon means its sign-in is not taking effect: stop looping. */
const RELOAD_GUARD_MS = 30_000;
/** What earlier versions kept in this browser: an API token (!) and the sign-in form's last choice. */
const OLD_KEYS = ['sm-auth', 'sm-login-mode', 'sm-signin-redirect'];

export const SESSION_ENDED = 'Your sign-in has ended. Sign in again.';
export const GATEWAY_STUCK =
  'The sign-in gateway in front of the hub did not let this page through. Reload the page to sign in at the gateway again.';

/**
 * Who is signed in, with the hub's own sign-in: a cookie the page cannot read, so the page keeps no credential.
 * `signedIn` means the dashboard may be used; a user whose password must be changed first has `mustChangePassword`
 * instead, and can do only that. `role` is 'ADMIN' or 'READ' and `admin` says which.
 *
 * `access` is how the hub sees this browser, from GET /session: `{ network, address, signInAllowed, refusal }`, where
 * `refusal` is the hub's code ('outside_not_allowed' or 'insecure_transport') when it does not let people in from
 * here. It is null when the hub did not say (an older hub).
 *
 * A gateway in front of the hub (Keycloak through nginx, say) is only a gate: it lets the page through, and then the
 * person signs in here as usual. When its sign-in ends, its 401 makes the page reload so the gateway can ask again.
 */
export const auth = $state({
  admin: false,
  role: '',
  hub: null,
  error: '',
  signedIn: false,
  mustChangePassword: false,
  user: '',
  access: null,
});

let api = null;

/** Which screen the page shows: 'loading', 'refused' (the hub does not let people in from where this browser is),
 * 'login', 'change-password' or 'app'. */
export function screen(ready) {
  if (!ready) return 'loading';
  if (auth.signedIn) return 'app';
  if (auth.mustChangePassword) return 'change-password';
  return auth.access?.refusal ? 'refused' : 'login';
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
    onGateway: () => reloadForGateway(),
  });
  return client;
}

/**
 * The gateway in front of the hub answered instead of the hub: its sign-in ended. Reloading the page lets the
 * gateway send the person to its sign-in page and back. Guarded, so a gateway that keeps answering does not make the
 * page reload in a loop: the second time within a short while the page says so instead.
 */
export function reloadForGateway() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GUARD_MS) {
      signOut(GATEWAY_STUCK);
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // without storage there is no guard; a single reload is still the likely outcome
  }
  location.reload();
  return true;
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
  auth.user = state.user?.name ?? '';
  auth.role = state.user?.role ?? '';
  auth.admin = auth.role === 'ADMIN';
  auth.mustChangePassword = must;
  auth.signedIn = !must;
  if (state.network) auth.access = accessFrom(state);
  auth.hub = hub;
  auth.error = '';
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
 * Asks the hub whether this browser is signed in already. Returns true when it is. A wrong config.json is shown on
 * the sign-in page rather than ignored, and the page carries on without it.
 */
export async function restore() {
  forgetOldKeys();
  try {
    await loadConfig();
  } catch (e) {
    auth.error = e.message;
  }
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

/** The Sign out button: the hub ends the sign-in and clears its cookie, which the page cannot do itself. */
export async function logout() {
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
