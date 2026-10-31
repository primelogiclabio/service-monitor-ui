import { describe, expect, it } from 'vitest';
import { providerHealth, providerRows } from '../src/lib/provider.js';
import { providerSignInMessage, userAction, userSignIn, webAddress } from '../src/lib/account.js';
import { endsSignIn, isRefusal } from '../src/lib/access.js';

const VIEW = {
  configured: true,
  issuer: 'https://auth.example/realms/main',
  clientId: 'service-monitor',
  clientAuth: 'private-key-jwt',
  signingAlgorithm: 'RS256',
  keyId: 'kid-123',
  publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----\n',
  redirectUri: 'https://monitor.example/api/v1/oidc/callback',
  jwksUri: 'https://monitor.example/api/v1/oidc/jwks',
  postLogoutRedirectUri: 'https://monitor.example/',
  scopes: ['openid', 'profile', 'email'],
  rolesClaim: 'realm_access.roles',
  adminRole: 'platform-admin',
  usernameClaim: 'preferred_username',
  buttonLabel: 'Sign in with Keycloak',
  reachable: true,
  signOutAtProvider: true,
};

describe('Settings > Sign-in', () => {
  it('lists what the provider needs, marking what is pasted there', () => {
    const rows = providerRows(VIEW);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel['Client id']).toEqual({ label: 'Client id', value: 'service-monitor', copy: true });
    expect(byLabel['Redirect URI'].copy).toBe(true);
    expect(byLabel['Public key address (JWKS URL)'].value).toBe(VIEW.jwksUri);
    expect(byLabel['How the hub signs in'].value).toMatch(/own key pair .*RS256.*kid-123/);
    expect(byLabel['Read-only role'].value).toMatch(/administrators only/);
    expect(byLabel['Scopes'].value).toBe('openid profile email');
  });

  it('a hub with a client secret has no key address, and never shows the secret', () => {
    const rows = providerRows({ ...VIEW, clientAuth: 'client-secret', jwksUri: null, keyId: null, signingAlgorithm: null });
    expect(rows.find((r) => r.label.startsWith('Public key'))).toBeUndefined();
    expect(rows.find((r) => r.label === 'How the hub signs in').value).toMatch(/client secret read from a file/);
  });

  it('says whether the provider answered', () => {
    expect(providerHealth(VIEW)).toEqual({ ok: true, text: expect.stringMatching(/answered.*signs out there/) });
    const down = providerHealth({ ...VIEW, reachable: false, problem: 'its discovery document could not be read' });
    expect(down.ok).toBe(false);
    expect(down.text).toMatch(/not reached the provider yet: its discovery document/);
  });

  it('a key pair from files shows where it is and when its certificate expires', () => {
    const NOW = Date.UTC(2026, 9, 31);
    const files = { ...VIEW, keySource: 'files', privateKeyFile: '/etc/svcmon/keys/signing-private.pem',
      certificateExpiresAt: NOW + 400 * 86_400_000, certificatePem: '-----BEGIN CERTIFICATE-----\nMIIC\n-----END CERTIFICATE-----\n' };
    const byLabel = Object.fromEntries(providerRows(files, NOW).map((r) => [r.label, r.value]));
    expect(byLabel['How the hub signs in']).toMatch(/key pair in \/etc\/svcmon\/keys\/signing-private\.pem/);
    expect(byLabel['Certificate expires']).toBe('2027-12-05 (400 days left)');
    expect(providerRows(VIEW, NOW).find((r) => r.label === 'Certificate expires')).toBeUndefined();
    expect(providerHealth(files, NOW).ok).toBe(true);
  });

  it('warns from 30 days before the certificate expires, and once it has', () => {
    const NOW = Date.UTC(2026, 9, 31);
    const at = (days) => ({ ...VIEW, keySource: 'files', certificateExpiresAt: NOW + days * 86_400_000 + 1000 });
    expect(providerHealth(at(31), NOW).ok).toBe(true);
    expect(providerHealth(at(30), NOW)).toEqual({ ok: false, text: expect.stringMatching(/expires in 30 day/) });
    expect(providerHealth(at(-2), NOW)).toEqual({ ok: false, text: expect.stringMatching(/has expired/) });
    expect(providerRows(at(-2), NOW).find((r) => r.label === 'Certificate expires').value).toMatch(/\(expired\)$/);
  });

  it('is empty on a hub without a provider', () => {
    expect(providerRows({ configured: false })).toBeNull();
    expect(providerHealth({ configured: false })).toBeNull();
    expect(providerRows(null)).toBeNull();
  });
});

describe('signing in with the provider, in words', () => {
  it('explains each of the hub codes it can come back with', () => {
    for (const code of ['no_role', 'account_disabled', 'username_taken', 'username_unusable', 'expired',
      'provider_refused', 'provider_unavailable', 'invalid_response', 'outside_not_allowed', 'insecure_transport',
      'not_configured']) {
      expect(providerSignInMessage(code), code).not.toBe(providerSignInMessage('something-else'));
    }
    expect(providerSignInMessage('<script>')).toBe('Signing in with the identity provider did not work.');
  });

  it('follows only web addresses', () => {
    expect(webAddress('https://auth.example/logout?x=1')).toBe('https://auth.example/logout?x=1');
    expect(webAddress('http://127.0.0.1:8080/api/v1/oidc/start')).toBe('http://127.0.0.1:8080/api/v1/oidc/start');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '/relative', '', null, 42]) expect(webAddress(bad), String(bad)).toBe('');
  });

  it('a provider user signs in with the provider, which the confirmations say', () => {
    expect(userSignIn({ provider: true })).toBe('Identity provider');
    expect(userSignIn({ provider: false })).toBe('Password');
    expect(userAction('enable', { username: 'alice', provider: true }).message).toMatch(/with the identity provider/);
    expect(userAction('delete', { username: 'alice', provider: true }).message).toMatch(/a new one is made/);
    expect(userAction('enable', { username: 'bob' }).message).toMatch(/their password/);
  });

  it('a password refused outside ends this sign-in but is not a refusal of the browser', () => {
    expect(endsSignIn('password_inside_only')).toBe(true);
    expect(isRefusal('password_inside_only')).toBe(false);
    expect(endsSignIn('outside_not_allowed')).toBe(true);
    expect(endsSignIn('forbidden')).toBe(false);
  });
});
