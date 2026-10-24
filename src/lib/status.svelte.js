import { getApi } from './auth.svelte.js';

/** The latest roll-up from the hub. On errors the previous data stays on screen. */
export const status = $state({ data: null, error: '', loading: false, updatedAt: 0 });

let timer = null;
let inflight = false;

export async function refresh() {
  const api = getApi();
  if (!api || inflight) return;
  inflight = true;
  status.loading = true;
  try {
    status.data = await api.status();
    status.error = '';
    status.updatedAt = Date.now();
  } catch (e) {
    status.error = e.message;
  } finally {
    inflight = false;
    status.loading = false;
  }
}

function onVisibility() {
  if (!document.hidden) refresh();
}

/** Polls while the tab is visible. Safe to call more than once. */
export function startPolling(intervalMs = 5000) {
  stopPolling();
  refresh();
  timer = setInterval(() => {
    if (!document.hidden) refresh();
  }, intervalMs);
  document.addEventListener('visibilitychange', onVisibility);
}

export function stopPolling() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVisibility);
  status.data = null;
  status.error = '';
}
