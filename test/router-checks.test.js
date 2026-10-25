import { describe, expect, it } from 'vitest';
import { parseHash, serverHref } from '../src/lib/router.js';
import { defToRequest, defaultThresholds, isDown, thresholdsFor } from '../src/lib/checks.js';

describe('parseHash', () => {
  it('routes known paths', () => {
    expect(parseHash('#/')).toEqual({ name: 'overview', params: {} });
    expect(parseHash('')).toEqual({ name: 'overview', params: {} });
    expect(parseHash('#/checks')).toEqual({ name: 'checks', params: {} });
    expect(parseHash('#/enroll')).toEqual({ name: 'enroll', params: {} });
    expect(parseHash('#/tokens')).toEqual({ name: 'tokens', params: {} });
    expect(parseHash('#/help')).toEqual({ name: 'help', params: {} });
  });
  it('reads the server id and decodes it', () => {
    expect(parseHash('#/server/abc-123')).toEqual({ name: 'server', params: { id: 'abc-123' } });
    expect(parseHash(serverHref('a b/c'))).toEqual({ name: 'server', params: { id: 'a b/c' } });
  });
  it('falls back to the overview', () => {
    expect(parseHash('#/server')).toEqual({ name: 'overview', params: {} });
    expect(parseHash('#/nonsense')).toEqual({ name: 'overview', params: {} });
  });
  it('ignores a query string', () => {
    expect(parseHash('#/checks?x=1')).toEqual({ name: 'checks', params: {} });
  });
});

describe('defToRequest', () => {
  const def = {
    id: 'c1',
    name: 'cpu',
    type: 'CPU',
    config: { warn: 80 },
    intervalSeconds: 30,
    timeoutMs: 5000,
    failuresBeforeDown: 1,
    runFrom: 'AGENT',
    serverId: 's1',
    enabled: true,
  };
  it('keeps the editable fields and drops the id', () => {
    const body = defToRequest(def);
    expect(body).not.toHaveProperty('id');
    expect(body).toMatchObject({ name: 'cpu', type: 'CPU', serverId: 's1', runFrom: 'AGENT', enabled: true });
    expect(body).not.toHaveProperty('target');
  });
  it('applies overrides', () => {
    expect(defToRequest(def, { enabled: false }).enabled).toBe(false);
  });
});

describe('thresholds', () => {
  it('uses the agent defaults when a check sets none', () => {
    expect(defaultThresholds('DISK')).toEqual({ warn: 80, crit: 90 });
    expect(thresholdsFor('CPU', {})).toEqual({ warn: 85, crit: 95 });
  });
  it('prefers the check own numbers', () => {
    expect(thresholdsFor('MEMORY', { warn: 70, crit: 80 })).toEqual({ warn: 70, crit: 80 });
    expect(thresholdsFor('CPU', { warn: '70' })).toEqual({ warn: 85, crit: 95 });
  });
  it('has none for non-percentage checks', () => {
    expect(thresholdsFor('HTTP', {})).toEqual({ warn: null, crit: null });
  });
});

describe('isDown', () => {
  it('is true only for an enabled check reporting DOWN', () => {
    expect(isDown({ enabled: true, status: 'DOWN' })).toBe(true);
    for (const status of ['UP', 'WARN', 'UNKNOWN']) expect(isDown({ enabled: true, status }), status).toBe(false);
    // A disabled check shows as Disabled, so it is not highlighted even if its last result was DOWN.
    expect(isDown({ enabled: false, status: 'DOWN' })).toBe(false);
    expect(isDown(undefined)).toBe(false);
  });
});
