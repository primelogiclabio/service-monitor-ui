import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../src/lib/api.js';
import { FIELD_HELP, HELP } from '../src/lib/help.js';
import {
  LENGTHS,
  MAX_MINUTES,
  emptyForm,
  fmtUntil,
  formFromWindow,
  maintenanceRequest,
  openedBy,
  windowSummary,
  windowTag,
} from '../src/lib/maintenance.js';

// A window as /status shows it (StatusViews.MaintenanceView on the hub).
const now = new Date(2026, 10, 7, 9, 0).getTime();
const window = {
  serverId: 's1',
  startedAt: now,
  endsAt: new Date(2026, 10, 7, 9, 30).getTime(),
  reason: 'kernel update',
  startedBy: 'alice',
  startedByKind: 'user',
  untilBack: true,
};

describe('maintenanceRequest', () => {
  it('sends the chosen length, the way of ending and a trimmed reason', () => {
    expect(maintenanceRequest({ ...emptyForm(), reason: '  kernel update ' })).toEqual({
      body: { minutes: 30, untilBack: true, reason: 'kernel update' },
    });
    expect(maintenanceRequest({ minutes: 'custom', custom: ' 90 ', reason: '', untilBack: false })).toEqual({
      body: { minutes: 90, untilBack: false },
    });
  });

  it('refuses what the hub would refuse, before asking it', () => {
    const custom = (custom) => maintenanceRequest({ ...emptyForm(), minutes: 'custom', custom }).error;
    expect(custom('')).toMatch(/whole minutes/);
    expect(custom('1.5')).toMatch(/whole minutes/);
    expect(custom('0')).toMatch(/between 1 and 1440/);
    expect(custom(String(MAX_MINUTES + 1))).toMatch(/between 1 and 1440/);
    expect(custom(String(MAX_MINUTES))).toBeUndefined();
    expect(maintenanceRequest({ ...emptyForm(), reason: 'x'.repeat(201) }).error).toMatch(/at most 200/);
    expect(maintenanceRequest({ ...emptyForm(), reason: 'two\nlines' }).error).toMatch(/one line/);
    expect(maintenanceRequest({ ...emptyForm(), reason: 'a b' }).error).toMatch(/one line/);
  });

  it('offers lengths within the limit, and extends an open window with its reason and way of ending', () => {
    expect(LENGTHS.every((l) => l.minutes >= 1 && l.minutes <= MAX_MINUTES)).toBe(true);
    expect(LENGTHS.some((l) => l.minutes === emptyForm().minutes)).toBe(true);
    expect(formFromWindow({ ...window, untilBack: false })).toMatchObject({ reason: 'kernel update', untilBack: false });
  });
});

describe('showing a window', () => {
  it('says until when, and how it may end sooner', () => {
    const at = fmtUntil(window.endsAt, now);
    expect(at).not.toMatch(/Nov/);
    expect(windowSummary(window, now)).toBe(`Alerts for this server are held back until everything is back, ${at} at the latest. Opened by alice.`);
    expect(windowSummary({ ...window, untilBack: false }, now)).toContain(`held back until ${at}.`);
    expect(windowTag(window, now)).toEqual({ label: 'Maintenance', title: `Alerts held back until ${at}` });
  });

  it('gives the day when it ends on another day', () => {
    expect(fmtUntil(new Date(2026, 10, 8, 2, 0).getTime(), now)).toMatch(/8/);
  });

  it('names who opened it', () => {
    expect(openedBy({ startedBy: 'web01', startedByKind: 'agent' })).toBe('the server itself');
    expect(openedBy({ startedBy: 'ci', startedByKind: 'token' })).toBe('token ci');
    expect(openedBy({ startedBy: 'alice', startedByKind: 'user' })).toBe('alice');
  });
});

describe('the API', () => {
  it('opens and ends a window on the server', async () => {
    const fetchImpl = vi.fn(async (url, init) => ({
      ok: true,
      status: init.method === 'DELETE' ? 204 : 200,
      statusText: 'x',
      text: async () => (init.method === 'DELETE' ? '' : JSON.stringify(window)),
    }));
    const api = createApi({ fetchImpl });
    expect(await api.openMaintenance('s1', { minutes: 30, untilBack: true })).toEqual(window);
    await api.endMaintenance('s1');
    const [[openUrl, open], [endUrl, end]] = fetchImpl.mock.calls;
    expect([openUrl, open.method, open.body]).toEqual(['/api/v1/servers/s1/maintenance', 'POST', '{"minutes":30,"untilBack":true}']);
    expect([endUrl, end.method]).toEqual(['/api/v1/servers/s1/maintenance', 'DELETE']);
    expect(end.headers['X-Svcmon-Request']).toBe('1');
  });
});

describe('the pages', () => {
  const server = readFileSync(new URL('../src/views/Server.svelte', import.meta.url), 'utf8');
  const overview = readFileSync(new URL('../src/views/Overview.svelte', import.meta.url), 'utf8');

  it('let only admins open or end a window, and show it to everyone', () => {
    const adminBlock = server.slice(server.indexOf('{#if auth.admin}'), server.indexOf('{/if}', server.indexOf('{#if auth.admin}')));
    expect(adminBlock).toContain('onclick={startMaintenance}');
    expect(server).toMatch(/\{#if server\.maintenance\}[\s\S]*windowSummary[\s\S]*\{#if auth\.admin\}[\s\S]*endMaintenance/);
    expect(overview).toContain('windowTag(s.maintenance)');
  });

  it('explain it in the help', () => {
    expect(HELP.server.fields.map((f) => f.name)).toContain('Maintenance');
    expect(FIELD_HELP['maintenance.untilBack'].text).toMatch(/several restarts/);
  });
});
