// Optional deployment settings, read from config.json next to index.html (so an admin can edit the built files
// without rebuilding). Without the file, or with "proxy": false, people sign in with a user name and password.
//
// "proxy" is for a deployment where nginx signs the user in: the page calls the proxy's path on its own site, sends
// only the marker headers below and never holds a token. true uses every default.

export const DEFAULT_PROXY = Object.freeze({
  apiBase: '/web-api',
  headers: Object.freeze({ 'X-Web-Client': '1' }),
  signInUrl: '/oauth2/start',
  signOutUrl: '/oauth2/sign_out',
});

const PROXY_KEYS = ['apiBase', 'headers', 'signInUrl', 'signOutUrl'];

function fail(message) {
  return new Error(`config.json: ${message}`);
}

/** A path on this site or an http(s) address; never a script or data URL, since the page navigates to it. */
function address(name, value) {
  if (typeof value !== 'string' || !(/^\/(?!\/)/.test(value) || /^https?:\/\/[^\s/]/.test(value))) {
    throw fail(`"${name}" must be a path starting with / or an http(s) address`);
  }
  return value;
}

function proxySettings(p) {
  if (p === true) return { ...DEFAULT_PROXY, headers: { ...DEFAULT_PROXY.headers } };
  if (typeof p !== 'object' || Array.isArray(p)) throw fail('"proxy" must be true, false or an object');
  for (const key of Object.keys(p)) {
    if (!PROXY_KEYS.includes(key)) throw fail(`unknown setting "proxy.${key}"`);
  }
  const apiBase = address('proxy.apiBase', p.apiBase ?? DEFAULT_PROXY.apiBase).replace(/\/+$/, '');
  if (!apiBase.startsWith('/')) throw fail('"proxy.apiBase" must be a path on this site, starting with /');

  const headers = p.headers ?? DEFAULT_PROXY.headers;
  if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
    throw fail('"proxy.headers" must be an object of header names and values');
  }
  for (const [name, value] of Object.entries(headers)) {
    if (!/^[A-Za-z0-9-]+$/.test(name) || typeof value !== 'string') {
      throw fail(`"proxy.headers" has an invalid entry "${name}"`);
    }
    if (name.toLowerCase() === 'authorization') throw fail('"proxy.headers" must not set Authorization; the proxy adds it');
  }
  return {
    apiBase,
    headers: { ...headers },
    signInUrl: address('proxy.signInUrl', p.signInUrl ?? DEFAULT_PROXY.signInUrl),
    signOutUrl: address('proxy.signOutUrl', p.signOutUrl ?? DEFAULT_PROXY.signOutUrl),
  };
}

/** Turns the parsed file into settings. Throws a readable message for a wrong value, so a typo is not ignored. */
export function parseConfig(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw fail('it must be a JSON object');
  for (const key of Object.keys(raw)) {
    if (key !== 'proxy') throw fail(`unknown setting "${key}"`);
  }
  const p = raw.proxy;
  return { proxy: p === undefined || p === null || p === false ? null : proxySettings(p) };
}

/** Reads ./config.json. A missing or unreadable file means no settings (it is optional); a wrong one throws. */
export async function loadConfig(fetchImpl = (...args) => fetch(...args)) {
  let text;
  try {
    const res = await fetchImpl('./config.json', { cache: 'no-store' });
    if (!res.ok) return { proxy: null };
    text = await res.text();
  } catch {
    return { proxy: null };
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { proxy: null }; // not JSON, for instance a host that answers every unknown path with the page itself
  }
  return parseConfig(raw);
}
