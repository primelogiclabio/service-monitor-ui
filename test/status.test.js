import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Polling is the page asking by itself, so it is marked as such and does not keep a sign-in alive; a refresh after
// something the user did is not.
let asked;
vi.mock('../src/lib/auth.svelte.js', () => ({
  getApi: () => ({
    status: async (opts) => {
      asked.push(opts);
      return { generatedAt: asked.length };
    },
  }),
}));

const { refresh, startPolling, stopPolling } = await import('../src/lib/status.svelte.js');

beforeEach(() => {
  vi.useFakeTimers();
  asked = [];
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
});

afterEach(() => {
  stopPolling();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('status polling', () => {
  it('marks every request it makes on its own as background', async () => {
    startPolling(5000);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);

    expect(asked.length).toBeGreaterThanOrEqual(4);
    expect(asked.every((o) => o.background === true)).toBe(true);
  });

  it('a refresh after a change someone made counts as use', async () => {
    await refresh();
    expect(asked).toEqual([{ background: false }]);
  });
});
