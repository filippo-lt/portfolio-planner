import type { AssetClass } from './data/types';

export interface Benchmark {
  symbol: string;
  isin: string;
  name: string;
  assetClass: AssetClass;
  /** Fraction (0.0019 = 0.19%) */
  ter: number;
  distribution: 'acc' | 'dist';
  replication: 'physical' | 'synthetic';
  currency: string;
  /** Government-bond share 0..1, bonds only; used later for the Italian tax estimate */
  govtShare?: number;
  /** Short Italian button label */
  label: string;
  /** Shown only on request (e.g. S&P 500 for equity funds) */
  optional?: boolean;
  /** Hand-made from issuer data; false until a person has checked it */
  reviewed: boolean;
}

type Seed = Omit<Benchmark, 'reviewed' | 'currency' | 'replication' | 'distribution'> &
  Partial<Pick<Benchmark, 'replication' | 'distribution'>>;

const seed = (b: Seed): Benchmark => ({
  replication: 'physical',
  distribution: 'acc',
  currency: 'EUR',
  reviewed: false,
  ...b,
});

export const BENCHMARKS: Benchmark[] = [
  seed({
    symbol: 'VWCE.DE',
    isin: 'IE00BK5BQT80',
    name: 'Vanguard FTSE All-World UCITS ETF (USD) Acc',
    assetClass: 'equity',
    ter: 0.0019,
    label: 'Azioni mondo',
  }),
  seed({
    symbol: 'SWDA.MI',
    isin: 'IE00B4L5Y983',
    name: 'iShares Core MSCI World UCITS ETF USD (Acc)',
    assetClass: 'equity',
    ter: 0.002,
    label: 'Azioni paesi sviluppati',
  }),
  seed({
    symbol: 'EIMI.MI',
    isin: 'IE00BKM4GZ66',
    name: 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)',
    assetClass: 'equity',
    ter: 0.0018,
    label: 'Azioni paesi emergenti',
  }),
  seed({
    symbol: 'SXR8.DE',
    isin: 'IE00B5BMR087',
    name: 'iShares Core S&P 500 UCITS ETF USD (Acc)',
    assetClass: 'equity',
    ter: 0.0007,
    label: 'Azioni USA (S&P 500)',
    optional: true,
  }),
  seed({
    symbol: 'SC0J.DE',
    isin: 'IE00B3YCGJ38',
    name: 'Invesco S&P 500 UCITS ETF Acc',
    assetClass: 'equity',
    ter: 0.0005,
    replication: 'synthetic',
    label: 'Azioni USA sintetico (S&P 500)',
    optional: true,
  }),

  seed({
    symbol: 'AGGH.MI',
    isin: 'IE00BDBRDM35',
    name: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc)',
    assetClass: 'bond',
    ter: 0.001,
    govtShare: 0.55,
    label: 'Obbligazioni globali',
  }),
  seed({
    symbol: 'XGLE.DE',
    isin: 'LU0290355717',
    name: 'Xtrackers II Eurozone Government Bond UCITS ETF 1C',
    assetClass: 'bond',
    ter: 0.0007,
    govtShare: 1,
    label: 'Titoli di Stato area euro',
  }),
  seed({
    symbol: 'IEGA.MI',
    isin: 'IE00B4WXJJ64',
    name: 'iShares Core € Govt Bond UCITS ETF (Dist)',
    assetClass: 'bond',
    ter: 0.0007,
    distribution: 'dist',
    govtShare: 1,
    label: 'Titoli di Stato area euro (dist.)',
  }),
  seed({
    symbol: 'IEAC.MI',
    isin: 'IE00B3F81R35',
    name: 'iShares Core € Corp Bond UCITS ETF (Dist)',
    assetClass: 'bond',
    ter: 0.002,
    distribution: 'dist',
    govtShare: 0,
    label: 'Obbligazioni societarie euro',
  }),
  seed({
    symbol: 'IBGS.MI',
    isin: 'IE00B14X4Q57',
    name: 'iShares € Govt Bond 1-3yr UCITS ETF (Dist)',
    assetClass: 'bond',
    ter: 0.0007,
    distribution: 'dist',
    govtShare: 1,
    label: 'Titoli di Stato euro 1-3 anni',
  }),

  seed({
    symbol: 'V60A.DE',
    isin: 'IE00BMVB5R75',
    name: 'Vanguard LifeStrategy 60% Equity UCITS ETF (Acc)',
    assetClass: 'mixed',
    ter: 0.0025,
    label: 'Bilanciato 60/40',
  }),
  seed({
    symbol: 'V40A.DE',
    isin: 'IE00BMVB5P51',
    name: 'Vanguard LifeStrategy 40% Equity UCITS ETF (Acc)',
    assetClass: 'mixed',
    ter: 0.0025,
    label: 'Bilanciato 40/60',
  }),
];

const DEFAULTS: Partial<Record<AssetClass, string>> = { equity: 'VWCE.DE', bond: 'AGGH.MI', mixed: 'V60A.DE' };

export const benchmarksFor = (cls: AssetClass): Benchmark[] => BENCHMARKS.filter((b) => b.assetClass === cls);

/** No default for other/unknown: the user has to choose. */
export const defaultBenchmarkFor = (cls: AssetClass | undefined): string | undefined => DEFAULTS[cls ?? 'unknown'];

export const findBenchmark = (symbol: string): Benchmark | undefined =>
  BENCHMARKS.find((b) => b.symbol.toUpperCase() === symbol.toUpperCase());
