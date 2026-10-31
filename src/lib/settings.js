// What the Settings page shows: its sections by role, and the hub's token list (GET /tokens) sorted into them.

/**
 * In page order. `admin` sections are only for administrators; the hub refuses the rest anyway. `help` is the
 * section's topic in help.js, shown by the page's Help button.
 */
export const SETTINGS_SECTIONS = [
  { key: 'account', label: 'Account', admin: false, help: 'account' },
  { key: 'users', label: 'Users', admin: true, help: 'users' },
  { key: 'agents', label: 'Agents', admin: true, help: 'agents' },
  { key: 'api', label: 'API tokens', admin: true, help: 'apiTokens' },
  { key: 'activity', label: 'Activity', admin: true, help: 'activity' },
  { key: 'access', label: 'Access', admin: false, help: 'access' },
];

export function sectionsFor(admin) {
  return SETTINGS_SECTIONS.filter((s) => admin || !s.admin);
}

/** The section to show for `#/settings/<requested>`: the first one when it is missing or not for this role. */
export function pickSection(requested, admin) {
  const list = sectionsFor(admin);
  return (list.find((s) => s.key === requested) ?? list[0]).key;
}

const AGENT_PREFIX = 'agent:';

/**
 * Splits tokens into `agents` (each server's own credential), `enroll` (one-time tokens that can still register a
 * server: unused and not expired) and `api` (ADMIN and READ tokens, the CLI's and scripts'). Join keys are left out:
 * they live on the Add server page. An agent row gets `server`, the server's current name from `serverNames` (id to
 * name), else the name it had when it registered, and `lastSeen`, when the server last reported (from `serverSeen`):
 * the hub does not note each use of an agent's token, so the token's own `usedAt` says nothing about it.
 */
export function groupTokens(tokens, { now = Date.now(), serverNames = new Map(), serverSeen = new Map() } = {}) {
  const agents = [];
  const enroll = [];
  const api = [];
  for (const t of tokens ?? []) {
    if (t.scope === 'AGENT') {
      const registered = t.name?.startsWith(AGENT_PREFIX) ? t.name.slice(AGENT_PREFIX.length) : t.name;
      agents.push({ ...t, server: serverNames.get(t.serverId) ?? registered, lastSeen: serverSeen.get(t.serverId) ?? null });
    } else if (t.scope === 'ENROLL') {
      if (!t.usedAt && (t.expiresAt == null || t.expiresAt > now)) enroll.push(t);
    } else if (t.scope === 'ADMIN' || t.scope === 'READ') {
      api.push(t);
    }
  }
  const newestFirst = (a, b) => b.createdAt - a.createdAt;
  agents.sort((a, b) => a.server.localeCompare(b.server));
  enroll.sort(newestFirst);
  api.sort(newestFirst);
  return { agents, enroll, api };
}

/** Server id to name, from the hub's roll-up (GET /status). */
export function serverNamesFrom(status) {
  const names = new Map();
  for (const c of status?.clusters ?? []) for (const s of c.servers ?? []) names.set(s.id, s.name);
  return names;
}

/** Server id to when its agent last reported, from the hub's roll-up (GET /status). */
export function serverSeenFrom(status) {
  const seen = new Map();
  for (const c of status?.clusters ?? []) for (const s of c.servers ?? []) if (s.lastSeen) seen.set(s.id, s.lastSeen);
  return seen;
}
