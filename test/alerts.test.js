import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALERT_STATUSES,
  ALERT_TYPES,
  DEFAULT_STATUSES,
  MASK,
  channelAction,
  channelProblem,
  channelRequest,
  channelState,
  channelTarget,
  emptyForm,
  formFromChannel,
  sendsOnLabel,
  splitAddresses,
  storedSecrets,
  testOutcome,
  toggleBody,
  typeLabel,
} from '../src/lib/alerts.js';
import { FIELD_HELP, HELP } from '../src/lib/help.js';

// Channels as GET /alert-channels returns them: secrets masked the way AlertChannelService.mask does.
const slack = {
  id: 'c1',
  name: 'ops',
  type: 'SLACK',
  enabled: true,
  statuses: ['DOWN', 'WARN', 'UP'],
  config: { url: `https://hooks.slack.com/${MASK}` },
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  createdAt: 1,
};
const webhook = {
  ...slack,
  id: 'c2',
  name: 'pager',
  type: 'WEBHOOK',
  config: { url: `https://alerts.internal:8443/${MASK}`, headers: { Authorization: MASK, 'X-Team': MASK }, signingSecret: MASK },
};
const email = {
  ...slack,
  id: 'c3',
  name: 'mail',
  type: 'EMAIL',
  statuses: ['DOWN'],
  config: {
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    security: 'STARTTLS',
    format: 'HTML',
    username: 'svcmon',
    password: MASK,
    from: 'svcmon@example.com',
    to: ['ops@example.com', 'oncall@example.com'],
  },
};

const formFor = (type, extra = {}) => ({ ...emptyForm(type), name: 'ops', ...extra });

describe('the choices', () => {
  it('are the types and statuses the hub knows, with the default it uses', () => {
    expect(ALERT_TYPES.map((t) => t.value)).toEqual(['SLACK', 'DISCORD', 'WEBHOOK', 'EMAIL']);
    expect(ALERT_STATUSES.map((s) => s.value)).toEqual(['DOWN', 'WARN', 'UP', 'UNKNOWN']);
    expect(DEFAULT_STATUSES).toEqual(['DOWN', 'WARN', 'UP']);
    expect(MASK).toBe('********');
    expect(typeLabel('WEBHOOK')).toBe('Webhook');
  });

  it('list the statuses in the hub order, in the words the dashboard uses', () => {
    expect(sendsOnLabel(['UP', 'DOWN'])).toBe('Down, Up');
    expect(sendsOnLabel(['DOWN', 'WARN', 'UP', 'UNKNOWN'])).toBe('Down, Warning, Up, Unknown');
    expect(sendsOnLabel(undefined)).toBe('');
  });
});

describe('a channel in the list', () => {
  it('says whether its latest delivery worked', () => {
    expect(channelState(slack)).toEqual({ status: 'UNKNOWN', label: 'Not sent yet', detail: '' });
    expect(channelState({ ...slack, lastAttemptAt: 5, lastSuccessAt: 5 })).toMatchObject({ status: 'UP', label: 'Working' });
    expect(channelState({ ...slack, lastAttemptAt: 9, lastSuccessAt: 5, lastError: 'HTTP 404' })).toEqual({
      status: 'DOWN',
      label: 'Failing',
      detail: 'HTTP 404',
    });
    // Off wins: a paused channel is not a problem, whatever it last did.
    expect(channelState({ ...slack, enabled: false, lastError: 'HTTP 404' })).toMatchObject({ status: 'OFF', label: 'Disabled' });
  });

  it('shows where it sends without the secret part', () => {
    expect(channelTarget(slack)).toBe('hooks.slack.com');
    expect(channelTarget(webhook)).toBe('alerts.internal:8443');
    expect(channelTarget(email)).toBe('ops@example.com, oncall@example.com');
    expect(channelTarget({ ...slack, config: { url: MASK } })).toBe('');
    expect(channelTarget({ ...slack, config: undefined })).toBe('');
  });
});

