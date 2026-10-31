import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD_HELP, HELP, loadHelpOpen, saveHelpOpen, typeHelp } from '../src/lib/help.js';
import { CHECK_TYPES } from '../src/lib/format.js';
import { defaultThresholds } from '../src/lib/checks.js';
import { placeTip } from '../src/lib/tip.js';

function svelteFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? svelteFiles(join(dir, e.name)) : e.name.endsWith('.svelte') ? [join(dir, e.name)] : [],
  );
}

const sources = svelteFiles('src').map((file) => ({ file, text: readFileSync(file, 'utf8') }));
const used = sources.flatMap(({ text }) => [...text.matchAll(/<Tip\b[^>]*\bfield="([^"]+)"/g)].map((m) => m[1]));

describe('field help', () => {
  it('has a label and text for every entry, with code marked in pairs', () => {
    for (const [key, e] of Object.entries(FIELD_HELP)) {
      expect(e.label, key).toBeTruthy();
      expect(e.text.length, key).toBeGreaterThan(20);
      expect((e.text.match(/`/g) ?? []).length % 2, key).toBe(0);
    }
  });

  it('is defined for every info icon in the pages, and every entry is used', () => {
    expect(used.length).toBeGreaterThan(10);
    for (const key of used) expect(FIELD_HELP, `<Tip field="${key}"> has no text`).toHaveProperty(key);
    for (const key of Object.keys(FIELD_HELP)) expect(used, `${key} is never shown`).toContain(key);
  });

  it('quotes the same default thresholds as the agent', () => {
    const cpu = defaultThresholds('CPU');
    const disk = defaultThresholds('DISK');
    expect(FIELD_HELP['check.warn'].text).toContain(`${cpu.warn} for CPU and memory, ${disk.warn} for disk`);
    expect(FIELD_HELP['check.crit'].text).toContain(`${cpu.crit} for CPU and memory, ${disk.crit} for disk`);
  });

  it('gives every check type an explanation for the target icon', () => {
    for (const type of CHECK_TYPES) expect(typeHelp(type), type).toBeTruthy();
    expect(typeHelp('HTTP')).toBe(HELP.addCheck.fields.find((f) => f.name === 'HTTP').text);
    expect(typeHelp('MEMORY')).toContain('Percent used');
    expect(typeHelp('NOPE')).toBe('');
  });
});

describe('help panel state', () => {
  const memory = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  };

  it('is closed until someone opens it, then remembered per topic', () => {
    const s = memory();
    expect(loadHelpOpen('addCheck', s)).toBe(false);
    saveHelpOpen('addCheck', true, s);
    expect(loadHelpOpen('addCheck', s)).toBe(true);
    expect(loadHelpOpen('addServer', s)).toBe(false);
    saveHelpOpen('addCheck', false, s);
    expect(loadHelpOpen('addCheck', s)).toBe(false);
  });

  it('copes with storage that is missing or throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadHelpOpen('addCheck', null)).toBe(false);
    expect(loadHelpOpen('addCheck', broken)).toBe(false);
    expect(() => saveHelpOpen('addCheck', true, broken)).not.toThrow();
    expect(() => saveHelpOpen('addCheck', true, null)).not.toThrow();
  });

  it('has a topic for every panel the pages open', () => {
    const topics = sources.flatMap(({ text }) => [...text.matchAll(/<WithHelp\b[^>]*\btopic="([^"]+)"/g)].map((m) => m[1]));
    expect(topics.sort()).toEqual(['addCheck', 'addServer', 'dashboard', 'monitors', 'server']);
    for (const t of topics) expect(HELP).toHaveProperty(t);
  });

  it('gives every screen a Help button', () => {
    const views = readdirSync('src/views').filter((f) => !['Login.svelte', 'ChangePassword.svelte', 'Refused.svelte', 'Help.svelte'].includes(f));
    for (const view of views) {
      const text = readFileSync(join('src/views', view), 'utf8');
      expect(text, view).toMatch(/<WithHelp\b/);
    }
  });

  it('lets a page place the button itself, and renders it there', () => {
    for (const { file, text } of sources.filter(({ text }) => /<WithHelp\b[^>]*\bplaced\b/.test(text))) {
      expect(text, file).toMatch(/\{#snippet children\((\w+)\)\}[\s\S]*\{@render \1\(\)\}/);
    }
  });
});

describe('placeTip', () => {
  const view = { width: 1000, height: 700 };
  const anchor = (left, top) => ({ left, right: left + 16, top, bottom: top + 16 });

  it('centres under the icon', () => {
    const p = placeTip(anchor(492, 100), view, { height: 80 });
    expect(p.above).toBe(false);
    expect(p.width).toBe(320);
    expect(p.left).toBe(500 - 160);
    expect(p.top).toBe(116 + 6);
  });

  it('stays inside the window at either edge', () => {
    expect(placeTip(anchor(0, 100), view).left).toBe(8);
    expect(placeTip(anchor(990, 100), view).left).toBe(1000 - 320 - 8);
  });

  it('shrinks to fit a narrow screen', () => {
    const p = placeTip(anchor(100, 100), { width: 300, height: 600 });
    expect(p.width).toBe(284);
    expect(p.left).toBe(8);
  });

  it('flips above the icon when there is no room below but room above', () => {
    const p = placeTip(anchor(100, 650), view, { height: 100 });
    expect(p.above).toBe(true);
    expect(p.top).toBe(650 - 6);
  });

  it('stays below when it fits neither way', () => {
    const p = placeTip(anchor(100, 40), { width: 1000, height: 100 }, { height: 120 });
    expect(p.above).toBe(false);
  });
});
