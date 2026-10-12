'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { InvestorProfile } from './profileFit';
import { validateProfile } from './profileValidation';

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

export function useBenchmarkPref(defaultValue: string): [string, (s: string) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(BENCH_KEY) ?? '',
    () => '',
  );
  const set = useCallback((s: string) => write(BENCH_KEY, s), []);
  return [raw || defaultValue, set];
}
