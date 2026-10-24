import { parseHash } from './router.js';

export const route = $state({ name: 'overview', params: {} });

function sync() {
  const next = parseHash(location.hash);
  route.name = next.name;
  route.params = next.params;
}

export function startRouter() {
  sync();
  window.addEventListener('hashchange', sync);
}

export function navigate(hash) {
  location.hash = hash;
}
