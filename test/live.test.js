import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The live module reads the sign-in state and asks the API client for tickets, and the polling module reads the API
// client too; both are faked so the test drives just the live behaviour: when it connects, what it sends, and when it
// hands back to polling.
const auth = { signedIn: true };
let apiCalls;
let tickets;
let ticketAnswer;
vi.mock('../src/lib/auth.svelte.js', () => ({
  auth,
  getApi: () => ({
    status: async () => ({ polled: ++apiCalls }),
    liveTicket: async (opts) => {
      tickets.push(opts);
      return ticketAnswer(tickets.length);
    },
  }),
}));

const { live, startLive, stopLive, toggleLive, liveUrl, IDLE_MS } = await import('../src/lib/live.svelte.js');
const { status, startPolling, stopPolling } = await import('../src/lib/status.svelte.js');
const { toasts } = await import('../src/lib/notify.svelte.js');

class FakeSocket {
  static all = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.closedWith = null;
    this.mute = false; // a muted hub never answers a ping
    FakeSocket.all.push(this);
  }
  send(text) {
    const frame = JSON.parse(text);
    this.sent.push(frame);
    if (frame.type === 'ping' && !this.mute) this.push({ type: 'pong' });
  }
  close(code) {
    this.closedWith = code;
  }
  // helpers the tests use to play the hub
  open() {
    this.onopen?.();
  }
  push(frame) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
  drop(code = 1006) {
    this.onclose?.({ code });
  }
}

const last = () => FakeSocket.all.at(-1);
const snapshot = (n) => ({ type: 'status', data: { generatedAt: n, summary: { overall: 'UP' } } });

let doc;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.all = [];
  apiCalls = 0;
  doc = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('location', { protocol: 'http:', host: 'hub.local:8080' });
  auth.signedIn = true;
  tickets = [];
  ticketAnswer = async (n) => ({ ticket: `ticket-${n}`, expiresInSeconds: 30 });
  toasts.length = 0;
});

