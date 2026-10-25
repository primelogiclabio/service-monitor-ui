// Client for the hub's REST API. Takes the hub base URL ('' for same origin) and a bearer token. Behind a sign-in
// proxy there is no token: `proxy` ({ apiBase, headers }) sends the calls to the proxy's path on this site with its
// marker headers, and the proxy adds the credential. The browser never holds one.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function query(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function createApi({ base = '', token = '', proxy = null, fetchImpl, onUnauthorized } = {}) {
  const send = fetchImpl ?? ((...args) => fetch(...args));
  const id = encodeURIComponent;
  const root = proxy ? `${proxy.apiBase}/v1` : `${base}/api/v1`;

  async function request(method, path, body) {
    const headers = { Accept: 'application/json', ...(proxy?.headers ?? {}) };
    if (token && !proxy) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await send(`${root}${path}`, {
        method,
        headers,
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
      if (res.status === 401) onUnauthorized?.();
      throw new ApiError(res.status, data?.message ?? (text || res.statusText));
    }
    return data;
  }

  return {
    request,
    hub: () => request('GET', '/hub'),
    me: () => request('GET', '/me'),
    status: () => request('GET', '/status'),
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
