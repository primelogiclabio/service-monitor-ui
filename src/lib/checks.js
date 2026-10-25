// Helpers shared by the check form and the check actions.

/** Turns a stored check into the payload the hub's PUT endpoint expects, with optional overrides. */
export function defToRequest(def, overrides = {}) {
  const body = {
    name: def.name,
    type: def.type,
    config: def.config ?? {},
    intervalSeconds: def.intervalSeconds,
    timeoutMs: def.timeoutMs,
    failuresBeforeDown: def.failuresBeforeDown,
    runFrom: def.runFrom,
    enabled: def.enabled,
  };
  if (def.target) body.target = def.target;
  if (def.serverId) body.serverId = def.serverId;
  return { ...body, ...overrides };
}

/** A check that is switched on and reporting DOWN (the red X). A disabled check shows as Disabled, whatever it last said. */
export function isDown(check) {
  return Boolean(check?.enabled) && check.status === 'DOWN';
}

/** The thresholds the agent applies when a check does not set its own. */
export function defaultThresholds(type) {
  if (type === 'DISK') return { warn: 80, crit: 90 };
  if (type === 'CPU' || type === 'MEMORY') return { warn: 85, crit: 95 };
  return null;
}

export function thresholdsFor(type, config) {
  const d = defaultThresholds(type);
  if (!d) return { warn: null, crit: null };
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return { warn: num(config?.warn, d.warn), crit: num(config?.crit, d.crit) };
}

export const TARGET_HELP = {
  HTTP: { label: 'URL', placeholder: 'https://example.com/health', hint: 'Must start with http:// or https://' },
  TCP: { label: 'Host and port', placeholder: 'db01:5432', hint: 'IPv6 as [::1]:80' },
  PING: { label: 'Host', placeholder: '10.0.0.5', hint: 'A host name or IP address' },
  SERVICE: {
    label: 'Service name',
    placeholder: 'W3SVC',
    hint: 'Windows service name, systemd unit (nginx.service) or launchd label. List them on the server with: svcmon agent services',
  },
  DISK: { label: 'Volume or path', placeholder: 'C:\\  or  /var', hint: 'The drive letter or mount point to watch' },
};
