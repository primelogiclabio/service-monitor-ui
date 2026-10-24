// Pure helpers: formatting and small calculations. No DOM, so they are easy to test.

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const RANGES = [
  { key: '1h', label: '1 hour', ms: HOUR },
  { key: '6h', label: '6 hours', ms: 6 * HOUR },
  { key: '24h', label: '24 hours', ms: DAY },
  { key: '7d', label: '7 days', ms: 7 * DAY },
];

export function rangeMs(key) {
  return (RANGES.find((r) => r.key === key) ?? RANGES[1]).ms;
}

/** "5s ago", "3m ago", "2h ago", "4d ago". */
export function ago(ms, now = Date.now()) {
  if (ms == null) return 'never';
  const d = now - ms;
  if (d < 0) return 'just now';
  if (d < MIN) return `${Math.floor(d / SEC)}s ago`;
  if (d < HOUR) return `${Math.floor(d / MIN)}m ago`;
  if (d < 2 * DAY) return `${Math.floor(d / HOUR)}h ago`;
  return `${Math.floor(d / DAY)}d ago`;
}

export function fmtDateTime(ms) {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

export function fmtClock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtPct(v) {
  return v == null ? '–' : `${(Math.round(v * 10) / 10).toFixed(1)}%`;
}

export function fmtLatency(ms) {
  if (ms == null) return '–';
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Value text for a chart axis or tooltip, given the chart's unit. */
export function fmtValue(v, unit) {
  return unit === '%' ? fmtPct(v) : fmtLatency(v);
}

export function fmtAxis(v, unit) {
  if (unit === '%') return `${v}%`;
  if (v >= 1000) return `${Math.round((v / 1000) * 10) / 10}s`;
  return `${Math.round(v * 10) / 10}ms`;
}

/** The reading shown beside a check: a percentage for host metrics, latency for network checks. */
export function reading(check) {
  if (check.value != null) return fmtPct(check.value);
  if (check.latencyMs != null) return fmtLatency(check.latencyMs);
  return '';
}

export const STATUS_RANK = { UP: 0, UNKNOWN: 1, WARN: 2, DOWN: 3 };

export function worst(statuses) {
  let w = null;
  for (const s of statuses) if (w == null || STATUS_RANK[s] > STATUS_RANK[w]) w = s;
  return w ?? 'UNKNOWN';
}

export function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many;
}

/**
 * The line a dashboard leads with. `data` is the hub's /status response.
 * Returns { tone, text } where tone is a status (UP, WARN, DOWN, UNKNOWN).
 */
export function headline(data) {
  if (!data) return { tone: 'UNKNOWN', text: 'Connecting to the hub' };
  const servers = data.clusters.flatMap((c) => c.servers);
  const totalChecks = data.summary.checks.up + data.summary.checks.warn + data.summary.checks.down + data.summary.checks.unknown;
  if (servers.length === 0 && totalChecks === 0) return { tone: 'UNKNOWN', text: 'Nothing is monitored yet' };

  const offline = servers.filter((s) => !s.agentOnline).length;
  const down = data.summary.checks.down;
  const warn = data.summary.checks.warn;
  const overall = data.summary.overall;
  if (overall === 'UP') return { tone: 'UP', text: 'All systems operational' };

  const parts = [];
  if (down) parts.push(`${down} ${plural(down, 'check')} down`);
  if (offline) parts.push(`${offline} ${plural(offline, 'server')} offline`);
  if (warn) parts.push(`${warn} ${plural(warn, 'warning')}`);
  if (parts.length === 0) return { tone: overall, text: 'Waiting for data' };
  return { tone: overall, text: parts.join(', ') };
}

/**
 * Turns the hub's newest-first results into ascending chart points for one field
 * ("value" or "latencyMs"). Rows without that field are dropped.
 */
export function toPoints(results, field) {
  const pts = [];
  for (const r of results) if (r[field] != null) pts.push({ ts: r.ts, value: r[field] });
  pts.sort((a, b) => a.ts - b.ts);
  return pts;
}

/** A check's message without a leading "<name or target>: " that the row already shows. */
export function cleanMessage(check) {
  const msg = check.message ?? '';
  for (const prefix of [check.target, check.name]) {
    if (prefix && msg.startsWith(`${prefix}: `)) return msg.slice(prefix.length + 2);
  }
  return msg;
}

export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Which charts a check type gets. */
export function chartKind(type) {
  if (type === 'CPU' || type === 'MEMORY' || type === 'DISK') return { field: 'value', unit: '%' };
  if (type === 'HTTP' || type === 'TCP' || type === 'PING') return { field: 'latencyMs', unit: 'ms' };
  return null; // SERVICE and anything else: a status strip instead of a chart
}

export const AGENT_ONLY_TYPES = ['SERVICE', 'CPU', 'MEMORY', 'DISK'];
export const CHECK_TYPES = ['HTTP', 'TCP', 'PING', 'SERVICE', 'CPU', 'MEMORY', 'DISK'];
