import { describe, expect, it } from 'vitest';
import { chartGap, annualizedReturn, annualizedVolatility, maxDrawdown, monthlyCloses, rebase, rollingReturnRange } from '../metrics';
import type { PricePoint } from '../data/types';

function series(n: number, f: (i: number) => number, end = '2025-01-01'): PricePoint[] {
  const endMs = Date.parse(end + 'T00:00:00Z');
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(endMs - (n - 1 - i) * 86400000).toISOString().slice(0, 10),
    close: f(i),
  }));
}

describe('annualizedReturn', () => {
  it('computes CAGR', () => {
    // 1 year back (366 points daily), price doubles
    const p = series(367, (i) => (i === 366 ? 200 : 100));
    const r = annualizedReturn(p, 1)!;
    expect(r).toBeGreaterThan(0.99);
    expect(r).toBeLessThan(1.01);
  });
  it('is undefined if history too short', () => {
    expect(annualizedReturn(series(100, () => 100), 1)).toBeUndefined();
    expect(annualizedReturn([], 1)).toBeUndefined();
  });
});

describe('annualizedVolatility', () => {
  it('is 0 for constant prices', () => {
    expect(annualizedVolatility(series(100, () => 50))).toBe(0);
  });
  it('matches std * sqrt(252)', () => {
    // alternating +1% / -1% returns
    let price = 100;
    const p = series(101, (i) => (i === 0 ? price : (price *= i % 2 ? 1.01 : 0.99)));
    const v = annualizedVolatility(p)!;
    expect(v).toBeGreaterThan(0.15);
    expect(v).toBeLessThan(0.17);
  });
  it('is undefined with too few points', () => {
    expect(annualizedVolatility(series(5, (i) => 100 + i))).toBeUndefined();
  });
});

describe('maxDrawdown', () => {
  it('finds peak, trough and negative value', () => {
    const closes = [100, 120, 90, 110, 60, 130];
    const p = series(6, (i) => closes[i]);
    const dd = maxDrawdown(p)!;
    expect(dd.value).toBeCloseTo(-0.5);
    expect(dd.peakDate).toBe(p[1].date);
    expect(dd.troughDate).toBe(p[4].date);
  });
  it('is 0 for monotonic growth', () => {
    expect(maxDrawdown(series(10, (i) => 100 + i))!.value).toBe(0);
  });
});

describe('rebase', () => {
  it('aligns common dates and starts at 100', () => {
    const a: PricePoint[] = [
      { date: '2024-01-01', close: 10 },
      { date: '2024-01-02', close: 11 },
      { date: '2024-01-03', close: 12 },
    ];
    const b: PricePoint[] = [
      { date: '2024-01-02', close: 50 },
      { date: '2024-01-03', close: 55 },
      { date: '2024-01-04', close: 60 },
    ];
    const r = rebase(a, b);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ date: '2024-01-02', a: 100, b: 100 });
    expect(r[1].a).toBeCloseTo((12 / 11) * 100);
    expect(r[1].b).toBeCloseTo(110);
  });
  it('returns empty when no overlap', () => {
    expect(rebase([{ date: '2024-01-01', close: 1 }], [{ date: '2024-01-02', close: 1 }])).toEqual([]);
  });
});

describe('monthlyCloses / rollingReturnRange', () => {
  it('keeps first point and month-end closes', () => {
    const p = series(90, (i) => 100 + i, '2024-03-31');
    const m = monthlyCloses(p);
    expect(m[0]).toEqual(p[0]);
    expect(m.at(-1)).toEqual(p.at(-1));
    expect(m.length).toBeLessThan(6);
  });
  it('finds worst and best rolling returns', () => {
    const p: PricePoint[] = Array.from({ length: 49 }, (_, i) => ({
      date: new Date(Date.UTC(2020, i, 28)).toISOString().slice(0, 10),
      close: 100 * Math.pow(1.01, i),
    }));
    const r = rollingReturnRange(p, 2)!;
    expect(r.worst).toBeCloseTo(r.best, 2);
    expect(r.worst).toBeGreaterThan(0.12);
    expect(r.worst).toBeLessThan(0.13);
  });
  it('is undefined if history shorter than horizon', () => {
    const p = series(100, () => 100);
    expect(rollingReturnRange(p, 5)).toBeUndefined();
  });
});

describe('chartGap', () => {
  const pt = (date: string, a: number, b: number) => ({ date, a, b });
  it('is null for an empty chart', () => {
    expect(chartGap([], 'A', 'B')).toBeNull();
  });
  it('uses years and signed Italian percentages', () => {
    expect(chartGap([pt('2020-01-01', 100, 100), pt('2025-01-01', 150.5, 80)], 'AAA', 'BBB')).toBe(
      'In 5 anni AAA è +50,5% e BBB è -20,0%.',
    );
  });
  it('uses months under one year', () => {
    expect(chartGap([pt('2024-01-01', 100, 100), pt('2024-07-01', 110, 105)], 'A', 'B')).toBe(
      'In 6 mesi A è +10,0% e B è +5,0%.',
    );
  });
  it('uses singular for one year', () => {
    expect(chartGap([pt('2024-01-01', 100, 100), pt('2025-01-01', 101, 99)], 'A', 'B')).toContain('In 1 anno');
  });
});
