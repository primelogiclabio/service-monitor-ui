// Settings > Sign-in: how sign-in with the identity provider is set up, from GET /oidc, in words for a person. It is
// set in the hub's settings file, never here. Pure functions, so they are easy to test.

/**
 * The rows of the Sign-in section, from GET /oidc: `{ label, value, copy }`, where `copy` marks a value someone pastes
 * into the provider. Null when the hub has no identity provider.
 */
export function providerRows(view, now = Date.now()) {
  if (!view?.configured) return null;
  const privateKey = view.clientAuth === 'private-key-jwt';
  const files = view.keySource === 'files';
  const rows = [
    { label: 'Identity provider', value: view.issuer },
    { label: 'Client id', value: view.clientId, copy: true },
    {
      label: 'How the hub signs in',
      value: !privateKey
        ? 'With a client secret read from a file (client-secret)'
        : files
          ? `With the key pair in ${view.privateKeyFile} (private_key_jwt, ${view.signingAlgorithm}); key id ${view.keyId}`
          : `With its own key pair (private_key_jwt, ${view.signingAlgorithm}); key id ${view.keyId}`,
    },
  ];
  if (files && view.certificateExpiresAt) {
    rows.push({ label: 'Certificate expires', value: expiryText(view.certificateExpiresAt, now) });
  }
  rows.push(
    { label: 'Redirect URI', value: view.redirectUri, copy: true },
    { label: 'Post-logout redirect URI', value: view.postLogoutRedirectUri, copy: true },
  );
  if (privateKey) rows.push({ label: 'Public key address (JWKS URL)', value: view.jwksUri, copy: true });
  rows.push(
    { label: 'Scopes', value: (view.scopes ?? []).join(' ') },
    { label: 'Roles claim', value: view.rolesClaim },
    { label: 'Administrator role', value: view.adminRole },
    { label: 'Read-only role', value: view.readRole ?? 'none: administrators only' },
    { label: 'User name claim', value: `${view.usernameClaim}, else email` },
    { label: 'Button', value: view.buttonLabel },
  );
  return rows;
}

/** The hub warns from this many days before its key pair's certificate expires, as it does in its log. */
export const EXPIRY_WARN_DAYS = 30;
const DAY = 86_400_000;

/** Calendar days (UTC) until `expiresAt`, as the hub and signing-keys-tool count them; negative once it has passed. */
export function daysLeft(expiresAt, now = Date.now()) {
  return Math.floor(expiresAt / DAY) - Math.floor(now / DAY);
}

function expiryText(expiresAt, now) {
  const date = new Date(expiresAt).toISOString().slice(0, 10);
  const days = daysLeft(expiresAt, now);
  return days < 0 ? `${date} (expired)` : `${date} (${days} days left)`;
}

/**
 * Whether the provider answered, as a banner: `{ ok, text }`. A key pair from files whose certificate expires within
 * 30 days, or has expired, is said first: the provider may refuse the hub's sign-in once it has.
 */
export function providerHealth(view, now = Date.now()) {
  if (!view?.configured) return null;
  if (view.keySource === 'files' && view.certificateExpiresAt) {
    const days = daysLeft(view.certificateExpiresAt, now);
    if (days < 0) {
      return {
        ok: false,
        text: 'The certificate of the hub\'s key pair has expired, so the provider may refuse the hub\'s sign-in. Make a new pair with signing-keys-tool and give the provider its certificate.',
      };
    }
    if (days <= EXPIRY_WARN_DAYS) {
      return {
        ok: false,
        text: `The certificate of the hub's key pair expires in ${days} day(s). Make a new pair with signing-keys-tool, give the provider its certificate, and point the hub's settings at it.`,
      };
    }
  }
  if (view.reachable) {
    return {
      ok: true,
      text: `The provider answered. ${view.signOutAtProvider ? 'Signing out also signs out there.' : 'It has no sign-out address, so signing out ends only the hub\'s sign-in.'}`,
    };
  }
  return {
    ok: false,
    text: `The hub has not reached the provider yet${view.problem ? `: ${view.problem}` : ''}. It asks again when someone signs in.`,
  };
}
