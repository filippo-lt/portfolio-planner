import { describe, expect, it } from 'vitest';
import { taxRulesFor } from '../tax';

const est = (
  c: 'ES' | 'DE' | 'FR' | 'UK',
  input: Parameters<NonNullable<ReturnType<typeof taxRulesFor>>['estimate']>[0],
) => taxRulesFor(c)!.estimate(input);

describe('Spain', () => {
  it('taxes 5.000 € at 19%', () => expect(est('ES', { gain: 5000, type: 'ETF' }).high).toBeCloseTo(950));
  it('applies brackets progressively: 10.000 € = 6.000*19% + 4.000*21%', () => {
    const t = est('ES', { gain: 10000, type: 'ETF' });
    expect(t.low).toBeCloseTo(1980);
    expect(t.high).toBeCloseTo(1980);
  });
  it('250.000 € = 1.140 + 9.240 + 34.500 + 13.500', () =>
    expect(est('ES', { gain: 250000, type: 'ETF' }).high).toBeCloseTo(1140 + 9240 + 34500 + 13500));
  it('350.000 € adds 30% above 300.000 €', () =>
    expect(est('ES', { gain: 350000, type: 'ETF' }).high).toBeCloseTo(1140 + 9240 + 34500 + 27000 + 15000));
  it('is 0 on a loss and states the single-income assumption', () => {
    const t = est('ES', { gain: -500, type: 'ETF' });
    expect(t.high).toBe(0);
    expect(t.notes).toContain("Calcolato come se fosse l'unico reddito da risparmio dell'anno.");
  });
});

describe('Germany', () => {
  it('equity fund: 1.000 € * 26,375% * 0,7', () => {
    const t = est('DE', { gain: 1000, type: 'ETF', assetClass: 'equity' });
    expect(t.low).toBeCloseTo(184.625);
    expect(t.high).toBeCloseTo(184.625);
  });
  it('mixed fund: 15% exempt', () =>
    expect(est('DE', { gain: 1000, type: 'ETF', assetClass: 'mixed' }).high).toBeCloseTo(224.1875));
  it('bond and other: no exemption', () => {
    expect(est('DE', { gain: 1000, type: 'ETF', assetClass: 'bond' }).high).toBeCloseTo(263.75);
    expect(est('DE', { gain: 1000, type: 'ETF', assetClass: 'other' }).high).toBeCloseTo(263.75);
  });
  it('single stock: no exemption', () =>
    expect(est('DE', { gain: 1000, type: 'STOCK', assetClass: 'equity' }).high).toBeCloseTo(263.75));
  it('unknown class: range 0-30% exempt', () => {
    const t = est('DE', { gain: 1000, type: 'FUND' });
    expect(t.low).toBeCloseTo(184.625);
    expect(t.high).toBeCloseTo(263.75);
  });
  it('is 0 on a loss; notes mention Sparer-Pauschbetrag and church tax', () => {
    const t = est('DE', { gain: -10, type: 'ETF', assetClass: 'equity' });
    expect(t.high).toBe(0);
    expect(t.notes.join(' ')).toContain('Sparer-Pauschbetrag');
    expect(t.notes.join(' ')).toContain('Kirchensteuer');
  });
});

describe('France', () => {
  it('flat 31,4%', () => expect(est('FR', { gain: 1000, type: 'ETF', assetClass: 'equity' }).high).toBeCloseTo(314));
  it('label says dal 2026; 0 on a loss', () => {
    const t = est('FR', { gain: -1, type: 'ETF' });
    expect(t.rateLabel).toContain('dal 2026');
    expect(t.high).toBe(0);
    expect(t.notes).toContain('PEA e assurance-vie non considerati.');
  });
});

describe('United Kingdom', () => {
  it('18%-24% range on the EUR gain', () => {
    const t = est('UK', { gain: 1000, type: 'ETF' });
    expect(t.low).toBeCloseTo(180);
    expect(t.high).toBeCloseTo(240);
  });
  it('is 0 on a loss', () => expect(est('UK', { gain: -1000, type: 'ETF' }).high).toBe(0));
});

describe('taxRulesFor', () => {
  it('has rules for every supported country and none for OTHER', () => {
    for (const c of ['IT', 'ES', 'DE', 'FR', 'UK'] as const) expect(taxRulesFor(c)).toBeDefined();
    expect(taxRulesFor('OTHER')).toBeUndefined();
    expect(taxRulesFor(undefined)).toBeUndefined();
  });
});
