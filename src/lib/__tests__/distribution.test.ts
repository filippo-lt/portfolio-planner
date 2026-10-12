import { describe, expect, it } from 'vitest';
import { detectDistribution } from '../distribution';
import { simulate } from '../simulation';

const px = (rows: [string, number][]) => rows.map(([date, close]) => ({ date, close }));

describe('detectDistribution', () => {
  it('uses the curated list first', () => {
    expect(detectDistribution('IEGA.MI', 'whatever (Acc)')).toBe('dist');
    expect(detectDistribution('SWDA.MI', 'whatever')).toBe('acc');
  });
  it('reads name hints', () => {
    expect(detectDistribution('X', 'Foo UCITS ETF USD (Acc)', 'ETF')).toBe('acc');
    expect(detectDistribution('X', 'Foo UCITS ETF 1C', 'ETF')).toBe('acc');
    expect(detectDistribution('X', 'Foo Capitalizzazione', 'FUND')).toBe('acc');
    expect(detectDistribution('X', 'Foo UCITS ETF (Dist)', 'ETF')).toBe('dist');
    expect(detectDistribution('X', 'Foo Distributing', 'ETF')).toBe('dist');
    expect(detectDistribution('X', 'Foo 1D', 'ETF')).toBe('dist');
    expect(detectDistribution('X', 'Foo Distribuzione', 'FUND')).toBe('dist');
  });
  it('stays undefined when unclear, conflicting or a stock', () => {
    expect(detectDistribution('X', 'Foo UCITS ETF', 'ETF')).toBeUndefined();
    expect(detectDistribution('X', 'Foo Acc Dist', 'ETF')).toBeUndefined();
    expect(detectDistribution('AAPL', 'Apple Inc', 'STOCK')).toBeUndefined();
  });
});

describe('simulate distributing', () => {
  const adj = px([['2024-01-02', 100], ['2024-07-01', 104], ['2025-01-02', 108]]);
  const raw = px([['2024-01-02', 100], ['2024-07-01', 98], ['2025-01-02', 100]]);
  const dividends = [{ date: '2024-06-20', amount: 2 }, { date: '2024-01-02', amount: 50 }];

  it('adds cash received to the price change, not reinvested', () => {
    const r = simulate({ amount: 1000, prices: adj, rawPrices: raw, dividends })!;
    expect(r.distribution).toBe('dist');
    expect(r.grossValue).toBeCloseTo(1000); // 10 shares x 100
    expect(r.dividendsEur).toBeCloseTo(20); // start-date event excluded
    expect(r.netValue).toBeCloseTo(1020);
    expect(r.gainEur).toBeCloseTo(20);
  });
  it('applies entry fee to shares and exit fee to the position only', () => {
    const r = simulate({ amount: 1000, prices: adj, rawPrices: raw, dividends, entryFee: 0.1, exitFee: 0.1 })!;
    expect(r.grossValue).toBeCloseTo(900); // 9 shares
    expect(r.dividendsEur).toBeCloseTo(18);
    expect(r.exitFeeEur).toBeCloseTo(90);
    expect(r.netValue).toBeCloseTo(900 - 90 + 18);
  });
  it('keeps the adjusted path for acc or without data', () => {
    const r = simulate({ amount: 1000, prices: adj })!;
    expect(r.grossValue).toBeCloseTo(1080);
    expect(r.dividendsEur).toBeUndefined();
    expect(r.distribution).toBeUndefined();
    expect(simulate({ amount: 1000, prices: adj, rawPrices: raw })!.dividendsEur).toBeUndefined();
  });
  it('works on the last-12-months window', () => {
    const r = simulate({ amount: 1000, prices: adj, rawPrices: raw, dividends, from: '2024-07-01' })!;
    expect(r.grossValue).toBeCloseTo((1000 * 100) / 98);
    expect(r.dividendsEur).toBeCloseTo(0);
  });
});
