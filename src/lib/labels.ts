import type { InstrumentType } from './data/types';

const TYPES: Record<InstrumentType, string> = { ETF: 'ETF', FUND: 'Fondo', STOCK: 'Azione' };

export function typeLabel(t: InstrumentType): string {
  return TYPES[t];
}

/** Human labels for Yahoo exchange codes (fallback: the raw code). */
const EXCHANGES: Record<string, string> = {
  Milan: 'Borsa Italiana',
  XETRA: 'Xetra (Germania)',
  Frankfurt: 'Francoforte',
  Stuttgart: 'Stoccarda',
  Munich: 'Monaco',
  Berlin: 'Berlino',
  Dusseldorf: 'Düsseldorf',
  Hamburg: 'Amburgo',
  LSE: 'Londra',
  Amsterdam: 'Amsterdam',
  Paris: 'Parigi',
  Swiss: 'Svizzera',
  NasdaqGS: 'Nasdaq',
  NasdaqGM: 'Nasdaq',
  NasdaqCM: 'Nasdaq',
  NYSE: 'NYSE',
  NYSEArca: 'NYSE Arca',
  'Cboe US': 'Cboe (USA)',
  Toronto: 'Toronto',
  Mexico: 'Messico',
  'São Paulo': 'San Paolo',
};

export function exchangeLabel(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return EXCHANGES[code] ?? code;
}

/** Neutral structural tags read from the product name only. */
export function nameTags(name: string): string[] {
  const out: string[] = [];
  if (/\b(short|inverse|bear)\b/i.test(name)) out.push('Inverso');
  if (/\b(\d(\.\d)?x|leveraged|ultra(pro)?|bull)\b/i.test(name)) out.push('Con leva');
  if (/(option income|covered call|yieldmax|weeklypay|premium income)/i.test(name)) out.push('Strategia con opzioni');
  return out;
}

const SECTORS: Record<string, string> = {
  Technology: 'Tecnologia',
  'Financial Services': 'Servizi finanziari',
  Healthcare: 'Sanità',
  'Consumer Cyclical': 'Beni di consumo ciclici',
  'Consumer Defensive': 'Beni di consumo difensivi',
  'Communication Services': 'Servizi di comunicazione',
  Industrials: 'Industria',
  Energy: 'Energia',
  Utilities: 'Servizi di pubblica utilità',
  'Real Estate': 'Immobiliare',
  'Basic Materials': 'Materiali di base',
};

export function sectorLabel(s: string): string {
  return SECTORS[s] ?? s;
}

const COUNTRIES: Record<string, string> = {
  'United States': 'Stati Uniti',
  'United Kingdom': 'Regno Unito',
  Germany: 'Germania',
  France: 'Francia',
  Italy: 'Italia',
  Netherlands: 'Paesi Bassi',
  Switzerland: 'Svizzera',
  Japan: 'Giappone',
  China: 'Cina',
  Canada: 'Canada',
  Ireland: 'Irlanda',
  Spain: 'Spagna',
  Taiwan: 'Taiwan',
  'South Korea': 'Corea del Sud',
};

export function countryLabel(s: string): string {
  return COUNTRIES[s] ?? s;
}
