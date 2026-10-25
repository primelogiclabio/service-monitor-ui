import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { declaredState } from '../src/lib/checks.js';
import { HELP } from '../src/lib/help.js';

describe('a check defined in the hub', () => {
  it('can be changed, deleted and switched as ever', () => {
    for (const check of [{ source: 'HUB' }, { source: 'HUB', removedFromFile: false }, {}, null, undefined]) {
      expect(declaredState(check)).toMatchObject({ declared: false, removed: false, canEdit: true, canDelete: true, canEnable: true, tag: '', note: '' });
    }
  });
});

describe('a check declared by the agent', () => {
  const declared = { source: 'AGENT', removedFromFile: false };

  it('is tagged, and only its on/off switch can be used', () => {
    const s = declaredState(declared);
    expect(s).toMatchObject({ declared: true, removed: false, canEdit: false, canDelete: false, canEnable: true, tag: 'Agent file' });
    expect(s.note).toContain('checks.json');
    expect(s.note).toContain('svcmon agent check');
  });

  it('can be deleted and not enabled once it was taken out of the file', () => {
    const s = declaredState({ source: 'AGENT', removedFromFile: true });
    expect(s).toMatchObject({ declared: true, removed: true, canEdit: false, canDelete: true, canEnable: false, tag: 'Removed from agent file' });
    expect(s.note).toContain('stays off');
  });

  it('matches what the hub refuses (409 on edit, on delete and on enabling a removed one)', () => {
    // The rules are the hub's CheckService.guardDeclared and delete; keep them in step.
    expect(declaredState({ source: 'AGENT' }).canDelete).toBe(false);
    expect(declaredState({ source: 'AGENT', removedFromFile: true }).canEnable).toBe(false);
  });
});

describe('the pages', () => {
  const read = (p) => readFileSync(p, 'utf8');

  it('use the same rules for the tag, the buttons and the form', () => {
    const table = read('src/components/CheckTable.svelte');
    expect(table).toContain('declaredState');
    expect(table).toContain('source-tag');
    const detail = read('src/components/CheckDetail.svelte');
    expect(detail).toContain('lock.canDelete');
    expect(detail).toContain('lock.canEnable');
    expect(detail).toContain('locked={!lock.canEdit}');
    const form = read('src/components/CheckForm.svelte');
    // Every control follows the lock, so a declared check cannot be edited from the form.
    const controls = form.split('\n').filter((line) => /<(?:input|select)\b/.test(line));
    expect(controls.length).toBeGreaterThan(10);
    for (const c of controls) expect(c, c).toContain('locked');
    expect(form).toContain('if (locked) return');
  });

  it('says that a container check also works on Windows', () => {
    const container = HELP.addCheck.fields.find((f) => f.name === 'CONTAINER').text;
    expect(container).toContain('Windows');
    expect(container).not.toMatch(/Linux and macOS\.$/);
  });
});
