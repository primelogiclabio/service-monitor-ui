import { describe, expect, it } from 'vitest';
import { filterChecks, flattenChecks } from '../src/lib/checks.js';

const check = (id, name, over = {}) => ({ id, name, type: 'HTTP', status: 'UP', enabled: true, target: null, ...over });

const roll = {
  clusters: [
    {
      name: 'prod',
      servers: [
        { id: 's1', name: 'web01', checks: [check('c1', 'Health', { target: 'http://web01/health' }), check('c2', 'CPU', { type: 'CPU', status: 'DOWN' })] },
        { id: 's2', name: 'db01', checks: [check('c3', 'Port', { type: 'TCP', enabled: false })] },
      ],
    },
    { name: 'staging', servers: [{ id: 's3', name: 'stage01', checks: [check('c4', 'Health', { status: 'WARN' })] }] },
  ],
  hubChecks: [check('h1', 'Public site', { target: 'https://example.com' })],
};

describe('flattenChecks', () => {
  it('lists every check across all clusters with its server and cluster, then the hub checks', () => {
    const all = flattenChecks(roll);
    expect(all.map((c) => [c.id, c.serverName, c.cluster])).toEqual([
      ['c1', 'web01', 'prod'],
      ['c2', 'web01', 'prod'],
      ['c3', 'db01', 'prod'],
      ['c4', 'stage01', 'staging'],
      ['h1', null, null],
    ]);
  });

  it('is empty until the first roll-up arrives', () => {
    expect(flattenChecks(null)).toEqual([]);
  });
});

describe('filterChecks', () => {
  const all = flattenChecks(roll);
  const ids = (filters) => filterChecks(all, filters).map((c) => c.id);

  it('shows everything by default', () => {
    expect(ids()).toEqual(['c1', 'c2', 'c3', 'c4', 'h1']);
  });

  it('keeps one cluster and drops the hub checks, which belong to none', () => {
    expect(ids({ cluster: 'prod' })).toEqual(['c1', 'c2', 'c3']);
    expect(ids({ cluster: 'staging' })).toEqual(['c4']);
    expect(ids({ cluster: 'nowhere' })).toEqual([]);
  });

  it('combines the cluster with the other filters', () => {
    expect(ids({ cluster: 'prod', type: 'CPU' })).toEqual(['c2']);
    expect(ids({ cluster: 'prod', state: 'problems' })).toEqual(['c2']);
    expect(ids({ cluster: 'prod', state: 'disabled' })).toEqual(['c3']);
    expect(ids({ cluster: 'staging', query: ' HEALTH ' })).toEqual(['c4']);
  });

  it('searches the name, target and server', () => {
    expect(ids({ query: 'web01' })).toEqual(['c1', 'c2']);
    expect(ids({ query: 'example.com' })).toEqual(['h1']);
    expect(ids({ query: 'health' })).toEqual(['c1', 'c4']);
  });

  it('counts a warning as a problem but not a disabled check', () => {
    expect(ids({ state: 'problems' })).toEqual(['c2', 'c4']);
  });
});
