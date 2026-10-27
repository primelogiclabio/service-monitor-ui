import { getApi } from './auth.svelte.js';

/** The latest roll-up from the hub. On errors the previous data stays on screen. */
export const status = $state({ data: null, error: '', loading: false, updatedAt: 0 });

let timer = null;
let inflight = false;
let paused = false;

/** The page asking by itself, not someone using it: the hub does not count it towards keeping the sign-in alive. */
const BACKGROUND = { background: true };

/** Shows a roll-up the hub pushed over the live connection. */
export function applyStatus(data) {
  status.data = data;
  status.error = '';
  status.updatedAt = Date.now();
}

/** Fetches the roll-up now. Pages call it after a change someone made; the timer passes `background`. */
export async function refresh({ background = false } = {}) {
  const api = getApi();
  if (!api || inflight) return;
  inflight = true;
  status.loading = true;
  const startedAt = Date.now();
  try {
    const data = await api.status({ background });
    // A push that landed while this request was out is newer than its answer.
    if (status.updatedAt > startedAt) return;
    applyStatus(data);
  } catch (e) {
    status.error = e.message;
  } finally {
    inflight = false;
    status.loading = false;
  }
}

function onVisibility() {
  if (!document.hidden && !paused) refresh(BACKGROUND);
}

/** Polls while the tab is visible. Safe to call more than once. */
export function startPolling(intervalMs = 5000) {
  stopPolling();
  refresh(BACKGROUND);
  timer = setInterval(() => {
    if (!document.hidden && !paused) refresh(BACKGROUND);
  }, intervalMs);
  document.addEventListener('visibilitychange', onVisibility);
}

/** Holds polling while the live connection supplies the data; resuming fetches at once. */
export function pausePolling(on) {
  paused = on;
  if (!on && timer) refresh(BACKGROUND);
}

export function stopPolling() {
  if (timer) clearInterval(timer);
  timer = null;
  paused = false;
  document.removeEventListener('visibilitychange', onVisibility);
  status.data = null;
  status.error = '';
}
