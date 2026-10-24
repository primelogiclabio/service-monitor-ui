// Hash routing keeps the dashboard working from any folder or sub-path, with no server rewrites.

/** Parses a location hash such as "#/server/abc" into { name, params }. */
export function parseHash(hash) {
  const path = (hash || '').replace(/^#/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'server':
      return parts[1] ? { name: 'server', params: { id: parts[1] } } : { name: 'overview', params: {} };
    case 'checks':
      return { name: 'checks', params: {} };
    case 'enroll':
      return { name: 'enroll', params: {} };
    case 'tokens':
      return { name: 'tokens', params: {} };
    case 'help':
      return { name: 'help', params: {} };
    default:
      return { name: 'overview', params: {} };
  }
}

export function serverHref(id) {
  return `#/server/${encodeURIComponent(id)}`;
}
