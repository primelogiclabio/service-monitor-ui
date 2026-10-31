import { PASSWORD_INSIDE_ONLY } from './access.js';
import { providerSignInMessage, webAddress } from './account.js';
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
 * `access` is what the sign-in page shows, from GET /session: `{ passwordSignIn, provider }`, where `passwordSignIn`
 * says whether it has the password form and `provider` is the identity provider's button (`{ label, startUrl }`) on a
 * hub that has one, else null. Like any sign-in page it does not know beforehand whether a sign-in will be refused for
 * where the browser is; trying tells, and the page says so as it says a wrong password. It never holds whether the
 * hub counts the browser as inside or outside, nor the address it sees (Settings > Access shows those to people
 * signed in). `viaProvider` is true for a user who signs in with the
 * identity provider and so has no password on the hub.
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
  viaProvider: false,
  access: null,
});

/** The query parameter the hub sends the browser back with when a sign-in with the identity provider did not work. */
const SIGNIN_ERROR = 'signin_error';

let api = null;

/** Which screen the page shows: 'loading', 'login', 'change-password' or 'app'. */
export function screen(ready) {
  if (!ready) return 'loading';
  if (auth.signedIn) return 'app';
  if (auth.mustChangePassword) return 'change-password';
  return 'login';
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

/** What GET or POST /session said the sign-in page shows. */
function accessFrom(state) {
  const p = state?.provider;
  const startUrl = webAddress(p?.startUrl);
  return {
    // An older hub does not say, and has no other way in than the password.
    passwordSignIn: state?.passwordSignIn !== false,
    provider: p && startUrl ? { label: p.label || 'Sign in with single sign-on', startUrl } : null,
  };
}

/**
 * The `signin_error` the hub sent the browser back with, if any, taken out of the address so a reload does not show
 * it again. Returns the message for it, or ''.
 */
function takeSignInError() {
  const loc = globalThis.location;
  if (!loc?.search) return '';
  const params = new URLSearchParams(loc.search);
  const code = params.get(SIGNIN_ERROR);
  if (code === null) return '';
  params.delete(SIGNIN_ERROR);
  try {
    const rest = params.toString();
    globalThis.history?.replaceState(null, '', `${loc.pathname}${rest ? `?${rest}` : ''}${loc.hash ?? ''}`);
  } catch {
    // the message is still shown; the parameter stays in the address
  }
  return providerSignInMessage(code);
}

/**
 * The hub refused a request because of where this browser is (it left the internal network, say): this sign-in will
 * not work from here. Back to the sign-in page, as when a sign-in ends, with what the hub offers from here now.
 */
function refuse(code) {
  signOut(SESSION_ENDED);
  // A password sign-in that the hub no longer takes from here: the identity provider's button is the way in.
  if (code === PASSWORD_INSIDE_ONLY && auth.access) auth.access = { ...auth.access, passwordSignIn: false };
  sessionClient()
    .session()
    .then((state) => {
      if (!auth.signedIn) auth.access = accessFrom(state);
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
  auth.viaProvider = Boolean(state.user?.provider);
  auth.admin = auth.role === 'ADMIN';
  auth.mustChangePassword = must;
  auth.signedIn = !must;
  if (state.passwordSignIn !== undefined) auth.access = accessFrom(state);
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
    // From here only the identity provider's sign-in works: hide the form, keep its button.
    if (e.status === 403 && e.code === PASSWORD_INSIDE_ONLY && auth.access) {
      auth.access = { ...auth.access, passwordSignIn: false };
    }
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
  const providerError = takeSignInError();
  const client = sessionClient();
  let state;
  try {
    state = await client.session();
  } catch (e) {
    // Only an unreachable hub is worth a banner; any other answer just means there is nothing to resume.
    if (e.status === 0) auth.error = e.message;
    else if (providerError) auth.error = providerError;
    return false;
  }
  auth.access = accessFrom(state);
  if (!state?.signedIn) {
    if (providerError) auth.error = providerError;
    return false;
  }
  await adopt(client, state);
  return auth.signedIn;
}

/**
 * The Sign out button: the hub ends the sign-in and clears its cookie, which the page cannot do itself. A sign-in made
 * with the identity provider then goes on to the provider's sign-out, when the hub names one, so that ends too.
 */
export async function logout() {
  const client = api ?? sessionClient();
  let answer;
  try {
    answer = await client.signOut();
  } catch {
    signOut('The hub could not be reached to end the sign-in. It ends by itself after a while without use.');
    return;
  }
  signOut();
  const providerSignOut = webAddress(answer?.providerSignOut);
  if (providerSignOut) globalThis.location?.assign(providerSignOut);
}

/** Forgets the session on this page only; see logout() for ending it at the hub. */
export function signOut(message = '') {
  api = null;
  auth.signedIn = false;
  auth.mustChangePassword = false;
  auth.admin = false;
  auth.role = '';
  auth.user = '';
  auth.viaProvider = false;
  auth.hub = null;
  auth.error = message;
}
