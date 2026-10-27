// Sign-in, passwords and users: the hub's rules as the forms check them, and the hub's refusals in words for a person.
// Pure functions, so they are easy to test.

/** The hub's password length (PasswordHasher); no composition rules. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/** The hub's rule for user names (UserService). */
export const USERNAME_PATTERN = /^[A-Za-z0-9._@-]{1,64}$/;

export const ROLES = [
  { value: 'READ', label: 'Read only' },
  { value: 'ADMIN', label: 'Administrator' },
];

export function roleLabel(role) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

/** What to say when signing in failed. `fallback` is set when the page fell back from a sign-in proxy. */
export function signInMessage(err, { fallback = '' } = {}) {
  switch (err?.code) {
    case 'wrong_credentials':
      return 'Wrong user name or password.';
    case 'initial_password_inside_only':
      return "This password has to be changed before it can be used, and that only works from the hub's internal network. Sign in from there, or ask an administrator.";
    case 'too_many_attempts':
      return err.message; // it says how long to wait
    case 'not_found':
      // Behind a sign-in proxy the password sign-in may be kept off the public address on purpose.
      return fallback
        ? "Sign-in with a user name and password is not offered on this address. Open the hub through its own address."
        : 'Sign-in with a user name and password is turned off on this hub.';
    case 'cross_site':
      return "The hub refused the request because it did not come from the hub's own page. Open the dashboard at the hub's address.";
    default:
      return err?.message || 'Signing in failed.';
  }
}

/** What is wrong with a new password before it is sent, or '' when the hub may accept it. */
export function newPasswordProblem({ newPassword, confirm, username = '' }) {
  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
    return `The new password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`;
  }
  if (username && newPassword.trim().toLowerCase() === username.toLowerCase()) {
    return 'The new password must not be your user name.';
  }
  if (newPassword !== confirm) return 'The two new passwords do not match.';
  return '';
}

/** What to say when changing a password failed. None of these end the sign-in. */
export function passwordChangeMessage(err) {
  switch (err?.code) {
    case 'wrong_password':
      return 'The current password is wrong.';
    case 'same_password':
      return 'Choose a password different from the current one.';
    case 'weak_password':
    case 'too_many_attempts':
      return err.message;
    default:
      return err?.message || 'Changing the password failed.';
  }
}

/** Why the hub would refuse a user name, or '' when it is fine. */
export function usernameProblem(name) {
  return USERNAME_PATTERN.test(name) ? '' : 'A user name is 1 to 64 letters, digits and . _ @ -';
}

/** A user's state in a word or two. */
export function userStatus(user) {
  if (user.disabled) return 'Disabled';
  if (user.mustChangePassword) return 'Must change password';
  return 'Active';
}

/** The caller's own sign-ins (an administrator gets everyone's from the hub), this one first, then the latest used. */
export function ownSessions(sessions, username) {
  return (sessions ?? [])
    .filter((s) => s.user === username)
    .sort((a, b) => Number(b.current) - Number(a.current) || b.lastSeenAt - a.lastSeenAt);
}

/** "Firefox on Windows" from a user agent, or the raw text when it is not recognised. */
export function describeBrowser(userAgent) {
  const ua = userAgent ?? '';
  if (!ua) return 'Unknown browser';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  const system = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (!browser) return ua.length > 60 ? `${ua.slice(0, 57)}…` : ua;
  return system ? `${browser} on ${system}` : browser;
}

/**
 * The confirmation for an action on a user: `kind` is 'role' (to `role`), 'reset', 'disable', 'enable' or 'delete'.
 * Returns { title, message, confirmLabel, danger }.
 */
export function userAction(kind, user, role) {
  const name = `“${user.username}”`;
  switch (kind) {
    case 'role':
      return {
        title: 'Change role',
        message:
          role === 'ADMIN'
            ? `Make ${name} an administrator, who can change everything, users included? Their sign-ins end so the new role applies at once.`
            : `Make ${name} read-only, able to look at everything but change nothing? Their sign-ins end so the new role applies at once.`,
        confirmLabel: role === 'ADMIN' ? 'Make administrator' : 'Make read-only',
        danger: false,
      };
    case 'reset':
      return {
        title: 'Reset password',
        message: `Give ${name} a new temporary password? Their current one stops working and their sign-ins end. They choose their own at the next sign-in, which has to be from the hub's internal network.`,
        confirmLabel: 'Reset password',
        danger: true,
      };
    case 'disable':
      return {
        title: 'Disable user',
        message: `Disable ${name}? They are signed out and cannot sign in until the account is enabled again.`,
        confirmLabel: 'Disable',
        danger: true,
      };
    case 'enable':
      return {
        title: 'Enable user',
        message: `Enable ${name}? They can sign in again with their password.`,
        confirmLabel: 'Enable',
        danger: false,
      };
    case 'delete':
      return {
        title: 'Delete user',
        message: `Delete ${name}? They are signed out and the account is gone for good. Disable it instead to keep it.`,
        confirmLabel: 'Delete',
        danger: true,
      };
    default:
      throw new Error(`unknown user action ${kind}`);
  }
}
