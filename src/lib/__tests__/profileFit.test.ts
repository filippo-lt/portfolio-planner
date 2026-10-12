import { describe, expect, it } from 'vitest';
import type { PricePoint } from '../data/types';
import { findBannedWords } from '../tone';
import { profileFit, type InvestorProfile } from '../profileFit';

const profile: InvestorProfile = {
  age: 35,
  horizonYears: 5,
  retirementAge: 67,
  netWorthEur: 50000,
  maxDrawdownPct: 20,
  knowledge: 'base',
};

describe('profileFit', () => {
  it('flags drawdown above tolerance', () => {
    const s = profileFit(profile, { maxDrawdown: -0.34, volatility: 0.18, currency: 'EUR' });
    const dd = s.find((x) => x.id === 'drawdown')!;
    expect(dd.status).toBe('oltre');
    expect(dd.text).toContain('(-34%)');
    expect(dd.text).toContain('(-20%)');
    expect(dd.text).toContain('14 punti');
  });
  it('uses it-IT decimals everywhere (no dot decimals)', () => {
    const s = profileFit({ ...profile, maxDrawdownPct: 12.5 }, { maxDrawdown: -0.3, volatility: 0.1234, currency: 'EUR' });
    const dd = s.find((x) => x.id === 'drawdown')!;
    expect(dd.text).toContain('(-12,5%)');
    expect(dd.text).toContain('17,5 punti');
    for (const st of s) expect(st.text).not.toMatch(/\d\.\d/);
  });
  it('flags drawdown within tolerance', () => {
    const dd = profileFit(profile, { maxDrawdown: -0.12, currency: 'EUR' }).find((x) => x.id === 'drawdown')!;
    expect(dd.status).toBe('entro');
    expect(dd.text).toContain('8 punti');
  });
  it('states volatility vs horizon', () => {
    const v = profileFit(profile, { volatility: 0.18, currency: 'EUR' }).find((x) => x.id === 'volatility')!;
    expect(v.status).toBe('info');
    expect(v.text).toContain('Volatilità annua 18%; orizzonte indicato 5 anni');
  });
  it('mentions currency exposure for non-EUR', () => {
    const c = profileFit(profile, { currency: 'USD' }).find((x) => x.id === 'currency')!;
    expect(c.text).toContain('quotato in USD');
    expect(c.text).toContain('EUR/USD');
  });
  it('handles missing data without inventing', () => {
    const s = profileFit(profile, { currency: 'EUR' });
    expect(s.find((x) => x.id === 'drawdown')!.text).toContain('Dato non disponibile');
    expect(s.find((x) => x.id === 'volatility')!.text).toContain('Dato non disponibile');
  });
  it('never uses judgmental words', () => {
    for (const m of [
      { maxDrawdown: -0.5, volatility: 0.4, currency: 'USD' },
      { maxDrawdown: -0.05, volatility: 0.05, currency: 'EUR' },
      { currency: '' },
    ]) {
      for (const st of profileFit(profile, m)) expect(findBannedWords(st.text)).toEqual([]);
    }
  });

  describe('rolling windows', () => {
    const monthly = (months: number, growth: number): PricePoint[] =>
      Array.from({ length: months + 1 }, (_, i) => {
        const d = new Date(Date.UTC(2015, i, 28));
        return { date: d.toISOString().slice(0, 10), close: 100 * Math.pow(1 + growth, i) };
      });

    it('states the range with numbers when history is long enough', () => {
      const r = profileFit(profile, { currency: 'EUR', monthly: monthly(96, 0.005) }).find((x) => x.id === 'rolling')!;
      expect(r.status).toBe('info');
      expect(r.text).toContain('finestre mobili di 5 anni');
      expect(r.text).toMatch(/da \d+,\d%\s+a \d+,\d%/);
    });
    it('says history is too short, with numbers', () => {
      const r = profileFit({ ...profile, horizonYears: 10 }, { currency: 'EUR', monthly: monthly(74, 0.005) }).find(
        (x) => x.id === 'rolling',
      )!;
      expect(r.text).toContain('Orizzonte indicato 10 anni; storico disponibile 6,2 anni');
    });
    it('passes the forbidden-word check', () => {
      for (const st of profileFit(profile, { currency: 'EUR', monthly: monthly(96, 0.005) })) {
        expect(findBannedWords(st.text)).toEqual([]);
      }
    });
  });
});
