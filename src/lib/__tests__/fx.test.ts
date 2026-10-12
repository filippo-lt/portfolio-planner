import { describe, expect, it } from 'vitest';
import { alignRates, fxSymbol, parseFxCost, rateOnOrBefore } from '../fx';

const px = (rows: [string, number][]) => rows.map(([date, close]) => ({ date, close }));

describe('fx', () => {
  it('builds the Yahoo symbol, pence as pounds, none for EUR', () => {
    expect(fxSymbol('USD')).toBe('EURUSD=X');
    expect(fxSymbol('GBp')).toBe('EURGBP=X');
    expect(fxSymbol('GBX')).toBe('EURGBP=X');
    expect(fxSymbol('EUR')).toBeUndefined();
    expect(fxSymbol(undefined)).toBeUndefined();
    expect(fxSymbol('x')).toBeUndefined();
  });
  it('uses the latest rate on or before the date within 7 days', () => {
    const r = px([
      ['2024-01-02', 1.1],
      ['2024-01-05', 1.2],
    ]);
    expect(rateOnOrBefore(r, '2024-01-05')?.close).toBe(1.2);
    expect(rateOnOrBefore(r, '2024-01-10')?.close).toBe(1.2);
    expect(rateOnOrBefore(r, '2024-01-13')).toBeUndefined();
    expect(rateOnOrBefore(r, '2024-01-01')).toBeUndefined();
  });
  it('aligns rates to dates, leaving out dates without a rate', () => {
    const r = px([
      ['2024-01-02', 1.1],
      ['2024-01-05', 1.2],
    ]);
    expect(alignRates(r, ['2023-12-01', '2024-01-03', '2024-01-06'])).toEqual([
      { date: '2024-01-03', close: 1.1, rateDate: '2024-01-02' },
      { date: '2024-01-06', close: 1.2, rateDate: '2024-01-05' },
    ]);
  });
  it('parses the cost percentage', () => {
    expect(parseFxCost('0,25')).toBeCloseTo(0.0025);
    expect(parseFxCost('0')).toBe(0);
    expect(parseFxCost('5')).toBeCloseTo(0.05);
    expect(parseFxCost('5,1')).toBeUndefined();
    expect(parseFxCost('-1')).toBeUndefined();
    expect(parseFxCost('abc')).toBeUndefined();
  });
});