afterEach(() => {
  stopLive();
  stopPolling();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Switches live on and waits for its ticket. Returns the socket. */
async function start() {
  startLive();
  await vi.advanceTimersByTimeAsync(0);
  return last();
}

/** Switches live on and plays the hub's welcome: open, then the first status. Returns the socket. */
async function goLive() {
  const ws = await start();
  ws.open();
  ws.push(snapshot(1));
  return ws;
}

describe('liveUrl', () => {
  it("is on the page's own address, where the hub is", () => {
    expect(liveUrl({ protocol: 'http:', host: 'hub.local:8080' })).toBe('ws://hub.local:8080/api/v1/live');
    expect(liveUrl({ protocol: 'https:', host: 'monitor.example.com' })).toBe('wss://monitor.example.com/api/v1/live');
  });
});

describe('live mode', () => {
  it('fetches a ticket right before connecting and signs in with it in the first frame, never in the address', async () => {
    startLive();
    expect(live.state).toBe('connecting');
    expect(FakeSocket.all).toHaveLength(0); // not before the ticket is there

    await vi.advanceTimersByTimeAsync(0);
    const ws = last();
    expect(tickets).toEqual([{ background: false }]);
    expect(ws.url).toBe('ws://hub.local:8080/api/v1/live');

    ws.open();
    expect(ws.sent).toEqual([{ type: 'auth', ticket: 'ticket-1' }]);
  });

  it('gets a fresh ticket for every connection, since a ticket works once', async () => {
    const first = await goLive();
    first.drop(1006);
    await vi.advanceTimersByTimeAsync(2000);

    const second = last();
    expect(second).not.toBe(first);
    second.open();
    expect(second.sent).toEqual([{ type: 'auth', ticket: 'ticket-2' }]);
    // The reconnect is the page acting by itself, which must not keep the sign-in alive.
    expect(tickets).toEqual([{ background: false }, { background: true }]);
  });

  it('gives up with a notice when there is no ticket to be had', async () => {
    ticketAnswer = async () => {
      throw new Error('not found');
    };
    startLive();
    await vi.advanceTimersByTimeAsync(0);

    expect(live.state).toBe('off');
    expect(FakeSocket.all).toHaveLength(0);
    expect(toasts.some((t) => t.message.includes('not available'))).toBe(true);
  });

  it('keeps quiet when the ticket is refused because the sign-in ended', async () => {
    ticketAnswer = async () => {
      auth.signedIn = false; // what the API client's 401 no_session does, through signOut()
      throw new Error('The sign-in has ended');
    };
    startLive();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.all).toHaveLength(0);
    expect(toasts).toHaveLength(0);
  });

  it('opens no socket when switched off while the ticket is on its way', async () => {
    startLive();
    stopLive();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.all).toHaveLength(0);
    expect(live.state).toBe('off');
  });

  it('takes over from polling once the first status arrives, and shows every push', async () => {
    startPolling(5000);
    await vi.advanceTimersByTimeAsync(0);
    expect(apiCalls).toBe(1);

    const ws = await goLive();
    expect(live.state).toBe('on');
    expect(status.data.generatedAt).toBe(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(apiCalls).toBe(1); // polling is held while pushes arrive

    ws.push(snapshot(2));
    expect(status.data.generatedAt).toBe(2);
    expect(status.error).toBe('');
  });

  it('keeps polling until the hub has actually answered', async () => {
    startPolling(5000);
    await vi.advanceTimersByTimeAsync(0);
    (await start()).open();

    await vi.advanceTimersByTimeAsync(5000);
    expect(live.state).toBe('connecting');
    expect(apiCalls).toBe(2);
  });

  it('pings every 25 seconds', async () => {
    const ws = await goLive();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(ws.sent.at(-1)).toEqual({ type: 'ping' });
    await vi.advanceTimersByTimeAsync(25_000);
    expect(ws.sent.filter((f) => f.type === 'ping')).toHaveLength(2);
  });

  it('switches itself off after five minutes without activity and goes back to polling', async () => {
    startPolling(5000);
    await vi.advanceTimersByTimeAsync(0);
    const ws = await goLive();

    await vi.advanceTimersByTimeAsync(IDLE_MS - 1000);
    expect(live.state).toBe('on');
    await vi.advanceTimersByTimeAsync(2000);

    expect(live.state).toBe('off');
    expect(ws.closedWith).toBe(1000);
    expect(toasts.some((t) => t.message.includes('5 minutes'))).toBe(true);

    const before = apiCalls;
    await vi.advanceTimersByTimeAsync(5000);
    expect(apiCalls).toBeGreaterThan(before);
  });

  it('stays on while you keep using the page', async () => {
    await goLive();
    for (const type of ['pointermove', 'keydown', 'wheel', 'pointerdown']) {
      await vi.advanceTimersByTimeAsync(IDLE_MS - 60_000);
      doc.dispatchEvent(new Event(type));
    }
    expect(live.state).toBe('on');

    await vi.advanceTimersByTimeAsync(IDLE_MS + 2000);
    expect(live.state).toBe('off');
  });

  it('counts coming back to the tab as activity, but not time spent away', async () => {
    await goLive();
    doc.hidden = true;
    await vi.advanceTimersByTimeAsync(IDLE_MS - 10_000);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(IDLE_MS - 10_000);
    expect(live.state).toBe('on');

    doc.hidden = true;
    await vi.advanceTimersByTimeAsync(IDLE_MS + 2000);
    expect(live.state).toBe('off');
  });

  it('polls again at once when the connection drops, and returns to live when it can', async () => {
    startPolling(5000);
    await vi.advanceTimersByTimeAsync(0);
    const first = await goLive();
    const calls = apiCalls;

    first.drop(1006);
    expect(live.state).toBe('connecting');
    await vi.advanceTimersByTimeAsync(0);
    expect(apiCalls).toBe(calls + 1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.all).toHaveLength(2);
    const second = last();
    second.open();
    second.push(snapshot(7));
    expect(live.state).toBe('on');
    expect(status.data.generatedAt).toBe(7);
  });

  it('gives up with a notice when the hub refuses the connection', async () => {
    const ws = await start();
    ws.open();
    ws.drop(1008);

    expect(live.state).toBe('off');
    expect(toasts.some((t) => t.message.includes('refused'))).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('gives up with a notice when the hub is full', async () => {
    (await start()).drop(1013);

    expect(live.state).toBe('off');
    expect(toasts.some((t) => t.message.includes('too many'))).toBe(true);
  });

  it('does not retry a hub that has never answered', async () => {
    (await start()).drop(1006);

    expect(live.state).toBe('off');
    expect(toasts.some((t) => t.message.includes('not available'))).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('treats a silent link as dead and reconnects', async () => {
    const ws = await goLive();
    ws.mute = true;
    await vi.advanceTimersByTimeAsync(75_000);

    expect(ws.closedWith).toBe(1000);
    expect(live.state).toBe('connecting');
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it('the switch toggles it, and does nothing when signed out', async () => {
    toggleLive();
    expect(live.state).toBe('connecting');
    await vi.advanceTimersByTimeAsync(0);
    toggleLive();
    expect(live.state).toBe('off');
    expect(last().closedWith).toBe(1000);

    auth.signedIn = false;
    toggleLive();
    expect(live.state).toBe('off');
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('stopping releases the page: no more listeners, no timers', async () => {
    await goLive();
    stopLive();
    await vi.advanceTimersByTimeAsync(IDLE_MS * 2);
    expect(vi.getTimerCount()).toBe(0);
    expect(toasts).toHaveLength(0);
  });
});
