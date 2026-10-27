import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describeAccess, isRefusal, refusalText } from '../src/lib/access.js';

describe('a refusal for where the browser is', () => {
  it('is known by the hub codes for it and no others', () => {
    expect(isRefusal('outside_not_allowed')).toBe(true);
    expect(isRefusal('insecure_transport')).toBe(true);
    for (const other of ['forbidden', 'password_change_required', 'initial_password_inside_only', '', undefined]) {
      expect(isRefusal(other)).toBe(false);
    }
  });

  it('says that access from outside is not allowed, and where the hub sees the browser', () => {
    const text = refusalText({ network: 'outside', address: '203.0.113.7', refusal: 'outside_not_allowed' });
    expect(text.title).toBe('Access from outside the internal network is not allowed');
    expect(text.where).toBe('This hub sees this browser at 203.0.113.7, outside its internal network.');
  });

  it('asks for HTTPS when that is all that is missing', () => {
    const text = refusalText({ network: 'outside', address: '203.0.113.7', refusal: 'insecure_transport' });
    expect(text.title).toMatch(/HTTPS only/);
    expect(text.detail).toMatch(/https:\/\//);
  });

  it('still reads well when the hub did not say the address', () => {
    expect(refusalText({ refusal: 'outside_not_allowed' }).where).toBe('');
    expect(refusalText(null).title).toMatch(/not allowed/);
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

  it('is a section every signed-in user sees, and the refusal a screen of its own', () => {
    const settings = readFileSync(new URL('../src/views/Settings.svelte', import.meta.url), 'utf8');
    expect(settings).toContain('<AccessSettings />');
    const app = readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8');
    expect(app).toMatch(/view === 'refused'[\s\S]*<Refused \/>/);
  });
});
