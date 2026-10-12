import { describe, expect, it } from 'vitest';
import { classifyAssetClass } from '../assetClass';

describe('classifyAssetClass', () => {
  it('treats a single stock as equity', () => {
    expect(classifyAssetClass({ type: 'STOCK', name: 'Some Corp Bond Holdings' }).assetClass).toBe('equity');
  });

  it('classifies the test fund 0P00009U6I.F as bond (live Yahoo inputs: no category, 98.7% bonds)', () => {
    const r = classifyAssetClass({
      type: 'FUND',
      name: 'BGF Global Corporate Bond E2 EUR Hedged',
      category: undefined,
      stockPosition: 0,
      bondPosition: 0.98730004,
      cashPosition: 0.082200006,
    });
    expect(r.assetClass).toBe('bond');
    expect(r.reason).toContain('99%');
  });

  it('classifies a world equity ETF from positions', () => {
    const r = classifyAssetClass({
      type: 'ETF',
      name: 'Vanguard FTSE All-World UCITS ETF USD Accumulation',
      stockPosition: 0.9993,
      bondPosition: 0,
    });
    expect(r.assetClass).toBe('equity');
  });

  it('classifies a 60/40 split as mixed', () => {
    expect(classifyAssetClass({ type: 'FUND', name: 'X', stockPosition: 0.6, bondPosition: 0.35 }).assetClass).toBe(
      'mixed',
    );
  });

  it('does not call mixed when one side is under 15%', () => {
    const r = classifyAssetClass({ type: 'FUND', name: 'X', stockPosition: 0.6, bondPosition: 0.1 });
    expect(r.assetClass).toBe('unknown');
  });

  it('positions win over name keywords', () => {
    const r = classifyAssetClass({ type: 'FUND', name: 'Global Equity Fund', stockPosition: 0.05, bondPosition: 0.9 });
    expect(r.assetClass).toBe('bond');
  });

  it('uses the category when positions are missing', () => {
    const r = classifyAssetClass({ type: 'FUND', name: 'Fondo X', category: 'EUR Diversified Bond' });
    expect(r).toEqual({ assetClass: 'bond', reason: 'Categoria Yahoo: EUR Diversified Bond' });
  });

  it('matches Italian and English keywords case-insensitively', () => {
    expect(classifyAssetClass({ type: 'FUND', name: 'FONDO OBBLIGAZIONARIO EURO' }).assetClass).toBe('bond');
    expect(classifyAssetClass({ type: 'FUND', name: 'Fondo Monetario' }).assetClass).toBe('bond');
    expect(classifyAssetClass({ type: 'FUND', name: 'Vanguard LifeStrategy 60% Equity' }).assetClass).toBe('mixed');
    expect(classifyAssetClass({ type: 'FUND', name: 'Fondo Bilanciato' }).assetClass).toBe('mixed');
    expect(classifyAssetClass({ type: 'ETF', name: 'iShares Core MSCI World' }).assetClass).toBe('equity');
    expect(classifyAssetClass({ type: 'ETF', name: 'Azionario Europa' }).assetClass).toBe('equity');
  });

  it('classifies commodity and gold products as other', () => {
    expect(classifyAssetClass({ type: 'ETF', name: 'Invesco Physical Gold' }).assetClass).toBe('other');
    expect(classifyAssetClass({ type: 'ETF', name: 'Broad Commodity UCITS' }).assetClass).toBe('other');
  });

  it('does not read gold or oro inside other words', () => {
    expect(classifyAssetClass({ type: 'FUND', name: 'Goldman Sachs Alpha' }).assetClass).toBe('unknown');
    expect(classifyAssetClass({ type: 'FUND', name: 'Euro Alpha' }).assetClass).toBe('unknown');
  });

  it('never defaults to equity: no data stays unknown', () => {
    const r = classifyAssetClass({ type: 'FUND', name: 'Alpha Strategy 3' });
    expect(r).toEqual({ assetClass: 'unknown', reason: 'Dati insufficienti per stabilire il tipo' });
  });
});
