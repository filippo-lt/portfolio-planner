'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { AssetClass, InstrumentType } from './data/types';
import type { InvestorProfile } from './profileFit';
import { validateProfile } from './profileValidation';
import { THEME_KEY, type ThemePref } from './theme';

const PROFILE_KEY = 'investorProfile';
const BENCH_KEY = 'benchmarkSymbol';
const VERSION = 1;
const LOADING = '__loading__';

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}
const emit = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
  emit();
}

export { validateProfile, profileWarnings } from './profileValidation';
export type { ProfileErrors, ProfileForm } from './profileValidation';

function parseProfile(raw: string | null): InvestorProfile | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o?.v !== VERSION || !o.profile) return null;
    const { errors, profile } = validateProfile({
      age: String(o.profile.age),
      horizonYears: String(o.profile.horizonYears),
      retirementAge: String(o.profile.retirementAge),
      netWorthEur: String(o.profile.netWorthEur),
      maxDrawdownPct: String(o.profile.maxDrawdownPct),
      knowledge: o.profile.knowledge,
    });
    return Object.keys(errors).length ? null : (profile ?? null);
  } catch {
    return null;
  }
}

/** undefined while loading (first client render), null if none saved. */
export function useInvestorProfile(): InvestorProfile | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(PROFILE_KEY) ?? '',
    () => LOADING,
  );
  return useMemo(() => (raw === LOADING ? undefined : parseProfile(raw || null)), [raw]);
}

export function saveInvestorProfile(p: InvestorProfile) {
  write(PROFILE_KEY, JSON.stringify({ v: VERSION, profile: p }));
}

export interface BenchmarkPref {
  symbol: string;
  /** Class of the instrument the benchmark was chosen for */
  assetClass: AssetClass;
}

const ASSET_CLASSES: AssetClass[] = ['equity', 'bond', 'mixed', 'other', 'unknown'];

/** Reads the stored value; an old plain-string value is kept as a legacy pref with unknown class. */
export function parseBenchmarkPref(raw: string | null): BenchmarkPref | null {
  if (!raw) return null;
  if (!raw.startsWith('{')) return { symbol: raw, assetClass: 'unknown' };
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o.symbol !== 'string' || !o.symbol) return null;
    return { symbol: o.symbol, assetClass: ASSET_CLASSES.includes(o.assetClass) ? o.assetClass : 'unknown' };
  } catch {
    return null;
  }
}

export function useBenchmarkPref(): [BenchmarkPref | null, (symbol: string, assetClass: AssetClass) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(BENCH_KEY) ?? '',
    () => '',
  );
  const pref = useMemo(() => parseBenchmarkPref(raw), [raw]);
  const set = useCallback(
    (symbol: string, assetClass: AssetClass) => write(BENCH_KEY, JSON.stringify({ symbol, assetClass })),
    [],
  );
  return [pref, set];
}

export function clearBenchmarkPref() {
  try {
    localStorage.removeItem(BENCH_KEY);
  } catch {
    /* storage unavailable */
  }
  emit();
}

/* Recently opened reports, newest first. */
const RECENT_KEY = 'recentReports';
const RECENT_MAX = 6;
export interface RecentItem {
  symbol: string;
  name: string;
  type: InstrumentType;
}

function parseRecent(raw: string): RecentItem[] {
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a)
      ? a.filter((x) => x && typeof x.symbol === 'string' && typeof x.name === 'string' && (x.type === 'ETF' || x.type === 'FUND' || x.type === 'STOCK')).slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

export function useRecentReports(): RecentItem[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(RECENT_KEY) ?? '[]',
    () => '[]',
  );
  return useMemo(() => parseRecent(raw), [raw]);
}

export function pushRecentReport(item: RecentItem) {
  const list = parseRecent(read(RECENT_KEY) ?? '[]').filter((x) => x.symbol !== item.symbol);
  const next = JSON.stringify([item, ...list].slice(0, RECENT_MAX));
  if (next !== read(RECENT_KEY)) write(RECENT_KEY, next);
}

export function clearRecentReports() {
  write(RECENT_KEY, '[]');
}

/* Appearance: absent key means "follow the OS". */
export function useThemePref(): ThemePref {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(THEME_KEY) ?? '',
    () => '',
  );
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function setThemePref(p: ThemePref) {
  try {
    if (p === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, p);
  } catch {
    /* storage unavailable */
  }
  (window as { __applyTheme?: () => void }).__applyTheme?.();
  emit();
}

/** Wipes everything the app saved on this device except the appearance choice. */
export function clearAllUserData() {
  for (const key of [PROFILE_KEY, BENCH_KEY, RECENT_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
  emit();
}

/** One-shot, in-memory UI messages passed across client navigations. */
export const flash = { welcome: false, profileSaved: false };
