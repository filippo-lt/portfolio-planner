import { describe, expect, it } from 'vitest';
import { estimateItTax } from '../tax/it';
import { taxRulesFor } from '../tax';

const LOSS_NOTE = 'Per ETF e fondi i guadagni sono redditi di capitale: le perdite non possono compensarli.';

describe('estimateItTax', () => {
  it('taxes an equity ETF gain of 100 € at 26%', () => {
    const t = estimateItTax({ gain: 100, type: 'ETF', assetClass: 'equity' });
    expect(t.low).toBeCloseTo(26);
    expect(t.high).toBeCloseTo(26);
    expect(t.notes).toContain(LOSS_NOTE);
  });
  it('taxes a pure government bond gain at 12.5%', () => {
    const t = estimateItTax({ gain: 100, type: 'ETF', assetClass: 'bond', govtShare: 1 });
    expect(t.low).toBeCloseTo(12.5);
    expect(t.high).toBeCloseTo(12.5);
  });
  it('blends the rates by government share (55% -> 18.575%)', () => {
    const t = estimateItTax({ gain: 1000, type: 'ETF', assetClass: 'bond', govtShare: 0.55 });
    expect(t.low).toBeCloseTo(185.75);
    expect(t.high).toBeCloseTo(185.75);
  });
  it('gives a 12.5-26 € range when the share is unknown', () => {
    const t = estimateItTax({ gain: 100, type: 'FUND', assetClass: 'bond' });
    expect(t.low).toBeCloseTo(12.5);
    expect(t.high).toBeCloseTo(26);
  });
  it('gives a range for an unclassified product', () => {
    const t = estimateItTax({ gain: 100, type: 'FUND', assetClass: 'unknown' });
    expect([t.low, t.high]).toEqual([12.5, 26]);
  });
  it('charges nothing on a loss and keeps the no-offset note for ETF/FUND', () => {
    const t = estimateItTax({ gain: -50, type: 'FUND', assetClass: 'equity' });
    expect(t.low).toBe(0);
    expect(t.high).toBe(0);
    expect(t.notes).toContain(LOSS_NOTE);
  });
  it('stocks: 26% and no capital-income note', () => {
    const t = estimateItTax({ gain: 200, type: 'STOCK' });
    expect(t.high).toBeCloseTo(52);
    expect(t.notes).toEqual([]);
  });
  it('adds the distribution note for distributing products', () => {
    const t = estimateItTax({ gain: 100, type: 'ETF', assetClass: 'equity', distributing: true });
    expect(t.notes.some((n) => n.includes('cedole sono tassate quando incassate'))).toBe(true);
  });
});

describe('taxRulesFor', () => {
  it('has rules for Italy and none for OTHER', () => {
    expect(taxRulesFor('IT')).toBeDefined();
    expect(taxRulesFor('OTHER')).toBeUndefined();
    expect(taxRulesFor(undefined)).toBeUndefined();
  });
});
