import { describe, expect, it } from 'vitest';
import { parseBenchmarkPrefs, parseProfile } from '../profileStore';

describe('parseBenchmarkPrefs', () => {
  it('reads the per-class shape', () => {
    expect(parseBenchmarkPrefs('{"equity":"VWCE.DE","bond":"AGGH.MI"}')).toEqual({
      equity: 'VWCE.DE',
      bond: 'AGGH.MI',
    });
  });
  it('reads the legacy {symbol, assetClass} shape into its class slot', () => {
    expect(parseBenchmarkPrefs('{"symbol":"AGGH.MI","assetClass":"bond"}')).toEqual({ bond: 'AGGH.MI' });
  });
  it('reads a legacy plain string as unknown class', () => {
    expect(parseBenchmarkPrefs('SWDA.MI')).toEqual({ unknown: 'SWDA.MI' });
  });
  it('returns empty for empty or malformed values and drops junk slots', () => {
    expect(parseBenchmarkPrefs('')).toEqual({});
    expect(parseBenchmarkPrefs(null)).toEqual({});
    expect(parseBenchmarkPrefs('{bad')).toEqual({});
    expect(parseBenchmarkPrefs('{"symbol":5}')).toEqual({});
    expect(parseBenchmarkPrefs('{"equity":5,"nope":"X","mixed":"V60A.DE"}')).toEqual({ mixed: 'V60A.DE' });
  });
});

describe('parseProfile tax country', () => {
  const base = {
    age: 40,
    horizonYears: 10,
    retirementAge: 67,
    netWorthEur: 50000,
    maxDrawdownPct: 20,
    knowledge: 'base',
  };
  it('loads an old profile saved without taxCountry', () => {
    const p = parseProfile(JSON.stringify({ v: 1, profile: base }));
    expect(p).not.toBeNull();
    expect(p?.taxCountry).toBeUndefined();
  });
  it('keeps a saved taxCountry', () => {
    expect(parseProfile(JSON.stringify({ v: 1, profile: { ...base, taxCountry: 'IT' } }))?.taxCountry).toBe('IT');
  });
  it('ignores an unrecognised country and keeps the rest of the profile', () => {
    const p = parseProfile(JSON.stringify({ v: 1, profile: { ...base, taxCountry: 'XX' } }));
    expect(p).not.toBeNull();
    expect(p?.taxCountry).toBeUndefined();
    expect(p?.age).toBe(base.age);
  });
});
