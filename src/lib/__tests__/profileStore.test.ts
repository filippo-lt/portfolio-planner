import { describe, expect, it } from 'vitest';
import { parseBenchmarkPrefs } from '../profileStore';

describe('parseBenchmarkPrefs', () => {
  it('reads the per-class shape', () => {
    expect(parseBenchmarkPrefs('{"equity":"VWCE.DE","bond":"AGGH.MI"}')).toEqual({ equity: 'VWCE.DE', bond: 'AGGH.MI' });
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
