import { describe, expect, it, vi } from 'vitest';
import { ADD_KEY_DAYS, addKeyFor, addKeyName, createAddKeySource } from '../src/lib/addKey.js';
import { activeSection } from '../src/lib/pagenav.js';
import { HELP, HELP_SECTIONS } from '../src/lib/help.js';

const HOUR = 60 * 60 * 1000;
const key = (n, expiresAt) => ({ id: `k${n}`, token: `svm_j_${n}`, name: `key ${n}`, expiresAt });

describe('the join key made for the Add server page', () => {
  it('is named after the time and lasts a day', () => {
    expect(addKeyName(new Date(2026, 9, 4, 7, 5))).toBe('Add server 2026-10-04 07:05');
    expect(ADD_KEY_DAYS).toBe(1);
  });

  it('is made once and reused while it has more than an hour left', async () => {
    let t = 1_000_000;
    const create = vi.fn(async () => key(create.mock.calls.length, t + 24 * HOUR));
    const source = createAddKeySource(create, () => t);

    const first = await source.get();
    t += 22 * HOUR;
    expect(await source.get()).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toEqual({ name: addKeyName(new Date(1_000_000)), expiresInDays: ADD_KEY_DAYS });

    t += 2 * HOUR; // under an hour left: a command copied now could be dead before it is run
    const second = await source.get();
    expect(second).not.toBe(first);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('can be replaced on request', async () => {
    const create = vi.fn(async () => key(create.mock.calls.length, Date.now() + 24 * HOUR));
    const source = createAddKeySource(create);
    const first = await source.get();
    const second = await source.get({ fresh: true });
    expect(second).not.toBe(first);
    expect(await source.get()).toBe(second);
  });

  it('is asked for once when the page asks twice at the same time', async () => {
    const create = vi.fn(async () => key(1, Date.now() + 24 * HOUR));
    const source = createAddKeySource(create);
    const [a, b] = await Promise.all([source.get(), source.get()]);
    expect(a).toBe(b);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('does not remember a failure, so trying again asks the hub again', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('forbidden')).mockResolvedValue(key(2, null));
    const source = createAddKeySource(create);
    await expect(source.get()).rejects.toThrow('forbidden');
    expect((await source.get()).token).toBe('svm_j_2');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('is never shared between sessions', async () => {
    const apiFor = (token) => ({ createJoinKey: vi.fn(async () => key(token, null)) });
    const one = apiFor(1);
    const two = apiFor(2);
    expect((await addKeyFor(one).get()).token).toBe('svm_j_1');
    expect((await addKeyFor(one).get()).token).toBe('svm_j_1');
    expect((await addKeyFor(two).get()).token).toBe('svm_j_2');
    expect(one.createJoinKey).toHaveBeenCalledTimes(1);
  });
});

describe('the Add server help', () => {
  it('says the command is made for you and what the key is', () => {
    const text = [...HELP.addServer.steps, ...HELP.addServer.notes].join(' ');
    expect(text).toContain('24 hours');
    expect(text).toContain('Other ways');
    expect(HELP.addServer.steps[0]).toContain('cluster');
  });
});

describe('the Add check help', () => {
  it('names the check before choosing its type, as the form does', () => {
    const [name, type] = HELP.addCheck.steps;
    expect(name).toContain('name');
    expect(type).toContain('Type');
  });
});

describe('the jump menu on the Help page', () => {
  it('lists each section once, with a label and a page-safe id', () => {
    const ids = HELP_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(HELP_SECTIONS.map((s) => s.key)).size).toBe(ids.length);
    for (const s of HELP_SECTIONS) {
      expect(s.label, s.id).toBeTruthy();
      expect(s.id, s.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('follows the screens, from the dashboard to the general notes', () => {
    const keys = HELP_SECTIONS.map((s) => s.key);
    expect(keys[0]).toBe('dashboard');
    expect(keys.slice(-2)).toEqual(['live', 'icons']);
    expect(HELP_SECTIONS.find((s) => s.key === 'addServer').label).toBe(HELP.addServer.title);
  });

  it('marks the last section whose top has reached the reading line', () => {
    const tops = (...t) => ['a', 'b', 'c'].map((id, i) => ({ id, top: t[i] }));
    expect(activeSection(tops(300, 900, 1500), 96)).toBe('a'); // above the first: still the first
    expect(activeSection(tops(-400, 80, 700), 96)).toBe('b');
    expect(activeSection(tops(-1200, -500, 96), 96)).toBe('c');
    expect(activeSection([], 96)).toBe('');
  });
});
