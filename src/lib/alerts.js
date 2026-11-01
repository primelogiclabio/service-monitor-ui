// Alert channels: where the hub sends status changes (GET /alert-channels), and the form that adds and edits them.

/** In the order the form offers them. */
export const ALERT_TYPES = [
  { value: 'SLACK', label: 'Slack' },
  { value: 'DISCORD', label: 'Discord' },
  { value: 'WEBHOOK', label: 'Webhook' },
  { value: 'EMAIL', label: 'Email' },
];

/** The statuses a channel can send on, in the hub's order, with the words the dashboard uses for them. */
export const ALERT_STATUSES = [
  { value: 'DOWN', label: 'Down' },
  { value: 'WARN', label: 'Warning' },
  { value: 'UP', label: 'Up' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

/** What the hub uses when a channel names none: problems, and recoveries so you hear when they end. */
export const DEFAULT_STATUSES = ['DOWN', 'WARN', 'UP'];

export const SMTP_SECURITY = [
  { value: 'STARTTLS', label: 'STARTTLS (port 587)' },
  { value: 'SSL', label: 'SSL/TLS (port 465)' },
  { value: 'NONE', label: 'None (trusted internal relay only)' },
];

export const EMAIL_FORMATS = [
  { value: 'HTML', label: 'HTML with a plain-text part' },
  { value: 'TEXT', label: 'Plain text only (pagers, email-to-SMS)' },
];

/** What the hub shows in place of a secret. Sent back on an update, it means "keep the stored value". */
export const MASK = '********';

/** The hub's limits. */
export const CHANNEL_NAME_MAX = 100;
export const MAX_HEADERS = 10;
export const MAX_RECIPIENTS = 20;

export function typeLabel(type) {
  return ALERT_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** "Down, Warning, Up", in the hub's order whatever order they come in. */
export function sendsOnLabel(statuses) {
  return ALERT_STATUSES.filter((s) => statuses?.includes(s.value)).map((s) => s.label).join(', ');
}

/**
 * Whether a channel works, from its last delivery (a test counts): a StatusBadge status and its label, and the hub's
 * error for a failing one. A success clears the error, so an error means the latest attempt failed.
 */
export function channelState(ch) {
  if (!ch.enabled) return { status: 'OFF', label: 'Disabled', detail: '' };
  if (ch.lastError) return { status: 'DOWN', label: 'Failing', detail: ch.lastError };
  if (ch.lastAttemptAt == null) return { status: 'UNKNOWN', label: 'Not sent yet', detail: '' };
  return { status: 'UP', label: 'Working', detail: '' };
}

/** Where a channel sends, as far as the masked settings tell: the receiver's host, or the email recipients. */
export function channelTarget(ch) {
  const c = ch.config ?? {};
  if (ch.type === 'EMAIL') return (c.to ?? []).join(', ');
  try {
    return new URL(c.url).host;
  } catch {
    return '';
  }
}

/** A blank form for a new channel of this type. */
export function emptyForm(type = 'SLACK') {
  return {
    type,
    name: '',
    enabled: true,
    statuses: [...DEFAULT_STATUSES],
    url: '',
    signingSecret: '',
    headers: [],
    smtpHost: '',
    smtpPort: '',
    security: 'STARTTLS',
    username: '',
    password: '',
    from: '',
    to: '',
    format: 'HTML',
  };
}

/**
 * The form for editing a channel. Secrets start empty, which keeps the stored value; the form shows the masked one as a
 * hint. A stored header keeps its name in `original`, so an empty value keeps its stored value only while the name is
 * unchanged (the hub matches headers by name).
 */
export function formFromChannel(ch) {
  const c = ch.config ?? {};
  return {
    ...emptyForm(ch.type),
    name: ch.name,
    enabled: ch.enabled,
    statuses: [...(ch.statuses ?? [])],
    headers: Object.keys(c.headers ?? {}).map((name) => ({ name, value: '', original: name })),
    smtpHost: c.smtpHost ?? '',
    smtpPort: c.smtpPort == null ? '' : String(c.smtpPort),
    security: c.security ?? 'STARTTLS',
    username: c.username ?? '',
    from: c.from ?? '',
    to: (c.to ?? []).join(', '),
    format: c.format ?? 'HTML',
  };
}

/** The stored secrets of a channel being edited, as the hub shows them (masked), for the form's hints. */
export function storedSecrets(ch) {
  const c = ch?.config ?? {};
  return { url: c.url ?? '', signingSecret: c.signingSecret ?? '', password: c.password ?? '' };
}

/** Email addresses typed with commas, semicolons, spaces or new lines between them. */
export function splitAddresses(text) {
  return (text ?? '').split(/[\s,;]+/).filter(Boolean);
}

/**
 * The request body for POST (add) or PUT (edit). A secret left empty is left out, which the hub reads as "keep the
 * stored one"; a stored header with an empty value is sent masked for the same reason. A header taken out of the list is
 * removed. The type is only sent on add: the hub cannot change it.
 */
export function channelRequest(form, editing) {
  const body = {
    name: form.name.trim(),
    enabled: form.enabled,
    statuses: ALERT_STATUSES.map((s) => s.value).filter((s) => form.statuses.includes(s)),
  };
  if (!editing) body.type = form.type;
  const config = {};
  const put = (key, value) => {
    const v = String(value ?? '').trim();
    if (v) config[key] = v;
  };
  if (form.type === 'EMAIL') {
    put('smtpHost', form.smtpHost);
    if (String(form.smtpPort).trim()) config.smtpPort = Number(form.smtpPort);
    config.security = form.security;
    put('username', form.username);
    put('password', form.password);
    put('from', form.from);
    config.to = splitAddresses(form.to);
    config.format = form.format;
  } else {
    put('url', form.url);
  }
  if (form.type === 'WEBHOOK') {
    put('signingSecret', form.signingSecret);
    const headers = {};
    for (const h of form.headers) {
      const name = h.name.trim();
      if (name) headers[name] = h.value === '' && editing && h.original === name ? MASK : h.value;
    }
    if (Object.keys(headers).length) config.headers = headers;
  }
  body.config = config;
  return body;
}

const ADDRESS = /^[^\s@]+@[^\s@]+$/;

/** Why the hub would refuse this form, or '' when it looks fine. The hub checks everything again, more strictly. */
export function channelProblem(form, editing) {
  const name = form.name.trim();
  if (!name || name.length > CHANNEL_NAME_MAX) return `Give the channel a name of 1 to ${CHANNEL_NAME_MAX} characters.`;
  if (!form.statuses.length) return 'Choose at least one status to send on.';
  if (form.type === 'EMAIL') {
    if (!form.smtpHost.trim()) return 'The SMTP server is required.';
    const port = String(form.smtpPort).trim();
    if (port && !(Number.isInteger(Number(port)) && Number(port) >= 1 && Number(port) <= 65535)) {
      return 'The SMTP port is a number from 1 to 65535.';
    }
    if (form.password.trim() && !form.username.trim()) return 'A password needs a user name.';
    if (!ADDRESS.test(form.from.trim())) return 'From is one email address, such as alerts@example.com.';
    const to = splitAddresses(form.to);
    if (!to.length || to.length > MAX_RECIPIENTS) return `Send to 1 to ${MAX_RECIPIENTS} email addresses.`;
    const bad = to.find((a) => !ADDRESS.test(a));
    if (bad) return `“${bad}” is not an email address.`;
    return '';
  }
  const url = form.url.trim();
  if (!url && !editing) return 'The webhook URL is required.';
  // The hub decides whether http is allowed (always for a webhook, for Slack and Discord only on a test hub).
  if (url && !/^https?:\/\/[^/\s]+/i.test(url)) return 'The URL starts with https://.';
  if (form.type === 'WEBHOOK') {
    const rows = form.headers.filter((h) => h.name.trim() || h.value);
    if (rows.length > MAX_HEADERS) return `At most ${MAX_HEADERS} headers.`;
    const seen = new Set();
    for (const h of rows) {
      const n = h.name.trim();
      if (!n) return 'Give every header a name.';
      if (seen.has(n.toLowerCase())) return `Header ${n} is listed twice.`;
      seen.add(n.toLowerCase());
      if (h.value === '' && !(editing && h.original === n)) return `Give header ${n} a value.`;
    }
  }
  return '';
}

/**
 * The PUT body that switches a channel on or off and changes nothing else. The hub needs the whole configuration, so the
 * masked one goes back as it came: masked values mean "keep".
 */
export function toggleBody(ch) {
  return { name: ch.name, enabled: !ch.enabled, statuses: ch.statuses, config: ch.config ?? {} };
}

/**
 * The confirmation for an action on a channel: `kind` is 'disable' or 'delete'. `lastOn` says it is the only channel
 * still switched on. Returns { title, message, confirmLabel, danger }.
 */
export function channelAction(kind, ch, { lastOn = false } = {}) {
  const name = `“${ch.name}”`;
  const silence = lastOn ? ' It is the only channel switched on, so nobody will hear about problems.' : '';
  if (kind === 'disable') {
    return {
      title: 'Disable alert channel',
      message: `Disable ${name}? The hub sends nothing to it until it is enabled again.${silence}`,
      confirmLabel: 'Disable',
      danger: true,
    };
  }
  return {
    title: 'Delete alert channel',
    message: `Delete ${name}? The hub stops sending to it and its settings are gone for good. Disable it instead to keep them.${silence}`,
    confirmLabel: 'Delete',
    danger: true,
  };
}

/** The toast for a test message: what the hub's one attempt did. */
export function testOutcome(ch, result) {
  return result?.ok
    ? { message: `Test message delivered to ${ch.name}`, kind: 'success' }
    : { message: `${ch.name}: ${result?.error || 'the test message was not delivered'}`, kind: 'error' };
}
