import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  API_SCOPES,
  SETTINGS_SECTIONS,
  TOKEN_NAME_MAX,
  groupTokens,
  pickSection,
  sectionsFor,
  serverNamesFrom,
  serverSeenFrom,
  tokenNameProblem,
} from '../src/lib/settings.js';
import { FIELD_HELP, HELP } from '../src/lib/help.js';

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const token = (id, scope, extra = {}) => ({ id, name: id, scope, serverId: null, createdAt: NOW - HOUR, expiresAt: null, usedAt: null, ...extra });

describe('the sections of Settings', () => {
  it('are Account and Access for a read-only user, and all six for an administrator', () => {
    expect(sectionsFor(false).map((s) => s.key)).toEqual(['account', 'access']);
    expect(sectionsFor(true).map((s) => s.key)).toEqual(['account', 'users', 'agents', 'api', 'activity', 'access']);
    expect(SETTINGS_SECTIONS.every((s) => s.label)).toBe(true);
  });

  it('each have their own help topic', () => {
    const topics = SETTINGS_SECTIONS.map((s) => s.help);
    expect(new Set(topics).size).toBe(topics.length);
    for (const s of SETTINGS_SECTIONS) expect(HELP, s.key).toHaveProperty(s.help);
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

  it("shows when each agent last reported, which the token itself does not record", () => {
    const status = { clusters: [{ name: 'prod', servers: [{ id: 's1', name: 'db01', lastSeen: NOW - 5000 }, { id: 's2', name: 'new' }] }] };
    const seen = serverSeenFrom(status);
    expect([...seen]).toEqual([['s1', NOW - 5000]]);
    const { agents } = groupTokens(
      [{ id: 'a', name: 'agent:db01', scope: 'AGENT', serverId: 's1', createdAt: 1, usedAt: null },
        { id: 'b', name: 'agent:new', scope: 'AGENT', serverId: 's2', createdAt: 2, usedAt: null }],
      { now: NOW, serverSeen: seen },
    );
    expect(agents.map((t) => [t.id, t.lastSeen])).toEqual([['a', NOW - 5000], ['b', null]]);
  });
});

describe('a new API token', () => {
  it('can be read only or admin, as the hub allows, read only first', () => {
    expect(API_SCOPES.map((s) => s.value)).toEqual(['READ', 'ADMIN']);
    expect(API_SCOPES.every((s) => s.label)).toBe(true);
  });

  it('needs a name of 1 to 100 characters, any characters, as the hub does', () => {
    expect(TOKEN_NAME_MAX).toBe(100);
    expect(tokenNameProblem('ops laptop')).toBe('');
    expect(tokenNameProblem('Grafana / prod: read-only ✓')).toBe('');
    expect(tokenNameProblem('x'.repeat(100))).toBe('');
    expect(tokenNameProblem('x'.repeat(101))).toBe('A token name is 1 to 100 characters');
    expect(tokenNameProblem('')).toBe('A token name is 1 to 100 characters');
    expect(FIELD_HELP['token.name'].text).toContain(`1 to ${TOKEN_NAME_MAX} characters`);
  });

  it('is explained in the help, starting with the button and keeping the terminal way', () => {
    const [first, second] = HELP.apiTokens.steps;
    expect(first).toContain('Make token');
    expect(second).toContain('svcmon token create');
  });

  it('is said to outlive the person who made it, wherever that person is managed', () => {
    expect(HELP.apiTokens.notes.join(' ')).toContain('keeps working after the person who made it is disabled or deleted');
    const users = [...HELP.users.fields.map((f) => f.text), ...HELP.users.notes].join(' ');
    expect(users).toContain('API tokens they made keep working');
    expect(users).toContain('revoke the API tokens they made');
    expect(FIELD_HELP['token.name'].text).toContain('after the person who made it leaves');
  });
});

describe('the page', () => {
  const read = (p) => readFileSync(p, 'utf8');

  it('replaces Tokens in the main menu', () => {
    const app = read('src/App.svelte');
    expect(app).toContain("{ name: 'settings', href: '#/settings', label: 'Settings' }");
    expect(app).not.toMatch(/Tokens/);
  });

  it('makes an API token from a form, and still names the terminal way', () => {
    const api = read('src/components/ApiTokens.svelte');
    expect(api).toMatch(/getApi\(\)\.createToken\(/);
    expect(api).toMatch(/<form\b[^>]*\bonsubmit=/);
    expect(api).toContain('maxlength={TOKEN_NAME_MAX}');
    expect(api).toContain('It is shown only now');
    expect(api).toContain('svcmon token create');
  });

  it('shows the new token only in its copy box, and never keeps or logs it', () => {
    const api = read('src/components/ApiTokens.svelte');
    expect(api).not.toMatch(/localStorage|sessionStorage|indexedDB|console\.|document\.cookie/);
    expect(api).not.toMatch(/notify\([^)]*\btoken\b/);
    // Every mention of the token is the copy box or its Copy button, so no other text can carry it.
    const box = api.match(/<div class="copybox">[\s\S]*?<\/div>/)?.[0] ?? '';
    const mentions = (s) => (s.match(/issued\.token/g) ?? []).length;
    expect(mentions(box)).toBeGreaterThan(0);
    expect(mentions(api)).toBe(mentions(box));
  });

  it('warns that a revoked agent leaves its server offline, and how to let it report again', () => {
    const agents = read('src/components/AgentTokens.svelte');
    expect(agents).toContain('so it shows offline. To let that server report again, remove it');
    expect(agents).toContain('href="#/enroll"');
  });
});
