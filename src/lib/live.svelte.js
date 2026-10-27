import { auth, getApi } from './auth.svelte.js';
import { notify } from './notify.svelte.js';
import { applyStatus, pausePolling } from './status.svelte.js';

// Live mode: the hub pushes the roll-up over a WebSocket instead of the page polling for it. It is opt-in and
// short-lived on purpose. It switches itself off after IDLE_MS without activity (or when the tab is hidden that
// long), and whenever it cannot work the page simply keeps polling, so the dashboard never depends on it.

export const IDLE_MS = 5 * 60 * 1000;
const PING_MS = 25_000; // keeps the link open through load balancers that drop quiet connections
const DEAD_MS = 70_000; // nothing, not even a pong, for this long: the link is dead
const RETRY_MS = [2000, 5000, 15000, 30000];
const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];

/** state: 'off', 'connecting' (asked for, polling carries on) or 'on' (pushes arrive, polling is held). */
export const live = $state({ state: 'off' });

let socket = null;
let idleTimer = null;
let pingTimer = null;
let retryTimer = null;
let retries = 0;
let everConnected = false;
let lastActivity = 0;
let lastFrameAt = 0;
/** Bumped on every start and stop, so a ticket that arrives after either opens no socket. */
let run = 0;

/** The WebSocket address on the page's own address, where the hub is. No credential ever goes in it. */
export function liveUrl(loc = globalThis.location) {
  return `${loc.protocol.replace(/^http/i, 'ws')}//${loc.host}/api/v1/live`;
}

const bump = () => {
  lastActivity = Date.now();
};

function onVisibility() {
  if (!document.hidden) bump();
}

export function toggleLive() {
  if (live.state === 'off') startLive();
  else stopLive();
}

export function startLive() {
  if (live.state !== 'off' || !auth.signedIn) return;
  live.state = 'connecting';
  everConnected = false;
  retries = 0;
  run++;
  bump();
  for (const type of ACTIVITY) document.addEventListener(type, bump, { passive: true, capture: true });
  document.addEventListener('visibilitychange', onVisibility);
  idleTimer = setInterval(() => {
    if (Date.now() - lastActivity >= IDLE_MS) {
      stopLive('Live view switched off after 5 minutes without activity. Using normal refresh.');
    }
  }, 1000);
  connect();
}

/** Back to polling. A message, if given, is shown as a notice. */
export function stopLive(message = '') {
  if (live.state === 'off') return;
  run++;
  clearInterval(idleTimer);
  clearInterval(pingTimer);
  clearTimeout(retryTimer);
  idleTimer = pingTimer = retryTimer = null;
  for (const type of ACTIVITY) document.removeEventListener(type, bump, { capture: true });
  document.removeEventListener('visibilitychange', onVisibility);
  detach();
  live.state = 'off';
  pausePolling(false);
  if (message) notify(message, 'info', 9000);
}

async function connect() {
  retryTimer = null;
  const current = run;
  // Signed in with the hub's own sign-in, the first frame carries a ticket that works once, so every connection gets
  // a fresh one. Behind a sign-in proxy the proxy adds the credential to the upgrade request: there is no first frame.
  let ticket = null;
  if (auth.mode !== 'proxy') {
    try {
      // A reconnect is the page acting by itself, not someone using it.
      ({ ticket } = await getApi().liveTicket({ background: everConnected }));
    } catch {
      // No ticket is a lost connection, except when the sign-in ended: signing out switches live off by itself.
      if (current === run && auth.signedIn) lost(1006);
      return;
    }
    if (current !== run) return;
  }
  const ws = new WebSocket(liveUrl());
  socket = ws;
  ws.onopen = () => {
    if (ticket) ws.send(JSON.stringify({ type: 'auth', ticket }));
  };
  ws.onmessage = (event) => {
    lastFrameAt = Date.now();
    let frame;
    try {
      frame = JSON.parse(event.data);
    } catch {
      return;
    }
    if (frame.type !== 'status') return;
    if (live.state !== 'on') {
      live.state = 'on';
      everConnected = true;
      retries = 0;
      pausePolling(true);
      clearInterval(pingTimer);
      pingTimer = setInterval(() => ping(ws), PING_MS);
    }
    applyStatus(frame.data);
  };
  ws.onclose = (event) => {
    if (socket !== ws) return;
    socket = null;
    lost(event.code);
  };
}

function ping(ws) {
  if (Date.now() - lastFrameAt > DEAD_MS) {
    detach();
    lost(1006);
    return;
  }
  try {
    ws.send('{"type":"ping"}');
  } catch {
    // a closing socket reports itself through onclose
  }
}

/** Lets go of the current socket without reacting to its close. */
function detach() {
  clearInterval(pingTimer);
  pingTimer = null;
  const ws = socket;
  socket = null;
  if (!ws) return;
  ws.onopen = ws.onmessage = ws.onclose = null;
  try {
    ws.close(1000);
  } catch {
    // already closed
  }
}

function lost(code) {
  clearInterval(pingTimer);
  pingTimer = null;
  if (code === 1013) {
    stopLive('The hub has too many live viewers right now. Using normal refresh.');
  } else if (code === 1008) {
    stopLive('The hub refused the live connection. Using normal refresh.');
  } else if (!everConnected) {
    stopLive('Live view is not available from this hub. Using normal refresh.');
  } else {
    // It worked and then dropped (hub restart, network): poll again now and keep trying to get back.
    live.state = 'connecting';
    pausePolling(false);
    retryTimer = setTimeout(connect, RETRY_MS[Math.min(retries++, RETRY_MS.length - 1)]);
  }
}
