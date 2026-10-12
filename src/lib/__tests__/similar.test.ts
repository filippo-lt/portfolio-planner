import { describe, expect, it } from 'vitest';
import { BENCHMARKS, benchmarksFor } from '../benchmarks';
import { applyGrowth, simulate } from '../simulation';
import { fundPeriods, growthRatio, similarProducts } from '../similar';

const eq = benchmarksFor('equity');
const cand = (symbol: string, vol: number | undefined) => ({ benchmark: eq.find((b) => b.symbol === symbol)!, vol });
const px = (rows: [string, number][]) => rows.map(([date, close]) => ({ date, close }));

describe('similarProducts', () => {
  const cands = [cand('VWCE.DE', 0.15), cand('SWDA.MI', 0.14), cand('EIMI.MI', 0.18), cand('SXR8.DE', 0.2)];

  it('sorts by closest volatility and keeps three', () => {
    const r = similarProducts('equity', 0.15, cands);
    expect(r.map((c) => c.benchmark.symbol)).toEqual(['VWCE.DE', 'SWDA.MI', 'EIMI.MI']);
  });

  it('breaks ties by symbol', () => {
    const r = similarProducts('equity', 0.16, [cand('VWCE.DE', 0.15), cand('SWDA.MI', 0.17)]);
    expect(r.map((c) => c.benchmark.symbol)).toEqual(['SWDA.MI', 'VWCE.DE']);
  });

  it('is deterministic whatever the input order', () => {
    expect(similarProducts('equity', 0.15, [...cands].reverse())).toEqual(similarProducts('equity', 0.15, cands));
  });

  it('excludes the instrument by symbol or ISIN', () => {
    expect(similarProducts('equity', 0.15, cands, 3, { symbol: 'vwce.de' }).map((c) => c.benchmark.symbol)).not.toContain('VWCE.DE');
    const isin = eq.find((b) => b.symbol === 'SWDA.MI')!.isin;
    expect(similarProducts('equity', 0.15, cands, 3, { symbol: 'X', isin }).map((c) => c.benchmark.symbol)).not.toContain('SWDA.MI');
  });

  it('keeps only the same class', () => {
    const bond = BENCHMARKS.find((b) => b.assetClass === 'bond')!;
    expect(similarProducts('equity', 0.15, [{ benchmark: bond, vol: 0.15 }])).toEqual([]);
  });

  it('skips candidates without volatility', () => {
    expect(similarProducts('equity', 0.15, [cand('VWCE.DE', undefined)])).toEqual([]);
  });

  it('is empty for unknown/other class, missing vol or no candidates', () => {
    expect(similarProducts('unknown', 0.15, cands)).toEqual([]);
    expect(similarProducts('other', 0.15, cands)).toEqual([]);
    expect(similarProducts(undefined, 0.15, cands)).toEqual([]);
    expect(similarProducts('equity', undefined, cands)).toEqual([]);
    expect(similarProducts('equity', 0.15, [])).toEqual([]);
  });
});

describe('growthRatio', () => {
  const prices = px([
    ['2023-01-02', 100],
    ['2024-01-02', 110],
    ['2025-01-02', 121],
  ]);

  it('uses the nearest points to the fund dates', () => {
    expect(growthRatio(prices, { from: '2023-01-04', to: '2025-01-01' })).toBeCloseTo(1.21);
  });

  it('omits the period when the history starts after it', () => {
    expect(growthRatio(prices, { from: '2022-01-03', to: '2025-01-02' })).toBeUndefined();
  });

  it('omits the period when the history ends well before it', () => {
    expect(growthRatio(prices, { from: '2023-01-02', to: '2025-06-01' })).toBeUndefined();
  });

  it('is undefined without a period', () => {
    expect(growthRatio(prices, undefined)).toBeUndefined();
  });

  it('gives the same euro result as simulate on the same prices', () => {
    const r = growthRatio(prices, { from: '2023-01-02', to: '2025-01-02' })!;
    const a = applyGrowth(1000, r, 0.02, 0.01);
    const s = simulate({ amount: 1000, prices, entryFee: 0.02, exitFee: 0.01 })!;
    expect(a.netValue).toBeCloseTo(s.netValue);
    expect(a.entryFeeEur).toBeCloseTo(s.entryFeeEur);
    expect(a.exitFeeEur).toBeCloseTo(s.exitFeeEur);
  });
});

describe('fundPeriods', () => {
  it('returns the simulated dates; no year period when history is too short', () => {
    const p = px([
      ['2024-06-03', 100],
      ['2025-01-02', 110],
    ]);
    expect(fundPeriods(p)).toEqual({ full: { from: '2024-06-03', to: '2025-01-02' }, year: undefined });
  });
});