describe('adding a channel', () => {
  it('sends the type and only the settings of that type', () => {
    const form = formFor('SLACK', { url: ' https://hooks.slack.com/services/T/B/X ', smtpHost: 'left over', statuses: ['UP', 'DOWN'] });
    expect(channelRequest(form, false)).toEqual({
      name: 'ops',
      enabled: true,
      statuses: ['DOWN', 'UP'],
      type: 'SLACK',
      config: { url: 'https://hooks.slack.com/services/T/B/X' },
    });
  });

  it('sends a webhook its headers and signing secret, and leaves out what is empty', () => {
    const form = formFor('WEBHOOK', {
      url: 'https://alerts.internal/hook',
      signingSecret: 's3cret',
      headers: [{ name: ' Authorization ', value: 'Bearer abc', original: '' }, { name: '', value: '', original: '' }],
    });
    expect(channelRequest(form, false).config).toEqual({
      url: 'https://alerts.internal/hook',
      signingSecret: 's3cret',
      headers: { Authorization: 'Bearer abc' },
    });
    expect(channelRequest(formFor('WEBHOOK', { url: 'http://127.0.0.1:9000/' }), false).config).toEqual({ url: 'http://127.0.0.1:9000/' });
  });

  it('sends email settings as the hub stores them', () => {
    const form = formFor('EMAIL', {
      smtpHost: 'smtp.example.com',
      smtpPort: '2525',
      security: 'SSL',
      from: 'svcmon@example.com',
      to: 'ops@example.com, oncall@example.com;\nsms@example.com',
      format: 'TEXT',
    });
    expect(channelRequest(form, false).config).toEqual({
      smtpHost: 'smtp.example.com',
      smtpPort: 2525,
      security: 'SSL',
      from: 'svcmon@example.com',
      to: ['ops@example.com', 'oncall@example.com', 'sms@example.com'],
      format: 'TEXT',
    });
    expect(channelRequest({ ...form, smtpPort: '' }, false).config).not.toHaveProperty('smtpPort');
    expect(splitAddresses(' a@x  b@y,,c@z ')).toEqual(['a@x', 'b@y', 'c@z']);
  });

  it('is refused here for what the hub would refuse', () => {
    const ok = formFor('SLACK', { url: 'https://hooks.slack.com/services/T/B/X' });
    expect(channelProblem(ok, false)).toBe('');
    expect(channelProblem({ ...ok, name: '  ' }, false)).toBe('Give the channel a name of 1 to 100 characters.');
    expect(channelProblem({ ...ok, name: 'x'.repeat(101) }, false)).toContain('1 to 100');
    expect(channelProblem({ ...ok, statuses: [] }, false)).toBe('Choose at least one status to send on.');
    expect(channelProblem({ ...ok, url: '' }, false)).toBe('The webhook URL is required.');
    expect(channelProblem({ ...ok, url: 'hooks.slack.com/x' }, false)).toBe('The URL starts with https://.');

    const hook = formFor('WEBHOOK', { url: 'https://alerts.internal/hook' });
    const header = (name, value) => ({ name, value, original: '' });
    expect(channelProblem({ ...hook, headers: [header('', 'abc')] }, false)).toBe('Give every header a name.');
    expect(channelProblem({ ...hook, headers: [header('X-A', '')] }, false)).toBe('Give header X-A a value.');
    expect(channelProblem({ ...hook, headers: [header('X-A', '1'), header('x-a', '2')] }, false)).toBe('Header x-a is listed twice.');
    expect(channelProblem({ ...hook, headers: Array.from({ length: 11 }, (_, i) => header(`X-${i}`, 'v')) }, false)).toBe('At most 10 headers.');
    expect(channelProblem({ ...hook, headers: [header('', '')] }, false)).toBe(''); // an empty row is ignored

    const mail = formFor('EMAIL', { smtpHost: 'smtp.example.com', from: 'svcmon@example.com', to: 'ops@example.com' });
    expect(channelProblem(mail, false)).toBe('');
    expect(channelProblem({ ...mail, smtpHost: '' }, false)).toBe('The SMTP server is required.');
    expect(channelProblem({ ...mail, smtpPort: '70000' }, false)).toBe('The SMTP port is a number from 1 to 65535.');
    expect(channelProblem({ ...mail, password: 'pw' }, false)).toBe('A password needs a user name.');
    expect(channelProblem({ ...mail, from: 'svcmon' }, false)).toContain('From is one email address');
    expect(channelProblem({ ...mail, to: '' }, false)).toBe('Send to 1 to 20 email addresses.');
    expect(channelProblem({ ...mail, to: Array.from({ length: 21 }, (_, i) => `a${i}@x.com`).join(',') }, false)).toBe(
      'Send to 1 to 20 email addresses.',
    );
    expect(channelProblem({ ...mail, to: 'ops@example.com, nobody' }, false)).toBe('“nobody” is not an email address.');
  });
});

