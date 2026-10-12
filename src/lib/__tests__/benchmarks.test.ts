import { describe, expect, it } from 'vitest';
import { BENCHMARKS, benchmarksFor, defaultBenchmarkFor, findBenchmark } from '../benchmarks';
import { ISIN_RE, isValidIsin } from '../isin';
import { parseBenchmarkPref } from '../profileStore';

describe('BENCHMARKS', () => {
  it('has valid ISINs (format and check digit)', () => {
    for (const b of BENCHMARKS) {
      expect(ISIN_RE.test(b.isin), b.symbol).toBe(true);
      expect(isValidIsin(b.isin), `${b.symbol} ${b.isin}`).toBe(true);
    }
  });
  it('has unique symbols and every entry unreviewed', () => {
    expect(new Set(BENCHMARKS.map((b) => b.symbol)).size).toBe(BENCHMARKS.length);
    expect(BENCHMARKS.every((b) => b.reviewed === false)).toBe(true);
  });
  it('marks only S&P 500 equity entries as optional', () => {
    expect(BENCHMARKS.filter((b) => b.optional).map((b) => b.symbol)).toEqual(['SXR8.DE', 'SC0J.DE']);
  });
  it('filters by class and never mixes classes', () => {
    expect(benchmarksFor('bond').map((b) => b.symbol)).toEqual(['AGGH.MI', 'XGLE.DE', 'IEGA.MI', 'IEAC.MI', 'IBGS.MI']);
    expect(benchmarksFor('mixed')).toHaveLength(2);
    expect(benchmarksFor('other')).toEqual([]);
    expect(benchmarksFor('unknown')).toEqual([]);
  });
  it('gives class defaults that belong to the class', () => {
    expect(defaultBenchmarkFor('equity')).toBe('VWCE.DE');
    expect(defaultBenchmarkFor('bond')).toBe('AGGH.MI');
    expect(defaultBenchmarkFor('mixed')).toBe('V60A.DE');
    expect(defaultBenchmarkFor('other')).toBeUndefined();
    expect(defaultBenchmarkFor('unknown')).toBeUndefined();
    expect(defaultBenchmarkFor(undefined)).toBeUndefined();
    for (const c of ['equity', 'bond', 'mixed'] as const) expect(findBenchmark(defaultBenchmarkFor(c)!)?.assetClass).toBe(c);
  });
  it('finds case-insensitively', () => {
    expect(findBenchmark('vwce.de')?.isin).toBe('IE00BK5BQT80');
    expect(findBenchmark('NOPE')).toBeUndefined();
  });
});

describe('parseBenchmarkPref', () => {
  it('reads the new shape', () => {
    expect(parseBenchmarkPref('{"symbol":"AGGH.MI","assetClass":"bond"}')).toEqual({ symbol: 'AGGH.MI', assetClass: 'bond' });
  });
  it('reads a legacy plain string as unknown class', () => {
    expect(parseBenchmarkPref('SWDA.MI')).toEqual({ symbol: 'SWDA.MI', assetClass: 'unknown' });
  });
  it('returns null for empty or malformed values', () => {
    expect(parseBenchmarkPref('')).toBeNull();
    expect(parseBenchmarkPref(null)).toBeNull();
    expect(parseBenchmarkPref('{"symbol":5}')).toBeNull();
    expect(parseBenchmarkPref('{"symbol":"X","assetClass":"weird"}')).toEqual({ symbol: 'X', assetClass: 'unknown' });
  });
});
