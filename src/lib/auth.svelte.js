import { createApi } from './api.js';

const KEY = 'sm-auth';

/** Who is signed in. `admin` is discovered from the hub (only ADMIN tokens may list tokens). */
export const auth = $state({ hubUrl: '', token: '', admin: false, hub: null, error: '' });

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
  auth.hubUrl = base;
  auth.token = token.trim();
  auth.admin = admin;
  auth.hub = hub;
  auth.error = '';
  try {
    forget();
    store(remember).setItem(KEY, JSON.stringify({ hubUrl: base, token: token.trim() }));
  } catch {
    // The session still works; it just will not survive a reload.
  }
}

/** Resumes a saved session, if any. Returns true when signed in. */
export async function restore() {
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

export function signOut(message = '') {
  api = null;
  auth.token = '';
  auth.admin = false;
  auth.hub = null;
  auth.error = message;
  forget();
}
