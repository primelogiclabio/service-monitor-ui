// The join key behind the commands on the Add server page. The dashboard makes one for an admin, so nothing has to be
// created or pasted first. It is short-lived (a command left in a shell history stops working), and a long-lived key can
// still be made under "Other ways".

export const ADD_KEY_DAYS = 1;
// A key with less than this left is replaced, so a command copied now is still good when it is run.
const REUSE_MARGIN_MS = 60 * 60 * 1000;

/** What the key is called in the hub's list, for example "Add server 2026-10-24 14:05". */
export function addKeyName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `Add server ${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/**
 * Makes the key on first use and hands the same one back while it has more than an hour left, so opening the page
 * again does not fill the hub's list with keys. It is kept in memory only: a secret is never written to storage.
 * `create` is the API's createJoinKey; `now` is only for tests.
 */
export function createAddKeySource(create, now = () => Date.now()) {
  let key = null;
  let pending = null;

  const usable = () => key && (key.expiresAt == null || key.expiresAt - now() > REUSE_MARGIN_MS);

  return {
    /** The key to use. `fresh` makes a new one even if the last is still good. A failure is not remembered. */
    get({ fresh = false } = {}) {
      if (!fresh && usable()) return Promise.resolve(key);
      pending ??= create({ name: addKeyName(new Date(now())), expiresInDays: ADD_KEY_DAYS })
        .then((made) => (key = made))
        .finally(() => (pending = null));
      return pending;
    },
  };
}

let source = null;
let sourceFor = null;

/** The key source for the signed-in session; a different API client (another hub or token) starts over. */
export function addKeyFor(api) {
  if (sourceFor !== api) {
    sourceFor = api;
    source = createAddKeySource((body) => api.createJoinKey(body));
  }
  return source;
}
