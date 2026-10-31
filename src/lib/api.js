// Client for the hub's REST API, on this page's own address. A signed-in user is known to the hub by a cookie the page
// never sees, so the page holds no credential at all.

import { endsSignIn } from './access.js';

export class ApiError extends Error {
  constructor(status, message, code = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    /** The hub's error code, such as `wrong_password`; empty when the answer had none. */
    this.code = code;
  }
}

/** The 401 codes that mean the sign-in itself is over. A 401 for anything else (a wrong password) is not. */
const SIGNED_OUT = new Set(['no_session', 'unauthorized']);

/** Every 401 code the hub itself sends. A 401 without one of these came from a gateway in front of the hub. */
const HUB_401 = new Set([...SIGNED_OUT, 'wrong_credentials']);

function query(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/**
 * `onUnauthorized` hears when the hub says the sign-in is over, `onRefused` when it refuses the browser for where it
 * is, and `onGateway` when a sign-in gateway in front of the hub answered instead (its own sign-in ended).
 */
export function createApi({ fetchImpl, onUnauthorized, onRefused, onGateway } = {}) {
  const send = fetchImpl ?? ((...args) => fetch(...args));
  const id = encodeURIComponent;
  const root = '/api/v1';

  /**
   * `background` marks a call the page makes by itself (status polling), which the hub does not count as use, so a
   * page left open still signs out when nobody is at it.
   */
  async function request(method, path, body, { background = false } = {}) {
    // The hub refuses a cookie-signed change without it: a page on another site cannot add it without asking.
    const headers = { Accept: 'application/json', 'X-Svcmon-Request': '1' };
    if (background) headers['X-Svcmon-Background'] = '1';
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await send(`${root}${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new ApiError(0, `Cannot reach the hub (${e.message})`);
    }
    if (res.status === 204) return null;

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // not JSON; fall back to the raw text for the error message
    }
    if (!res.ok) {
      const code = typeof data?.error === 'string' ? data.error : '';
      if (res.status === 401 && SIGNED_OUT.has(code)) onUnauthorized?.();
      if (res.status === 401 && !HUB_401.has(code)) onGateway?.();
      // Refused for where the browser is (it moved off the internal network, say): this sign-in will not work from here.
      if (res.status === 403 && endsSignIn(code)) onRefused?.(code);
      throw new ApiError(res.status, data?.message ?? (text || res.statusText), code);
    }
    return data;
  }

  return {
    request,
    hub: () => request('GET', '/hub'),
    me: () => request('GET', '/me'),
    audit: ({ category, before, limit } = {}) => request('GET', `/audit${query({ category, before, limit })}`),
    access: () => request('GET', '/access'),
    session: () => request('GET', '/session'),
    signIn: (body) => request('POST', '/session', body),
    /** Ends the sign-in; for one made with the identity provider the answer may say where to sign out there too. */
    signOut: () => request('DELETE', '/session'),
    /** How sign-in with the identity provider is set up (administrators). */
    provider: () => request('GET', '/oidc'),
    liveTicket: (opts) => request('POST', '/session/live-ticket', undefined, opts),
    changePassword: (body) => request('PUT', '/me/password', body),
    sessions: () => request('GET', '/sessions'),
    endSession: (sessionId) => request('DELETE', `/sessions/${id(sessionId)}`),
    users: () => request('GET', '/users'),
    createUser: (body) => request('POST', '/users', body),
    updateUser: (userId, patch) => request('PATCH', `/users/${id(userId)}`, patch),
    resetPassword: (userId) => request('POST', `/users/${id(userId)}/password-reset`),
    deleteUser: (userId) => request('DELETE', `/users/${id(userId)}`),
    status: (opts) => request('GET', '/status', undefined, opts),
    checks: () => request('GET', '/checks'),
    check: (checkId) => request('GET', `/checks/${id(checkId)}`),
    createCheck: (body) => request('POST', '/checks', body),
    replaceCheck: (checkId, body) => request('PUT', `/checks/${id(checkId)}`, body),
    deleteCheck: (checkId) => request('DELETE', `/checks/${id(checkId)}`),
    runCheck: (checkId) => request('POST', `/checks/${id(checkId)}/run`),
    results: (checkId, { since, limit } = {}) =>
      request('GET', `/checks/${id(checkId)}/results${query({ since, limit })}`),
    servers: () => request('GET', '/servers'),
    updateServer: (serverId, patch) => request('PATCH', `/servers/${id(serverId)}`, patch),
    deleteServer: (serverId) => request('DELETE', `/servers/${id(serverId)}`),
    tokens: () => request('GET', '/tokens'),
    createToken: (body) => request('POST', '/tokens', body),
    revokeToken: (tokenId) => request('DELETE', `/tokens/${id(tokenId)}`),
    enrollmentToken: (body) => request('POST', '/enrollment-tokens', body),
    joinKeys: () => request('GET', '/join-keys'),
    createJoinKey: (body) => request('POST', '/join-keys', body),
    revokeJoinKey: (keyId) => request('DELETE', `/join-keys/${id(keyId)}`),
  };
}
