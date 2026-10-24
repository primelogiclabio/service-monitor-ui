import { describe, expect, it } from 'vitest';
import {
  ago,
  chartKind,
  cleanMessage,
  fmtAxis,
  fmtLatency,
  fmtPct,
  headline,
  hexToRgba,
  plural,
  rangeMs,
  reading,
  toPoints,
  worst,
} from '../src/lib/format.js';

describe('ago', () => {
  const now = 1_000_000_000_000;
  it('handles missing and future times', () => {
    expect(ago(null, now)).toBe('never');
    expect(ago(now + 5000, now)).toBe('just now');
  });
  it('picks the largest sensible unit', () => {
    expect(ago(now - 5_000, now)).toBe('5s ago');
    expect(ago(now - 3 * 60_000, now)).toBe('3m ago');
    expect(ago(now - 5 * 3_600_000, now)).toBe('5h ago');
    expect(ago(now - 3 * 86_400_000, now)).toBe('3d ago');
  });
});

describe('number formatting', () => {
  it('formats percentages to one decimal', () => {
    expect(fmtPct(91.46)).toBe('91.5%');
    expect(fmtPct(7)).toBe('7.0%');
    expect(fmtPct(null)).toBe('–');
  });
  it('formats latency', () => {
    expect(fmtLatency(0.4)).toBe('<1 ms');
    expect(fmtLatency(48.2)).toBe('48 ms');
    expect(fmtLatency(1500)).toBe('1.5 s');
    expect(fmtLatency(null)).toBe('–');
  });
  it('formats axis ticks', () => {
    expect(fmtAxis(50, '%')).toBe('50%');
    expect(fmtAxis(250, 'ms')).toBe('250ms');
    expect(fmtAxis(2500, 'ms')).toBe('2.5s');
  });
  it('shows the reading that fits the check', () => {
    expect(reading({ value: 12.34 })).toBe('12.3%');
    expect(reading({ latencyMs: 48 })).toBe('48 ms');
    expect(reading({})).toBe('');
  });
});

describe('worst', () => {
  it('ranks DOWN > WARN > UNKNOWN > UP', () => {
    expect(worst([])).toBe('UNKNOWN');
    expect(worst(['UP', 'UP'])).toBe('UP');
    expect(worst(['UP', 'UNKNOWN'])).toBe('UNKNOWN');
    expect(worst(['UP', 'WARN', 'UNKNOWN'])).toBe('WARN');
    expect(worst(['WARN', 'DOWN', 'UP'])).toBe('DOWN');
  });
});

describe('plural', () => {
  it('chooses the form by count', () => {
    expect(plural(1, 'server')).toBe('server');
    expect(plural(0, 'server')).toBe('servers');
    expect(plural(2, 'check')).toBe('checks');
  });
});

describe('headline', () => {
  const counts = (up = 0, warn = 0, down = 0, unknown = 0) => ({ up, warn, down, unknown });
  const data = (overall, checks, servers) => ({
    summary: { overall, checks, servers: counts() },
    clusters: [{ name: 'prod', status: overall, servers }],
    hubChecks: [],
  });
  const srv = (agentOnline = true) => ({ id: 'x', name: 'x', agentOnline, checks: [] });

  it('waits for data', () => {
    expect(headline(null).text).toBe('Connecting to the hub');
  });
  it('says so when nothing is monitored', () => {
    expect(headline({ summary: { overall: 'UNKNOWN', checks: counts(), servers: counts() }, clusters: [], hubChecks: [] }).text).toBe(
      'Nothing is monitored yet',
    );
  });
  it('reports all clear', () => {
    expect(headline(data('UP', counts(5), [srv()]))).toEqual({ tone: 'UP', text: 'All systems operational' });
  });
  it('lists what is wrong', () => {
    const h = headline(data('DOWN', counts(5, 2, 1), [srv(), srv(false)]));
    expect(h.tone).toBe('DOWN');
    expect(h.text).toBe('1 check down, 1 server offline, 2 warnings');
  });
});

describe('toPoints', () => {
  it('sorts ascending and drops rows without the field', () => {
    const rows = [
      { ts: 3000, value: 3 },
      { ts: 1000, value: 1 },
      { ts: 2000, value: null },
      { ts: 2500 },
    ];
    expect(toPoints(rows, 'value')).toEqual([
      { ts: 1000, value: 1 },
      { ts: 3000, value: 3 },
    ]);
  });
});

describe('cleanMessage', () => {
  it('drops a repeated name or target prefix', () => {
    expect(cleanMessage({ target: 'W3SVC', name: 'IIS', message: 'W3SVC: running' })).toBe('running');
    expect(cleanMessage({ target: 'x', name: 'postgresql.service', message: 'postgresql.service: inactive (dead)' })).toBe('inactive (dead)');
  });
  it('leaves other messages alone', () => {
    expect(cleanMessage({ target: 'C:', name: 'Disk', message: 'C:\\ 64.3% used' })).toBe('C:\\ 64.3% used');
    expect(cleanMessage({ name: 'x' })).toBe('');
  });
});

describe('hexToRgba', () => {
  it('converts long and short hex', () => {
    expect(hexToRgba('#2a78d6', 0.1)).toBe('rgba(42, 120, 214, 0.1)');
    expect(hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('ranges and chart kinds', () => {
  it('falls back to six hours for unknown keys', () => {
    expect(rangeMs('1h')).toBe(3_600_000);
    expect(rangeMs('nope')).toBe(6 * 3_600_000);
  });
  it('maps check types to charts', () => {
    expect(chartKind('CPU')).toEqual({ field: 'value', unit: '%' });
    expect(chartKind('PING')).toEqual({ field: 'latencyMs', unit: 'ms' });
    expect(chartKind('SERVICE')).toBeNull();
  });
});
