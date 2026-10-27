import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../src/lib/api.js';
import { scopeLabel } from '../src/lib/format.js';
import { JOIN_EXPIRY_CHOICES } from '../src/lib/enroll.js';
import { HELP } from '../src/lib/help.js';

const reply = (status, body) => ({ ok: status < 300, status, statusText: 'x', text: async () => (body === undefined ? '' : JSON.stringify(body)) });

describe('join key API calls', () => {
  it('list, create and revoke at the hub paths', async () => {
    const fetchImpl = vi.fn(async (url, init) => (init.method === 'DELETE' ? reply(204) : reply(200, [])));
    const api = createApi({ fetchImpl });

    await api.joinKeys();
    await api.createJoinKey({ name: 'fleet', cluster: 'prod', expiresInDays: 30 });
    await api.revokeJoinKey('a b/c');

    const calls = fetchImpl.mock.calls.map(([url, init]) => [init.method, url, init.body]);
    expect(calls).toEqual([
      ['GET', '/api/v1/join-keys', undefined],
      ['POST', '/api/v1/join-keys', '{"name":"fleet","cluster":"prod","expiresInDays":30}'],
      ['DELETE', '/api/v1/join-keys/a%20b%2Fc', undefined],
    ]);
  });
});

describe('join key choices and names', () => {
  it('offer no expiry first, then lifetimes the hub accepts', () => {
    expect(JOIN_EXPIRY_CHOICES[0].days).toBeNull();
    for (const c of JOIN_EXPIRY_CHOICES.slice(1)) {
      expect(c.days).toBeGreaterThanOrEqual(1);
      expect(c.days).toBeLessThanOrEqual(3650);
    }
  });

  it('name every token scope, join keys included', () => {
    expect(scopeLabel('JOIN')).toBe('Join key (reusable)');
    expect(scopeLabel('ENROLL')).toBe('Enrollment (one use)');
    expect(scopeLabel('ADMIN')).toBe('Admin');
    expect(scopeLabel('READ')).toBe('Read only');
    expect(scopeLabel('AGENT')).toBe('Agent');
    expect(scopeLabel('NEW')).toBe('NEW');
  });

  it('are explained in the Add server help', () => {
    const text = [...HELP.addServer.steps, ...HELP.addServer.notes].join(' ');
    expect(text).toContain('join key');
    expect(text).toContain('revoke');
  });
});

describe('the Add server guide', () => {
  it('walks through the choice, a new or an existing agent, then checks', () => {
    const [choice, fresh, existing, appear] = HELP.addServer.steps;
    expect(choice).toContain('join key');
    expect(fresh).toContain('install command');
    expect(fresh).toContain('elevated PowerShell');
    expect(existing).toContain('already installed');
    expect(existing).toContain('restart');
    expect(appear).toContain('Add check');
  });
});
