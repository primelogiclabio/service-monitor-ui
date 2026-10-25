import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROXY, loadConfig, parseConfig } from '../src/lib/config.js';

describe('parseConfig', () => {
  it('has no proxy mode unless asked for', () => {
    for (const raw of [{}, { proxy: false }, { proxy: null }]) {
      expect(parseConfig(raw)).toEqual({ proxy: null });
    }
  });

  it('proxy: true uses every default', () => {
    expect(parseConfig({ proxy: true })).toEqual({ proxy: DEFAULT_PROXY });
  });

  it('takes the deployment\'s own paths and headers', () => {
    const { proxy } = parseConfig({
      proxy: { apiBase: '/web-api/', headers: { 'X-PLL-Web': '1' }, signInUrl: 'https://auth.example.com/start', signOutUrl: '/bye' },
    });
    expect(proxy).toEqual({
      apiBase: '/web-api',
      headers: { 'X-PLL-Web': '1' },
      signInUrl: 'https://auth.example.com/start',
      signOutUrl: '/bye',
    });
  });

  it('fills in what an object leaves out', () => {
    const { proxy } = parseConfig({ proxy: { headers: { 'X-PLL-Web': '1' } } });
    expect(proxy.apiBase).toBe('/web-api');
    expect(proxy.signInUrl).toBe('/oauth2/start');
  });

  it('refuses a typo or a wrong value instead of ignoring it', () => {
    const bad = [
      [[], /JSON object/],
      ['x', /JSON object/],
      [{ prox: true }, /unknown setting "prox"/],
      [{ proxy: 'yes' }, /true, false or an object/],
      [{ proxy: { apiBas: '/x' } }, /unknown setting "proxy.apiBas"/],
      [{ proxy: { apiBase: 'web-api' } }, /apiBase/],
      [{ proxy: { apiBase: '//evil.example.com' } }, /apiBase/],
      [{ proxy: { apiBase: 'https://evil.example.com/api' } }, /apiBase/],
      [{ proxy: { headers: 'X-A: 1' } }, /headers/],
      [{ proxy: { headers: { 'X A': '1' } } }, /invalid entry/],
      [{ proxy: { headers: { 'X-A': 1 } } }, /invalid entry/],
      [{ proxy: { headers: { Authorization: 'Bearer x' } } }, /must not set Authorization/],
      [{ proxy: { headers: { authorization: 'Bearer x' } } }, /must not set Authorization/],
      [{ proxy: { signInUrl: 'javascript:alert(1)' } }, /signInUrl/],
      [{ proxy: { signOutUrl: 'data:text/html,x' } }, /signOutUrl/],
      [{ proxy: { signOutUrl: '//evil.example.com' } }, /signOutUrl/],
    ];
    for (const [raw, message] of bad) {
      expect(() => parseConfig(raw), JSON.stringify(raw)).toThrow(message);
    }
  });
});

describe('loadConfig', () => {
  const answer = (status, text) => vi.fn(async () => ({ ok: status < 300, status, text: async () => text }));

  it('reads config.json next to the page, never from a cache', async () => {
    const fetchImpl = answer(200, '{"proxy": true}');
    expect((await loadConfig(fetchImpl)).proxy.apiBase).toBe('/web-api');
    expect(fetchImpl).toHaveBeenCalledWith('./config.json', { cache: 'no-store' });
  });

  it('treats a missing, unreachable or non-JSON file as no settings', async () => {
    expect(await loadConfig(answer(404, 'not found'))).toEqual({ proxy: null });
    expect(await loadConfig(answer(200, '<!doctype html><title>page</title>'))).toEqual({ proxy: null });
    expect(await loadConfig(vi.fn(async () => { throw new TypeError('offline'); }))).toEqual({ proxy: null });
  });

  it('still refuses a file that is JSON but wrong', async () => {
    await expect(loadConfig(answer(200, '{"proxy": {"apiBase": "nope"}}'))).rejects.toThrow(/config.json/);
  });
});
