// Maintenance windows: a server's alerts held back while it is restarted. The hub keeps them (POST and DELETE
// /servers/{id}/maintenance) and shows an open one as the server's `maintenance` in /status.

/** Lengths offered in the dialog, in minutes; any other is typed in. */
export const LENGTHS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
];

/** The longest window an admin may open (the hub's MaintenanceService.ADMIN_MAX_MINUTES). */
export const MAX_MINUTES = 1440;
export const MAX_REASON = 200;

export function emptyForm() {
  return { minutes: 30, custom: '', reason: '', untilBack: true };
}

/** The form for an open window, to extend it: same reason and way of ending. */
export function formFromWindow(m) {
  return { minutes: 30, custom: '', reason: m.reason ?? '', untilBack: m.untilBack };
}

/** The body for POST /servers/{id}/maintenance as `{ body }`, or `{ error }` for the form to show. */
export function maintenanceRequest(form) {
  const raw = form.minutes === 'custom' ? String(form.custom ?? '').trim() : String(form.minutes);
  if (!/^\d+$/.test(raw)) return { error: 'Give the length in whole minutes.' };
  const minutes = Number(raw);
  if (minutes < 1 || minutes > MAX_MINUTES) {
    return { error: `The length must be between 1 and ${MAX_MINUTES} minutes (a day).` };
  }
  const reason = (form.reason ?? '').trim();
  if (reason.length > MAX_REASON) return { error: `The reason can be at most ${MAX_REASON} characters.` };
  // Control characters and the line and paragraph separators, which the hub refuses too.
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(reason)) return { error: 'The reason must be one line.' };
  const body = { minutes, untilBack: !!form.untilBack };
  if (reason) body.reason = reason;
  return { body };
}

/** When a window ends: the time today, or the day and time otherwise. */
export function fmtUntil(ms, now = Date.now()) {
  const end = new Date(ms);
  const sameDay = end.toDateString() === new Date(now).toDateString();
  const time = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${end.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

/** Who opened a window, in words. */
export function openedBy(m) {
  switch (m.startedByKind) {
    case 'agent':
      return 'the server itself';
    case 'user':
      return m.startedBy;
    case 'token':
      return `token ${m.startedBy}`;
    default:
      return m.startedBy ?? 'unknown';
  }
}

/** The banner's sentence about an open window. */
export function windowSummary(m, now = Date.now()) {
  const until = fmtUntil(m.endsAt, now);
  const how = m.untilBack ? `until everything is back, ${until} at the latest` : `until ${until}`;
  return `Alerts for this server are held back ${how}. Opened by ${openedBy(m)}.`;
}

/** The short tag on a server's card, with its tooltip. */
export function windowTag(m, now = Date.now()) {
  return { label: 'Maintenance', title: `Alerts held back until ${fmtUntil(m.endsAt, now)}` };
}
