// config.json next to index.html, which an admin may edit in the built files without rebuilding. The dashboard has no
// settings now: it always signs in with the hub's own accounts, also behind a sign-in gateway, so the file may be
// empty ({}) or missing. It is still read, so a leftover setting is reported instead of silently ignored.

function fail(message) {
  return new Error(`config.json: ${message}`);
}

/** Checks the parsed file. Throws a readable message for anything in it, so nothing is ignored without a word. */
export function parseConfig(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw fail('it must be a JSON object');
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'proxy') {
      // What the shipped file used to say: harmless.
      if (value === false || value === null) continue;
      throw fail(
        '"proxy" was removed: the dashboard always signs in with your account on the hub, also behind a sign-in gateway. Remove it from config.json.',
      );
    }
    throw fail(`unknown setting "${key}"`);
  }
  return {};
}

/** Reads ./config.json. A missing or unreadable file means no settings (it is optional); a wrong one throws. */
export async function loadConfig(fetchImpl = (...args) => fetch(...args)) {
  let text;
  try {
    const res = await fetchImpl('./config.json', { cache: 'no-store' });
    if (!res.ok) return {};
    text = await res.text();
  } catch {
    return {};
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return {}; // not JSON, for instance a host that answers every unknown path with the page itself
  }
  return parseConfig(raw);
}
