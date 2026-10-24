#!/usr/bin/env node
// Fills a THROWAWAY hub with demo servers, checks and history so the dashboard has something to show.
//
//   node scripts/seed-demo.mjs --hub http://127.0.0.1:8080 --token <ADMIN token> [--hours 6] [--live]
//
// It registers fake agents (so it needs a fresh hub: server names must not exist yet), creates checks,
// and posts synthetic history through the real agent protocol. With --live it keeps the online servers
// reporting every 10 seconds, so charts move; start the hub with --svcmon.agent-stale-seconds=25 to see
// the "offline" server drop out quickly. Never point this at a hub that monitors real systems.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const hub = String(args.hub ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
const admin = args.token ?? process.env.SVCMON_TOKEN;
const hours = Math.min(Number(args.hours ?? 6), 23);
const live = Boolean(args.live);
if (!admin || admin === true) {
  console.error('Pass --token <ADMIN token> or set SVCMON_TOKEN.');
  process.exit(2);
}

async function call(method, path, token, body) {
  const res = await fetch(`${hub}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data?.message ?? text}`);
  return data;
}

// --- deterministic synthetic data -------------------------------------------------------------

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
const noise = (key, t) => hash(key + Math.floor(t / 30000)) * 2 - 1; // -1..1, stable per 30s slot
const wave = (t, minutes) => Math.sin((2 * Math.PI * t) / (minutes * 60000));
const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const level = (v, warn, crit) => (v >= crit ? 'DOWN' : v >= warn ? 'WARN' : 'UP');
const round1 = (v) => Math.round(v * 10) / 10;

const SERVERS = [
  { name: 'web01', cluster: 'prod', os: 'Microsoft Windows Server 2022 Standard 21H2 (amd64)', win: true, cpu: 34, mem: 57, disk: 61, service: 'W3SVC', web: true },
  { name: 'web02', cluster: 'prod', os: 'Microsoft Windows Server 2022 Standard 21H2 (amd64)', win: true, cpu: 38, mem: 82, disk: 64, service: 'W3SVC', web: true, cpuRamp: 52, memRise: 6 },
  { name: 'db01', cluster: 'prod', os: 'ubuntu 24.04 (amd64)', cpu: 22, mem: 71, disk: 74, service: 'postgresql.service', serviceDownMinutes: 18 },
  { name: 'cache01', cluster: 'prod', os: 'ubuntu 24.04 (amd64)', cpu: 12, mem: 48, disk: 33, service: 'redis-server.service' },
  { name: 'stage01', cluster: 'staging', os: 'ubuntu 24.04 (amd64)', cpu: 18, mem: 44, disk: 83, service: 'nginx.service', web: true },
  { name: 'build01', cluster: 'staging', os: 'Microsoft Windows 11 Pro (amd64)', win: true, cpu: 9, mem: 39, disk: 55, service: 'Jenkins', offline: true },
];

function checksFor(s) {
  const list = [
    { key: 'service', body: { name: `${s.service}`, type: 'SERVICE', target: s.service } },
    { key: 'cpu', body: { name: 'CPU', type: 'CPU', config: { warn: 80, crit: 95 } } },
    { key: 'mem', body: { name: 'Memory', type: 'MEMORY', config: { warn: 85, crit: 95 } } },
    { key: 'disk', body: { name: s.win ? 'Disk C:' : 'Disk /', type: 'DISK', target: s.win ? 'C:' : '/', config: { warn: 80, crit: 90 } } },
    { key: 'ping', body: { name: 'Gateway ping', type: 'PING', target: '10.0.0.1', runFrom: 'AGENT' } },
  ];
  if (s.web) list.push({ key: 'http', body: { name: 'Local health endpoint', type: 'HTTP', target: `http://${s.name}.internal/health`, runFrom: 'AGENT' } });
  if (s.name.startsWith('web')) list.push({ key: 'tcp', body: { name: 'Database reachable', type: 'TCP', target: 'db01.internal:5432', runFrom: 'AGENT' } });
  return list;
}

