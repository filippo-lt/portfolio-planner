import YahooFinance from 'yahoo-finance2';
import type { DataProvider } from './provider';
import type {
  Allocation,
  Fundamentals,
  Holding,
  InstrumentProfile,
  InstrumentType,
  PricePoint,
  SymbolCandidate,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const yf: any = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const TIMEOUT_MS = 9000;

function withTimeout(p: Promise<any>, ms = TIMEOUT_MS): Promise<any> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error('Timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}
const LOOSE = { validateResult: false };

export const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

const FIGI_EXCH_SUFFIX: Record<string, string> = {
  GY: '.DE',
  GR: '.DE',
  GF: '.F',
  IM: '.MI',
  NA: '.AS',
  FP: '.PA',
  LN: '.L',
  SW: '.SW',
  US: '',
  UN: '',
  UW: '',
  UQ: '',
  UP: '',
  UA: '',
};

const SECTOR_LABELS: Record<string, string> = {
  realestate: 'Immobiliare',
  consumer_cyclical: 'Beni di consumo ciclici',
  basic_materials: 'Materiali di base',
  consumer_defensive: 'Beni di consumo difensivi',
  technology: 'Tecnologia',
  communication_services: 'Servizi di comunicazione',
  financial_services: 'Servizi finanziari',
  utilities: 'Servizi di pubblica utilità',
  industrials: 'Industria',
  energy: 'Energia',
  healthcare: 'Sanità',
};

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

function mapType(quoteType: unknown): InstrumentType | undefined {
  if (quoteType === 'ETF') return 'ETF';
  if (quoteType === 'EQUITY') return 'STOCK';
  return undefined;
}

async function figiLookup(isin: string): Promise<{ symbol: string; name: string }[]> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.OPENFIGI_API_KEY) headers['X-OPENFIGI-APIKEY'] = process.env.OPENFIGI_API_KEY;
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers,
      body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as any[];
    const rows: any[] = json?.[0]?.data ?? [];
    const out: { symbol: string; name: string }[] = [];
    for (const r of rows) {
      const suffix = FIGI_EXCH_SUFFIX[r.exchCode as string];
      if (suffix === undefined || !r.ticker) continue;
      const ticker = String(r.ticker).replace(/\//g, '-');
      out.push({ symbol: `${ticker}${suffix}`, name: r.name ?? ticker });
    }
    return out;
  } catch {
    return [];
  }
}

async function enrich(c: SymbolCandidate): Promise<SymbolCandidate | undefined> {
  try {
    const q = await withTimeout(yf.quote(c.symbol, {}, LOOSE));
    const type = mapType(q?.quoteType);
    if (!type) return undefined;
    return {
      ...c,
      type,
      name: q.longName ?? q.shortName ?? c.name,
      exchange: q.fullExchangeName ?? q.exchange ?? c.exchange,
      currency: q.currency ?? c.currency,
    };
  } catch {
    return undefined;
  }
}

export class YahooProvider implements DataProvider {
  async resolve(query: string): Promise<SymbolCandidate[]> {
    const q = query.trim();
    if (!q) return [];
    const isin = ISIN_RE.test(q.toUpperCase()) ? q.toUpperCase() : undefined;
    const search = isin ?? q;

    const candidates = new Map<string, SymbolCandidate>();
    try {
      const res = await withTimeout(yf.search(search, { quotesCount: 12, newsCount: 0 }, LOOSE));
      for (const r of res?.quotes ?? []) {
        const type = mapType(r.quoteType);
        if (!type || !r.symbol) continue;
        candidates.set(r.symbol, {
          symbol: r.symbol,
          name: r.longname ?? r.shortname ?? r.symbol,
          type,
          exchange: r.exchDisp ?? r.exchange ?? '',
          isin,
        });
      }
    } catch {
      /* fall through to FIGI */
    }

    if (isin) {
      for (const f of await figiLookup(isin)) {
        if (!candidates.has(f.symbol)) {
          candidates.set(f.symbol, {
            symbol: f.symbol,
            name: f.name,
            type: 'ETF',
            exchange: '',
            isin,
          });
        }
      }
    }

    // Validate via quote (also gives currency); drops symbols Yahoo does not know.
    const enriched = (await Promise.all([...candidates.values()].slice(0, 12).map(enrich))).filter(
      (c): c is SymbolCandidate => !!c,
    );
    // EUR listings first, stable otherwise
    return enriched
      .map((c, i) => ({ c, i }))
      .sort((a, b) => Number(b.c.currency === 'EUR') - Number(a.c.currency === 'EUR') || a.i - b.i)
      .map((x) => x.c);
  }

