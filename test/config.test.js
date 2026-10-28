import { describe, expect, it, vi } from 'vitest';
import { loadConfig, parseConfig } from '../src/lib/config.js';

describe('parseConfig', () => {
  it('has no settings; an empty file and what the shipped file used to say are fine', () => {
    for (const raw of [{}, { proxy: false }, { proxy: null }]) {
      expect(parseConfig(raw)).toEqual({});
    }
  });

  it('says the proxy sign-in was removed instead of silently ignoring it', () => {
    for (const proxy of [true, { apiBase: '/web-api', headers: { 'X-PLL-Web': '1' } }, 'yes']) {
      expect(() => parseConfig({ proxy }), JSON.stringify(proxy)).toThrow(/"proxy" was removed: .*your account on the hub/);
    }
  });

  it('refuses a typo or a wrong file instead of ignoring it', () => {
    for (const [raw, message] of [
      [[], /JSON object/],
      ['x', /JSON object/],
      [{ prox: false }, /unknown setting "prox"/],
    ]) {
      expect(() => parseConfig(raw), JSON.stringify(raw)).toThrow(message);
    }
  });
});

describe('loadConfig', () => {
  const answer = (status, text) => vi.fn(async () => ({ ok: status < 300, status, text: async () => text }));

  it('reads config.json next to the page, never from a cache', async () => {
    const fetchImpl = answer(200, '{}');
    expect(await loadConfig(fetchImpl)).toEqual({});
    expect(fetchImpl).toHaveBeenCalledWith('./config.json', { cache: 'no-store' });
  });

  it('treats a missing, unreachable or non-JSON file as no settings', async () => {
    expect(await loadConfig(answer(404, 'not found'))).toEqual({});
    expect(await loadConfig(answer(200, '<!doctype html><title>page</title>'))).toEqual({});
    expect(await loadConfig(vi.fn(async () => { throw new TypeError('offline'); }))).toEqual({});
  });

  it('still refuses a file that is JSON but wrong', async () => {
    await expect(loadConfig(answer(200, '{"proxy": true}'))).rejects.toThrow(/config.json/);
  });
});
