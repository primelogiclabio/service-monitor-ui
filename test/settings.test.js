import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SETTINGS_SECTIONS, groupTokens, pickSection, sectionsFor, serverNamesFrom } from '../src/lib/settings.js';

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const token = (id, scope, extra = {}) => ({ id, name: id, scope, serverId: null, createdAt: NOW - HOUR, expiresAt: null, usedAt: null, ...extra });

describe('the sections of Settings', () => {
  it('are only Account for a read-only user, and all four for an administrator', () => {
    expect(sectionsFor(false).map((s) => s.key)).toEqual(['account']);
    expect(sectionsFor(true).map((s) => s.key)).toEqual(['account', 'users', 'agents', 'api']);
    expect(SETTINGS_SECTIONS.every((s) => s.label)).toBe(true);
  });

  it('open the one the address asks for, if the role allows it', () => {
    expect(pickSection('users', true)).toBe('users');
    expect(pickSection('users', false)).toBe('account');
    expect(pickSection(undefined, true)).toBe('account');
    expect(pickSection('nonsense', true)).toBe('account');
  });
});

describe('the hub token list, sorted for Settings', () => {
  const tokens = [
    token('agent-2', 'AGENT', { name: 'agent:web02', serverId: 's2' }),
    token('agent-1', 'AGENT', { name: 'agent:db01', serverId: 's1' }),
    token('gone', 'AGENT', { name: 'agent:old', serverId: 's9' }),
    token('fresh', 'ENROLL', { expiresAt: NOW + HOUR }),
    token('used', 'ENROLL', { expiresAt: NOW + HOUR, usedAt: NOW - 60_000 }),
    token('expired', 'ENROLL', { expiresAt: NOW - 1 }),
    token('cli', 'ADMIN', { createdAt: NOW - 2 * HOUR }),
    token('grafana', 'READ', { createdAt: NOW - 3 * HOUR }),
    token('fleet', 'JOIN'),
  ];

  it('names each agent by its server, as it is called now', () => {
    const { agents } = groupTokens(tokens, { now: NOW, serverNames: new Map([['s1', 'db01'], ['s2', 'web02 (renamed)']]) });
    expect(agents.map((t) => [t.id, t.server])).toEqual([
      ['agent-1', 'db01'],
      ['gone', 'old'], // not in the roll-up: the name it registered with
      ['agent-2', 'web02 (renamed)'],
    ]);
  });

  it('lists only the one-time tokens that can still register a server', () => {
    expect(groupTokens(tokens, { now: NOW }).enroll.map((t) => t.id)).toEqual(['fresh']);
  });

  it("lists the CLI's and scripts' tokens newest first, and leaves join keys to the Add server page", () => {
    const { api, agents, enroll } = groupTokens(tokens, { now: NOW });
    expect(api.map((t) => t.id)).toEqual(['cli', 'grafana']);
    expect([...api, ...agents, ...enroll].some((t) => t.scope === 'JOIN')).toBe(false);
    expect(groupTokens(undefined)).toEqual({ agents: [], enroll: [], api: [] });
  });

  it('reads server names from the roll-up', () => {
    const status = { clusters: [{ name: 'prod', servers: [{ id: 's1', name: 'db01' }] }, { name: 'dev', servers: [{ id: 's2', name: 'web02' }] }] };
    expect([...serverNamesFrom(status)]).toEqual([['s1', 'db01'], ['s2', 'web02']]);
    expect(serverNamesFrom(null).size).toBe(0);
  });
});

describe('the page', () => {
  const read = (p) => readFileSync(p, 'utf8');

  it('replaces Tokens in the main menu', () => {
    const app = read('src/App.svelte');
    expect(app).toContain("{ name: 'settings', href: '#/settings', label: 'Settings' }");
    expect(app).not.toMatch(/Tokens/);
  });

  it('has no form to create API tokens, and says how they are made', () => {
    const api = read('src/components/ApiTokens.svelte');
    expect(api).not.toMatch(/createToken|<form/);
    expect(api).toContain('svcmon token create');
  });

  it('warns that a revoked agent leaves its server offline until it is enrolled again', () => {
    const agents = read('src/components/AgentTokens.svelte');
    expect(agents).toContain('shows offline until it is enrolled again');
    expect(agents).toContain('href="#/enroll"');
  });
});
