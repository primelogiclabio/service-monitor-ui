import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, isOk, mergePages, outcomeLabel, whatLabel, whereLabel, whoLabel } from '../src/lib/activity.js';
import { createApi } from '../src/lib/api.js';

const event = (extra) => ({ id: 1, at: 1_800_000_000_000, category: 'change', kind: 'api_call', outcome: 'ok', ...extra });

describe('an audit event in words', () => {
  it('says what a change did, by its route, and keeps the route for a tooltip', () => {
    const e = event({ action: 'DELETE /api/v1/checks/{id}', target: 'c1' });
    expect(whatLabel(e)).toEqual({ what: 'Deleted a check', about: 'c1', call: 'DELETE /api/v1/checks/{id}' });
    expect(whatLabel(event({ action: 'POST /api/v1/users', target: 'dave', detail: 'role READ' })).about).toBe('dave, role READ');
  });

  it('shows a route it has no words for as it is', () => {
    expect(whatLabel(event({ action: 'POST /api/v1/something-new' })).what).toBe('POST /api/v1/something-new');
  });

  it('names sign-in events by their kind', () => {
    expect(whatLabel(event({ category: 'sign_in', kind: 'sign_in' })).what).toBe('Signed in');
    expect(whatLabel(event({ category: 'sign_in', kind: 'refused', action: 'GET /api/v1/status' })).what).toBe('Was refused');
    expect(whatLabel(event({ category: 'change', kind: 'agent_registered', target: 'web09' }))).toMatchObject({
      what: 'A server joined',
      about: 'web09',
      call: '',
    });
  });

  it('says who, with the kind of credential', () => {
    expect(whoLabel(event({ actor: 'alice', actorKind: 'user' }))).toBe('alice');
    expect(whoLabel(event({ actor: 'alice', actorKind: 'jwt' }))).toBe('alice (gateway)');
    expect(whoLabel(event({ actor: 'cli', actorKind: 'token' }))).toBe('API token “cli”');
    expect(whoLabel(event({ actor: 'fleet', actorKind: 'join_key' }))).toBe('Join key “fleet”');
    expect(whoLabel(event({ actor: 'web-token', actorKind: 'enrollment_token' }))).toBe('Enrollment token “web-token”');
    expect(whoLabel(event({ actor: 'users reset', actorKind: 'command_line' }))).toMatch(/users reset/);
    expect(whoLabel(event({ actor: 'unknown', actorKind: 'unknown' }))).toBe('Unknown');
  });

  it('says how it ended, in words for the codes it knows', () => {
    expect(outcomeLabel(event({ outcome: 'ok' }))).toBe('OK');
    expect(outcomeLabel(event({ outcome: 'unknown_user' }))).toBe('No such user');
    expect(outcomeLabel(event({ outcome: 'outside_not_allowed' }))).toBe('From outside the internal network');
    expect(outcomeLabel(event({ outcome: '404' }))).toBe('Failed (404)');
    expect(outcomeLabel(event({ outcome: 'some_new_code' }))).toBe('some new code');
    expect(isOk(event({ outcome: 'ok' }))).toBe(true);
    expect(isOk(event({ outcome: 'forbidden' }))).toBe(false);
  });

  it('says where from, inside or outside', () => {
    expect(whereLabel(event({ address: '10.0.0.7', network: 'inside' }))).toBe('10.0.0.7 (inside)');
    expect(whereLabel(event({ address: null }))).toBe('—');
  });
});

describe('the Activity section', () => {
  it('filters by the hub’s categories, or shows both', () => {
    expect(CATEGORIES.map((c) => c.key)).toEqual(['', 'sign_in', 'change']);
  });

  it('adds an older page below without repeating an event', () => {
    const shown = [event({ id: 5 }), event({ id: 4 })];
    expect(mergePages(shown, [event({ id: 4 }), event({ id: 3 })]).map((e) => e.id)).toEqual([5, 4, 3]);
  });

  it('asks the hub for a page, and for the one before it', async () => {
    const seen = [];
    const api = createApi({ fetchImpl: async (url) => (seen.push(url), { ok: true, status: 200, text: async () => '{"events":[]}' }) });
    await api.audit({ category: 'sign_in', limit: 100 });
    await api.audit({ before: 42, limit: 100 });
    expect(seen).toEqual(['/api/v1/audit?category=sign_in&limit=100', '/api/v1/audit?before=42&limit=100']);
  });

  it('is for administrators, in Settings', () => {
    const settings = readFileSync(new URL('../src/views/Settings.svelte', import.meta.url), 'utf8');
    expect(settings).toContain('<ActivityLog />');
  });
});