// One synthetic reading for a check at time t (ms), `now` being the end of the timeline.
function reading(s, key, t, now) {
  const ageHours = (now - t) / 3600000;
  const n = noise(s.name + key, t);
  switch (key) {
    case 'cpu': {
      const ramp = s.cpuRamp ? clamp(1 - ageHours / 1.2, 0, 1) * s.cpuRamp : 0;
      const v = round1(clamp(s.cpu + 9 * wave(t, 55) + 4 * n + ramp));
      return { status: level(v, 80, 95), value: v, message: `CPU ${v.toFixed(1)}% used` };
    }
    case 'mem': {
      const v = round1(clamp(s.mem + (s.memRise ?? 1.5) * (1 - ageHours / hours) + 1.2 * n));
      return { status: level(v, 85, 95), value: v, message: `memory ${v.toFixed(1)}% used (${(64 * (1 - v / 100)).toFixed(1)} GiB free of 64.0 GiB)` };
    }
    case 'disk': {
      const v = round1(clamp(s.disk + 0.3 * (1 - ageHours / 24)));
      return { status: level(v, 80, 90), value: v, message: `${s.win ? 'C:\\' : '/'} ${v.toFixed(1)}% used` };
    }
    case 'ping': {
      const ms = round1(0.8 + 1.4 * Math.abs(n));
      return { status: 'UP', latencyMs: ms, message: 'reply from 10.0.0.1' };
    }
    case 'http': {
      const spike = hash(s.name + 'spike' + Math.floor(t / 30000)) > 0.985 ? 180 : 0;
      const ms = round1(36 + 16 * Math.abs(n) + spike);
      return { status: 'UP', latencyMs: ms, message: 'HTTP 200' };
    }
    case 'tcp': {
      const ms = round1(1.1 + 2.4 * Math.abs(n));
      return { status: 'UP', latencyMs: ms, message: 'connected to db01.internal:5432' };
    }
    case 'service': {
      const downNow = s.serviceDownMinutes && now - t < s.serviceDownMinutes * 60000;
      const blip = s.name === 'web01' && Math.abs(now - t - 2.4 * 3600000) < 90000; // a 3-minute outage 2.4h ago
      if (downNow || blip) return { status: 'DOWN', message: `${s.service}: ${s.win ? 'stopped' : 'inactive (dead)'}` };
      return { status: 'UP', message: `${s.service}: ${s.win ? 'running' : 'active (running)'}` };
    }
    default:
      throw new Error(`unknown check key ${key}`);
  }
}

// --- seeding -------------------------------------------------------------------------------------

async function post(agent, results) {
  for (let i = 0; i < results.length || i === 0; i += 900) {
    await call('POST', '/agent/report', agent.token, {
      os: agent.server.os,
      agentVersion: '0.1.0',
      results: results.slice(i, i + 900),
    });
    if (results.length === 0) break;
  }
}

async function seedServer(server) {
  const enroll = await call('POST', '/enrollment-tokens', admin, { name: server.name, ttlMinutes: 10 });
  const reg = await call('POST', '/agent/register', enroll.token, {
    name: server.name,
    cluster: server.cluster,
    os: server.os,
    agentVersion: '0.1.0',
  });
  const agent = { server, token: reg.token, id: reg.serverId, checks: [] };
  for (const c of checksFor(server)) {
    const created = await call('POST', '/checks', admin, { ...c.body, serverId: agent.id, intervalSeconds: 30 });
    agent.checks.push({ key: c.key, id: created.id });
  }

  const now = Date.now();
  const results = [];
  for (let t = now - hours * 3600000; t <= now - 1000; t += 30000) {
    for (const c of agent.checks) results.push({ checkId: c.id, ts: Math.floor(t), ...reading(server, c.key, t, now) });
  }
  await post(agent, results);
  console.log(`  ${server.name.padEnd(8)} ${agent.checks.length} checks, ${results.length} historic results${server.offline ? ' (will go offline)' : ''}`);
  return agent;
}

console.log(`Seeding ${hub} with ${hours}h of demo history…`);
const agents = [];
for (const s of SERVERS) agents.push(await seedServer(s));

console.log('Adding hub-run checks…');
const port = new URL(hub).port || '80';
for (const c of [
  { name: 'Hub health endpoint', type: 'HTTP', target: `${hub}/api/v1/health`, intervalSeconds: 5, config: { keyword: 'ok' } },
  { name: 'Hub port', type: 'TCP', target: `127.0.0.1:${port}`, intervalSeconds: 5 },
  { name: 'Loopback ping', type: 'PING', target: '127.0.0.1', intervalSeconds: 10 },
]) {
  await call('POST', '/checks', admin, c);
}
console.log('Done.');

if (live) {
  console.log('Live mode: online servers report every 10s. Ctrl+C to stop.');
  const online = agents.filter((a) => !a.server.offline);
  setInterval(async () => {
    const now = Date.now();
    for (const a of online) {
      try {
        await post(a, a.checks.map((c) => ({ checkId: c.id, ts: now, ...reading(a.server, c.key, now, now) })));
      } catch (e) {
        console.error(`${a.server.name}: ${e.message}`);
      }
    }
  }, 10000);
}
