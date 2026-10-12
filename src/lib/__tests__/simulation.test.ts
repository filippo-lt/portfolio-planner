import { describe, expect, it } from 'vitest';
import { lastYearStart, parseSimAmount, simulate, terCostEstimate } from '../simulation';

const px = (rows: [string, number][]) => rows.map(([date, close]) => ({ date, close }));
const series = px([
  ['2023-01-02', 100],
  ['2024-01-02', 110],
  ['2025-01-02', 121],
]);

describe('simulate', () => {
  it('grows the amount with the price', () => {
    const r = simulate({ amount: 1000, prices: series })!;
    expect(r.grossValue).toBeCloseTo(1210);
    expect(r.netValue).toBeCloseTo(1210);
    expect(r.gainEur).toBeCloseTo(210);
    expect(r.startDate).toBe('2023-01-02');
    expect(r.endDate).toBe('2025-01-02');
    expect(r.years).toBeCloseTo(2, 1);
    expect(r.feesIncluded).toEqual({ entry: false, exit: false });
  });

  it('applies entry fee to the invested amount and exit fee to the final value', () => {
    const r = simulate({ amount: 1000, prices: series, entryFee: 0.02, exitFee: 0.01 })!;
    expect(r.entryFeeEur).toBeCloseTo(20);
    expect(r.grossValue).toBeCloseTo(980 * 1.21);
    expect(r.exitFeeEur).toBeCloseTo(980 * 1.21 * 0.01);
    expect(r.netValue).toBeCloseTo(980 * 1.21 * 0.99);
    expect(r.gainEur).toBeCloseTo(r.netValue - 1000);
    expect(r.feesIncluded).toEqual({ entry: true, exit: true });
  });

  it('treats a zero fee as included and a missing fee as not included', () => {
    const r = simulate({ amount: 1000, prices: series, entryFee: 0 })!;
    expect(r.feesIncluded).toEqual({ entry: true, exit: false });
  });

  it('does not subtract the TER again (prices are already net of it)', () => {
    const withTer = simulate({ amount: 1000, prices: series })!;
    expect(withTer.netValue).toBeCloseTo(1000 * (121 / 100));
    expect(terCostEstimate(1000, 0.002, 2)).toBeCloseTo(4);
    // the estimate is informational: it never changes the result
    expect(simulate({ amount: 1000, prices: series })!.netValue).toBe(withTer.netValue);
  });

  it('can lose money', () => {
    const r = simulate({ amount: 1000, prices: px([['2024-01-02', 100], ['2025-01-02', 90]]) })!;
    expect(r.gainEur).toBeCloseTo(-100);
  });

  it('uses the nearest available points for from/to', () => {
    const r = simulate({ amount: 1000, prices: series, from: '2023-12-20', to: '2025-03-01' })!;
    expect(r.startDate).toBe('2024-01-02');
    expect(r.endDate).toBe('2025-01-02');
    expect(r.netValue).toBeCloseTo(1100);
  });

  it('is undefined when the period is too short or history does not reach back', () => {
    expect(simulate({ amount: 1000, prices: px([['2025-01-02', 100]]) })).toBeUndefined();
    expect(simulate({ amount: 1000, prices: [] })).toBeUndefined();
    expect(simulate({ amount: 1000, prices: series, from: '2020-01-01' })).toBeUndefined();
    expect(simulate({ amount: 1000, prices: series, from: '2025-01-01' })).toBeUndefined();
  });

  it('is undefined for a bad amount or price', () => {
    expect(simulate({ amount: 0, prices: series })).toBeUndefined();
    expect(simulate({ amount: 1000, prices: px([['2024-01-02', 0], ['2025-01-02', 90]]) })).toBeUndefined();
  });
});

describe('lastYearStart', () => {
  it('is 365 days before the last date', () => {
    expect(lastYearStart(series)).toBe('2024-01-03');
    expect(lastYearStart([])).toBeUndefined();
  });
});

describe('parseSimAmount', () => {
  it('reads Italian numbers', () => {
    expect(parseSimAmount('1.000')).toBe(1000);
    expect(parseSimAmount('1000')).toBe(1000);
    expect(parseSimAmount('2.500,50')).toBe(2500.5);
  });
  it('rejects empty, zero, negative, junk and too large', () => {
    for (const s of ['', '0', '-5', 'abc', '10.000.001']) expect(parseSimAmount(s)).toBeUndefined();
    expect(parseSimAmount('10.000.000')).toBe(10_000_000);
  });
});
