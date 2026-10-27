// Settings > Activity: the hub's audit (GET /api/v1/audit) in words for a person. The hub records route patterns and
// codes; this turns them into sentences. Pure functions, so they are easy to test.

/** The filter above the table: the hub's categories, or both. */
export const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'sign_in', label: 'Sign-ins' },
  { key: 'change', label: 'Changes' },
];

/** What a change did, by the route the hub recorded. */
const ACTIONS = {
  'POST /api/v1/checks': 'Added a check',
  'PUT /api/v1/checks/{id}': 'Changed a check',
  'DELETE /api/v1/checks/{id}': 'Deleted a check',
  'POST /api/v1/checks/{id}/run': 'Ran a check',
  'PATCH /api/v1/servers/{id}': 'Changed a server',
  'DELETE /api/v1/servers/{id}': 'Removed a server',
  'POST /api/v1/tokens': 'Made an API token',
  'DELETE /api/v1/tokens/{id}': 'Revoked a token',
  'POST /api/v1/enrollment-tokens': 'Made an enrollment token',
  'POST /api/v1/join-keys': 'Made a join key',
  'DELETE /api/v1/join-keys/{id}': 'Revoked a join key',
  'POST /api/v1/alert-channels': 'Added an alert channel',
  'PUT /api/v1/alert-channels/{id}': 'Changed an alert channel',
  'DELETE /api/v1/alert-channels/{id}': 'Deleted an alert channel',
  'POST /api/v1/alert-channels/{id}/test': 'Sent a test alert',
  'POST /api/v1/users': 'Added a user',
  'PATCH /api/v1/users/{id}': 'Changed a user',
  'POST /api/v1/users/{id}/password-reset': "Reset a user's password",
  'DELETE /api/v1/users/{id}': 'Deleted a user',
  'PUT /api/v1/me/password': 'Changed their password',
  'DELETE /api/v1/sessions/{id}': 'Ended a sign-in',
};

/** What a sign-in event was, by its kind. */
const KINDS = {
  sign_in: 'Signed in',
  jwt_sign_in: 'Signed in through the gateway',
  sign_out: 'Signed out',
  session_ended: 'Ended a sign-in',
  password_changed: 'Changed their password',
  password_reset: 'Reset a password',
  refused: 'Was refused',
  agent_registered: 'A server joined',
};

/** How it ended, by the hub's code. */
const OUTCOMES = {
  ok: 'OK',
  unknown_user: 'No such user',
  wrong_password: 'Wrong password',
  account_disabled: 'Account disabled',
  initial_password_inside_only: 'First password used from outside',
  too_many_attempts: 'Too many attempts',
  outside_not_allowed: 'From outside the internal network',
  insecure_transport: 'From outside over plain HTTP',
  forbidden: 'Not allowed for this role',
  cross_site: 'Sent by another site',
  password_change_required: 'Password change needed first',
  not_found: 'Not found',
  last_admin: 'Last administrator',
  own_account: 'Own account',
  username_taken: 'Name taken',
  weak_password: 'Password too weak',
  same_password: 'Same password',
  bad_request: 'Bad request',
};

/** Who did it, from the actor and the kind of credential. */
export function whoLabel(e) {
  const name = e?.actor ?? 'unknown';
  switch (e?.actorKind) {
    case 'user':
      return name;
    case 'jwt':
      return `${name} (gateway)`;
    case 'token':
      return `API token “${name}”`;
    case 'enrollment_token':
      return `Enrollment token “${name}”`;
    case 'join_key':
      return `Join key “${name}”`;
    case 'command_line':
      return "users reset, on the hub's machine";
    default:
      return 'Unknown';
  }
}

/** What happened, in a few words, with what it was about when the hub said. */
export function whatLabel(e) {
  let what;
  if (e?.kind === 'api_call') what = ACTIONS[e.action] ?? e.action ?? 'A change';
  else what = KINDS[e?.kind] ?? e?.kind ?? '';
  return { what, about: [e?.target, e?.detail].filter(Boolean).join(', '), call: e?.kind === 'api_call' ? e.action : '' };
}

export function outcomeLabel(e) {
  const code = e?.outcome ?? '';
  if (/^\d{3}$/.test(code)) return `Failed (${code})`;
  return OUTCOMES[code] ?? code.replaceAll('_', ' ');
}

export function isOk(e) {
  return e?.outcome === 'ok';
}

/** Where from: the address, and whether the hub counted it as inside or outside. */
export function whereLabel(e) {
  if (!e?.address) return '—';
  return e.network ? `${e.address} (${e.network})` : e.address;
}

/** Adds a newer page's events to what is shown, without repeating any. */
export function mergePages(shown, page) {
  const seen = new Set(shown.map((e) => e.id));
  return [...shown, ...(page ?? []).filter((e) => !seen.has(e.id))];
}
