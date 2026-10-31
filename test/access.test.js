import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describeAccess, endsSignIn } from '../src/lib/access.js';

describe('a refusal for where the browser is', () => {
  it('ends the sign-in this page has, for the hub codes for it and no others', () => {
    for (const code of ['outside_not_allowed', 'insecure_transport', 'password_inside_only']) {
      expect(endsSignIn(code), code).toBe(true);
    }
    for (const other of ['forbidden', 'password_change_required', 'initial_password_inside_only', '', undefined]) {
      expect(endsSignIn(other)).toBe(false);
    }
  });

  it('has no screen of its own: the sign-in page says it, and never where the hub places the browser', () => {
    const app = readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8');
    expect(app).not.toMatch(/refused|Refused/);
    const login = readFileSync(new URL('../src/views/Login.svelte', import.meta.url), 'utf8');
    const markup = login.slice(login.indexOf('</script>'));
    expect(markup).not.toMatch(/outside|inside|internal network|refus/i);
  });
});

describe('Settings > Access', () => {
  const view = {
    allowOutside: false,
    internalNetworks: ['127.0.0.0/8', '10.0.0.0/8'],
    publicProxies: ['127.0.0.2'],
    network: 'inside',
    address: '10.1.2.3',
    secure: false,
  };

  it('states the rule and the setting it comes from', () => {
    const text = describeAccess(view);
    expect(text.rule).toMatch(/Only people on the internal network/);
    expect(text.setting).toBe('svcmon.access.allow-outside: false');
    expect(describeAccess({ ...view, allowOutside: true }).rule).toMatch(/over HTTPS only/);
    expect(describeAccess({ ...view, allowOutside: true }).setting).toBe('svcmon.access.allow-outside: true');
  });

  it('says how the hub sees this browser, so the rule can be checked from outside', () => {
    expect(describeAccess(view).browser).toBe('This browser is seen as inside the internal network (10.1.2.3), over plain HTTP.');
    const outside = describeAccess({ ...view, network: 'outside', address: '203.0.113.7', secure: true });
    expect(outside.browser).toBe('This browser is seen as outside the internal network (203.0.113.7), over HTTPS.');
    expect(outside.outside).toBe(true);
  });

  it('lists the networks and proxies as the hub has them', () => {
    expect(describeAccess(view).networks).toEqual(['127.0.0.0/8', '10.0.0.0/8']);
    expect(describeAccess(view).proxies).toEqual(['127.0.0.2']);
    expect(describeAccess({ ...view, publicProxies: undefined }).proxies).toEqual([]);
    expect(describeAccess(null)).toBeNull();
  });

  it('is a section every signed-in user sees', () => {
    const settings = readFileSync(new URL('../src/views/Settings.svelte', import.meta.url), 'utf8');
    expect(settings).toContain('<AccessSettings />');
  });
});