  async getProfile(symbol: string): Promise<InstrumentProfile> {
    const modules = [
      'price',
      'summaryDetail',
      'summaryProfile',
      'assetProfile',
      'fundProfile',
      'topHoldings',
      'defaultKeyStatistics',
      'financialData',
    ];
    const s: any = await withTimeout(yf.quoteSummary(symbol, { modules }, LOOSE));
    const price = s?.price ?? {};
    const type = mapType(price.quoteType);
    if (!type) throw new Error(`Tipo di strumento non supportato per ${symbol}`);

    const profile: InstrumentProfile = {
      symbol: price.symbol ?? symbol,
      name: price.longName ?? price.shortName ?? symbol,
      type,
      currency: price.currency ?? s?.summaryDetail?.currency ?? '',
      exchange: price.exchangeName ?? price.exchange ?? '',
    };

    if (type === 'ETF') {
      const ter =
        num(s?.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio) ??
        num(s?.summaryDetail?.annualReportExpenseRatio) ??
        num(s?.defaultKeyStatistics?.annualReportExpenseRatio);
      if (ter !== undefined) profile.ter = ter;

      const holdings: Holding[] = (s?.topHoldings?.holdings ?? [])
        .map((h: any) => ({
          symbol: h.symbol ?? undefined,
          name: h.holdingName ?? h.symbol,
          weight: num(h.holdingPercent),
        }))
        .filter((h: any) => h.name && h.weight !== undefined);
      if (holdings.length) profile.holdings = holdings;

      const sectors: Allocation[] = [];
      for (const row of s?.topHoldings?.sectorWeightings ?? []) {
        for (const [k, v] of Object.entries(row)) {
          const w = num(v);
          if (w !== undefined) sectors.push({ name: SECTOR_LABELS[k] ?? k, weight: w });
        }
      }
      if (sectors.length) profile.sectors = sectors.sort((a, b) => b.weight - a.weight);
      // Yahoo does not expose country breakdown for ETFs: left undefined.
    } else {
      const f = await this.getFundamentals(symbol);
      if (f) {
        const cur = s?.financialData?.financialCurrency;
        if (typeof cur === 'string' && cur) f.currency = cur;
        profile.fundamentals = f;
      }
      const sector = s?.assetProfile?.sectorDisp ?? s?.assetProfile?.sector;
      if (sector) profile.sector = sector;
      const country = s?.assetProfile?.country;
      if (country) profile.country = country;
    }
    return profile;
  }

  private async getFundamentals(symbol: string): Promise<Fundamentals | undefined> {
    try {
      const period1 = new Date(Date.now() - 4 * 365 * 24 * 3600 * 1000);
      const rows: any[] = await withTimeout(
        yf.fundamentalsTimeSeries(symbol, { period1, type: 'annual', module: 'all' }, LOOSE),
      );
      const sorted = [...rows].sort((a, b) => +new Date(a.date) - +new Date(b.date));
      const last = [...sorted].reverse().find((r) => num(r.totalRevenue) !== undefined) ?? sorted.at(-1);
      if (!last) return undefined;
      const f: Fundamentals = {
        revenue: num(last.totalRevenue),
        netIncome: num(last.netIncome) ?? num(last.netIncomeCommonStockholders),
        totalDebt: num(last.totalDebt),
        freeCashFlow: num(last.freeCashFlow),
        fiscalYear: last.date ? new Date(last.date).getUTCFullYear() : undefined,
      };
      return Object.values(f).some((v) => v !== undefined) ? f : undefined;
    } catch {
      return undefined;
    }
  }

  async getHistory(symbol: string, years: number): Promise<PricePoint[]> {
    const period1 = new Date(Date.now() - years * 365.25 * 24 * 3600 * 1000);
    const res: any = await withTimeout(yf.chart(symbol, { period1, interval: '1d' }, LOOSE));
    // Express each timestamp in the exchange's local calendar day (gmtoffset is in seconds).
    const offsetMs = (num(res?.meta?.gmtoffset) ?? 0) * 1000;
    const out: PricePoint[] = [];
    for (const q of res?.quotes ?? []) {
      const close = num(q.adjclose) ?? num(q.close);
      if (close === undefined || close <= 0 || !q.date) continue;
      out.push({ date: new Date(new Date(q.date).getTime() + offsetMs).toISOString().slice(0, 10), close });
    }
    // de-duplicate same-day points keeping the last
    const byDate = new Map<string, PricePoint>();
    for (const p of out) byDate.set(p.date, p);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const yahooProvider = new YahooProvider();
