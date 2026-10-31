// Where the hub lets people in from (svcmon.access) and how it sees this browser, in words for a person. The hub
// decides; the page only explains. Pure functions, so they are easy to test.

/** The hub's error codes for a request refused because of where it comes from. */
export const REFUSALS = new Set(['outside_not_allowed', 'insecure_transport']);

/**
 * From outside, a hub with an identity provider takes only the provider's sign-in: a password, or a sign-in made with
 * one, is refused with this code. Unlike the refusals above, there is still a way in from here.
 */
export const PASSWORD_INSIDE_ONLY = 'password_inside_only';

/** A refusal that ends the sign-in this page has: either of the above. */
export function endsSignIn(code) {
  return REFUSALS.has(code) || code === PASSWORD_INSIDE_ONLY;
}

/** The lines of Settings > Access, from GET /access. */
export function describeAccess(view) {
  if (!view) return null;
  const outside = view.network === 'outside';
  return {
    rule: view.allowOutside
      ? 'People outside the internal network may sign in, over HTTPS only (with the identity provider only, when the hub has one). API tokens and the initial password work from inside only.'
      : 'Only people on the internal network may use this hub. Everyone else is refused, whatever they sign in with.',
    setting: `svcmon.access.allow-outside: ${view.allowOutside ? 'true' : 'false'}`,
    browser: `This browser is seen as ${outside ? 'outside' : 'inside'} the internal network (${view.address})${view.secure ? ', over HTTPS' : ', over plain HTTP'}.`,
    networks: view.internalNetworks ?? [],
    proxies: view.publicProxies ?? [],
    outside,
  };
}
