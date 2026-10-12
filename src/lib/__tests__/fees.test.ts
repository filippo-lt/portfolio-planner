import { describe, expect, it } from 'vitest';
import { effectiveFees, feeToInput, parseFeeInput, parseUserFees } from '../fees';
import { applyCostOverrides, COST_OVERRIDES } from '../data/costOverrides';
import type { InstrumentProfile } from '../data/types';

const base: InstrumentProfile = { symbol: 'XYZ', name: 'X', type: 'FUND', currency: 'EUR', exchange: 'MI' };

describe('effectiveFees', () => {
  it('uses user value only when data is missing', () => {
    const r = effectiveFees({ entryFee: { value: 0.01, source: 'kid' } }, { entry: 0.03, exit: 0.02 });
    expect(r.entry).toEqual({ value: 0.01, source: 'kid' });
    expect(r.exit).toEqual({ value: 0.02, source: 'user' });
  });
  it('leaves missing fees undefined and passes performance through', () => {
    expect(effectiveFees({})).toEqual({});
    expect(effectiveFees({ performanceFee: { value: 0.1, source: 'manual' } }).performance?.value).toBe(0.1);
  });
  it('ignores out-of-range user values', () => {
    expect(effectiveFees({}, { entry: 0.5 })).toEqual({});
  });
});

describe('parseFeeInput', () => {
  it('accepts Italian and dot decimals as fractions', () => {
    expect(parseFeeInput('1,5')).toEqual({ ok: true, value: 0.015 });
    expect(parseFeeInput('1.5')).toEqual({ ok: true, value: 0.015 });
    expect(parseFeeInput('0')).toEqual({ ok: true, value: 0 });
    expect(parseFeeInput('10')).toEqual({ ok: true, value: 0.1 });
  });
  it('empty clears; out of range or junk is rejected', () => {
    expect(parseFeeInput('  ')).toEqual({ ok: true, value: undefined });
    expect(parseFeeInput('10,1').ok).toBe(false);
    expect(parseFeeInput('-1').ok).toBe(false);
    expect(parseFeeInput('abc').ok).toBe(false);
  });
  it('formats back to Italian', () => {
    expect(feeToInput(0.015)).toBe('1,5');
    expect(feeToInput(undefined)).toBe('');
  });
});

describe('parseUserFees', () => {
  it('drops junk', () => {
    expect(parseUserFees({ entry: 0.01, exit: 'x' })).toEqual({ entry: 0.01 });
    expect(parseUserFees(null)).toEqual({});
  });
});

describe('applyCostOverrides', () => {
  it('gives curated ETFs 0 entry/exit from KID, by symbol or ISIN', () => {
    const bySym = applyCostOverrides({ ...base, symbol: 'vwce.de' });
    expect(bySym.entryFee).toEqual({ value: 0, source: 'manual' });
    const byIsin = applyCostOverrides({ ...base, isin: 'IE00B4L5Y983' });
    expect(byIsin.exitFee).toEqual({ value: 0, source: 'manual' });
  });
  it('leaves unknown funds alone and keeps existing fees', () => {
    expect(applyCostOverrides(base)).toBe(base);
    const p = applyCostOverrides({ ...base, symbol: 'VWCE.DE', entryFee: { value: 0.02, source: 'manual' } });
    expect(p.entryFee?.value).toBe(0.02);
  });
  it('marks every override unreviewed', () => {
    expect(COST_OVERRIDES.every((o) => o.reviewed === false)).toBe(true);
  });
});
