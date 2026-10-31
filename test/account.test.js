import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  ROLES,
  describeBrowser,
  newPasswordProblem,
  ownSessions,
  passwordChangeMessage,
  roleLabel,
  signInMessage,
  userAction,
  userStatus,
  usernameProblem,
} from '../src/lib/account.js';
import { ApiError } from '../src/lib/api.js';

const refusal = (status, code, message = 'from the hub') => new ApiError(status, message, code);

describe('sign-in messages', () => {
  it('say what each refusal of the hub means', () => {
    expect(signInMessage(refusal(401, 'wrong_credentials'))).toBe('Wrong user name or password.');
    expect(signInMessage(refusal(403, 'initial_password_inside_only'))).toMatch(/internal network/);
    expect(signInMessage(refusal(403, 'cross_site'))).toMatch(/hub's own page/);
    expect(signInMessage(refusal(404, 'not_found'))).toMatch(/turned off on this hub/);
  });

  it('say what to do when refused for where the browser is, not where the hub places it', () => {
    const messages = ['outside_not_allowed', 'insecure_transport', 'password_inside_only'].map((code) =>
      signInMessage(refusal(403, code, 'Access from outside the internal network is not allowed')),
    );
    expect(messages[0]).toBe('Sign-in was refused. Ask an administrator if you need access.');
    expect(messages[1]).toMatch(/https:\/\//);
    expect(messages[2]).toMatch(/organisation's account/);
    for (const m of messages) expect(m).not.toMatch(/outside|inside|internal/i);
  });

  it("pass on the hub's wait, which says how long", () => {
    expect(signInMessage(refusal(429, 'too_many_attempts', 'Too many wrong attempts; try again in 600 seconds'))).toBe(
      'Too many wrong attempts; try again in 600 seconds',
    );
  });

  it("fall back to the hub's message, or to a plain one", () => {
    expect(signInMessage(new ApiError(0, 'Cannot reach the hub (Failed to fetch)'))).toBe('Cannot reach the hub (Failed to fetch)');
    expect(signInMessage(new ApiError(500, ''))).toBe('Signing in failed.');
  });
});

describe('a new password', () => {
  const ok = 'a few words together';

  it('follows the hub: 12 to 128 characters, not the user name, typed the same twice', () => {
    expect(PASSWORD_MIN).toBe(12);
    expect(PASSWORD_MAX).toBe(128);
    expect(newPasswordProblem({ newPassword: ok, confirm: ok, username: 'alice' })).toBe('');
    expect(newPasswordProblem({ newPassword: 'x'.repeat(11), confirm: 'x'.repeat(11) })).toMatch(/12 to 128/);
    expect(newPasswordProblem({ newPassword: 'x'.repeat(129), confirm: 'x'.repeat(129) })).toMatch(/12 to 128/);
    expect(newPasswordProblem({ newPassword: 'x'.repeat(12), confirm: 'x'.repeat(12) })).toBe('');
    expect(newPasswordProblem({ newPassword: ok, confirm: `${ok}!` })).toMatch(/do not match/);
  });

  it('may not be the user name, whatever the case', () => {
    expect(newPasswordProblem({ newPassword: 'Administrator', confirm: 'Administrator', username: 'administrator' })).toMatch(/user name/);
  });

  it("is refused by the hub in words for a person, and never as a sign-out", () => {
    expect(passwordChangeMessage(refusal(400, 'wrong_password'))).toBe('The current password is wrong.');
    expect(passwordChangeMessage(refusal(400, 'same_password'))).toMatch(/different/);
    expect(passwordChangeMessage(refusal(400, 'weak_password', 'The password must not be the user name'))).toBe('The password must not be the user name');
    expect(passwordChangeMessage(refusal(429, 'too_many_attempts', 'Too many wrong passwords; try again later'))).toMatch(/try again later/);
  });
});

describe('users', () => {
  it('have names the hub accepts', () => {
    for (const name of ['alice', 'a', 'ops.team_1', 'bob@example.com', 'x'.repeat(64)]) expect(usernameProblem(name), name).toBe('');
    for (const name of ['', 'two words', 'x'.repeat(65), 'ä', 'a/b']) expect(usernameProblem(name), name).not.toBe('');
  });

  it('have the two roles of the hub', () => {
    expect(ROLES.map((r) => r.value)).toEqual(['READ', 'ADMIN']);
    expect(roleLabel('ADMIN')).toBe('Administrator');
    expect(roleLabel('READ')).toBe('Read only');
  });

  it('show their state in a word', () => {
    expect(userStatus({ disabled: true, mustChangePassword: true })).toBe('Disabled');
    expect(userStatus({ disabled: false, mustChangePassword: true })).toBe('Must change password');
    expect(userStatus({ disabled: false, mustChangePassword: false })).toBe('Active');
  });

  it('are changed only after a confirmation that says what happens', () => {
    const bob = { username: 'bob' };
    expect(userAction('role', bob, 'ADMIN')).toMatchObject({ confirmLabel: 'Make administrator', danger: false });
    expect(userAction('role', bob, 'READ').message).toMatch(/read-only/);
    expect(userAction('reset', bob).message).toMatch(/internal network/);
    expect(userAction('disable', bob)).toMatchObject({ confirmLabel: 'Disable', danger: true });
    expect(userAction('enable', bob)).toMatchObject({ confirmLabel: 'Enable', danger: false });
    expect(userAction('delete', bob)).toMatchObject({ confirmLabel: 'Delete', danger: true });
    for (const kind of ['role', 'reset', 'disable', 'enable', 'delete']) expect(userAction(kind, bob, 'READ').message).toContain('“bob”');
    expect(() => userAction('promote', bob)).toThrow();
  });
});

describe('your sign-ins', () => {
  it('are only your own, this one first and then the latest used', () => {
    const list = [
      { id: 's1', user: 'alice', current: false, lastSeenAt: 100 },
      { id: 's2', user: 'bob', current: false, lastSeenAt: 500 },
      { id: 's3', user: 'alice', current: false, lastSeenAt: 300 },
      { id: 's4', user: 'alice', current: true, lastSeenAt: 200 },
    ];
    expect(ownSessions(list, 'alice').map((s) => s.id)).toEqual(['s4', 's3', 's1']);
    expect(ownSessions(undefined, 'alice')).toEqual([]);
  });

  it('name the browser and system in a few words', () => {
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox on Windows');
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge on Windows');
    expect(describeBrowser('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toBe('Chrome on Linux');
    expect(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15')).toBe('Safari on macOS');
    expect(describeBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
    expect(describeBrowser('curl/8.9.1')).toBe('curl/8.9.1');
    expect(describeBrowser(null)).toBe('Unknown browser');
  });
});

describe('the sign-in and account pages', () => {
  const read = (p) => readFileSync(p, 'utf8');

  it('never touch browser storage, so no password, token or session can end up there', () => {
    for (const file of [
      'src/views/Login.svelte',
      'src/views/ChangePassword.svelte',
      'src/views/Settings.svelte',
      'src/components/PasswordForm.svelte',
      'src/components/AccountSettings.svelte',
      'src/components/UserList.svelte',
      'src/lib/api.js',
      'src/lib/account.js',
    ]) {
      expect(read(file), file).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    }
  });

  it('show a temporary password once, with a copy button, and confirm every change to a user', () => {
    const users = read('src/components/UserList.svelte');
    expect(users).toContain('class="copybox"');
    expect(users).toContain('temporaryPassword');
    expect(users).toContain('<ConfirmDialog');
    expect(users).toMatch(/onclick=\{\(\) => \(issued = null\)\}/); // Done forgets it
  });
});