describe('editing a channel', () => {
  it('starts with the settings, and with every secret empty', () => {
    const form = formFromChannel(email);
    expect(form).toMatchObject({ type: 'EMAIL', name: 'mail', statuses: ['DOWN'], smtpHost: 'smtp.example.com', smtpPort: '587' });
    expect(form.to).toBe('ops@example.com, oncall@example.com');
    expect(form.password).toBe('');
    expect(formFromChannel(webhook)).toMatchObject({ url: '', signingSecret: '' });
    expect(formFromChannel(webhook).headers).toEqual([
      { name: 'Authorization', value: '', original: 'Authorization' },
      { name: 'X-Team', value: '', original: 'X-Team' },
    ]);
    expect(storedSecrets(webhook)).toEqual({ url: webhook.config.url, signingSecret: MASK, password: '' });
    expect(storedSecrets(null)).toEqual({ url: '', signingSecret: '', password: '' });
  });

  it('keeps every stored secret when nothing is typed over it, and never sends the type', () => {
    const body = channelRequest(formFromChannel(webhook), true);
    expect(body).not.toHaveProperty('type');
    // No url or signingSecret: the hub keeps the stored ones. Masked header values: the hub keeps those too.
    expect(body.config).toEqual({ headers: { Authorization: MASK, 'X-Team': MASK } });
    expect(channelProblem(formFromChannel(webhook), true)).toBe('');

    const withoutPassword = Object.fromEntries(Object.entries(email.config).filter(([k]) => k !== 'password'));
    expect(channelRequest(formFromChannel(email), true).config).toEqual(withoutPassword);
  });

  it('replaces a secret that is typed in, and drops a header taken out', () => {
    const form = formFromChannel(webhook);
    form.url = 'https://alerts.internal/new';
    form.headers = [{ ...form.headers[0], value: 'Bearer new' }];
    expect(channelRequest(form, true).config).toEqual({ url: 'https://alerts.internal/new', headers: { Authorization: 'Bearer new' } });
    form.headers = [];
    expect(channelRequest(form, true).config).not.toHaveProperty('headers');
  });

  it('does not let a renamed header keep a stored value under its new name', () => {
    // The hub matches stored headers by name, so a masked value under a new name would be stored as the mask itself.
    const form = formFromChannel(webhook);
    form.headers = [{ ...form.headers[0], name: 'X-Token' }];
    expect(channelProblem(form, true)).toBe('Give header X-Token a value.');
    expect(channelRequest(form, true).config.headers).toEqual({ 'X-Token': '' });
  });
});

describe('the row actions', () => {
  it('switch a channel on or off by sending the masked settings back unchanged', () => {
    expect(toggleBody(webhook)).toEqual({ name: 'pager', enabled: false, statuses: webhook.statuses, config: webhook.config });
    expect(toggleBody({ ...email, enabled: false })).toMatchObject({ enabled: true, config: email.config });
  });

  it('confirm before disabling or deleting, and warn when it is the last channel on', () => {
    expect(channelAction('disable', slack)).toMatchObject({ title: 'Disable alert channel', confirmLabel: 'Disable', danger: true });
    expect(channelAction('delete', slack)).toMatchObject({ title: 'Delete alert channel', confirmLabel: 'Delete', danger: true });
    expect(channelAction('delete', slack).message).toContain('“ops”');
    expect(channelAction('disable', slack).message).not.toContain('nobody will hear');
    expect(channelAction('disable', slack, { lastOn: true }).message).toContain('nobody will hear about problems');
  });

  it('report a test message as the hub saw it', () => {
    expect(testOutcome(slack, { ok: true, error: null })).toEqual({ message: 'Test message delivered to ops', kind: 'success' });
    expect(testOutcome(slack, { ok: false, error: 'HTTP 404 from hooks.slack.com' })).toEqual({
      message: 'ops: HTTP 404 from hooks.slack.com',
      kind: 'error',
    });
    expect(testOutcome(slack, { ok: false }).message).toBe('ops: the test message was not delivered');
  });
});

describe('the page', () => {
  const read = (p) => readFileSync(p, 'utf8');
  const list = read('src/components/AlertChannels.svelte');
  const form = read('src/components/AlertChannelForm.svelte');

  it('adds, edits, tests, switches and deletes through the hub', () => {
    expect(list).toMatch(/getApi\(\)\.alertChannels\(/);
    expect(list).toMatch(/getApi\(\)\.createAlertChannel\(/);
    expect(list).toMatch(/getApi\(\)\.replaceAlertChannel\(/);
    expect(list).toMatch(/getApi\(\)\.testAlertChannel\(/);
    expect(list).toMatch(/getApi\(\)\.deleteAlertChannel\(/);
    expect(list).toContain('<ConfirmDialog');
    expect(list).toContain('<Modal');
    expect(read('src/views/Settings.svelte')).toContain('<AlertChannels />');
  });

  it('types secrets into password fields and keeps them nowhere else', () => {
    for (const id of ['ac-pass', 'ac-secret']) expect(form).toMatch(new RegExp(`id="${id}" type="password"`));
    expect(form).toMatch(/type="password"\s+bind:value=\{h\.value\}/);
    for (const text of [list, form]) expect(text).not.toMatch(/localStorage|sessionStorage|indexedDB|console\./);
  });

  it('is explained in the help, with the terminal way kept', () => {
    expect(HELP.alerts.steps.join(' ')).toContain('svcmon alert add');
    expect(HELP.alerts.notes.join(' ')).toContain('leave one empty to keep it');
    expect(HELP.svcmon.fields.map((f) => f.text).join(' ')).not.toContain('no alerts page');
    expect(FIELD_HELP['alert.name'].text).toContain('1 to 100 characters');
    expect(FIELD_HELP['alert.to'].text).toContain('1 to 20 addresses');
  });
});
