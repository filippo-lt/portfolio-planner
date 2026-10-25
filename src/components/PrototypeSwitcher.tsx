// PROTOTYPE (throwaway): layer-1 variants for wayfinder ticket "What does layer 1 look like?"
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface SwitcherVariant {
  key: string;
  label: string;
}

/** Floating pill to cycle prototype variants through `?variant=`. Hidden in production. */
export function PrototypeSwitcher({ variants, current }: { variants: SwitcherVariant[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const idx = Math.max(0, variants.findIndex((v) => v.key === current));
  const hidden = process.env.NODE_ENV === 'production';

  useEffect(() => {
    if (hidden) return;
    const go = (delta: number) => {
      const next = variants[(idx + delta + variants.length) % variants.length];
      const sp = new URLSearchParams(params.toString());
      sp.set('variant', next.key);
      router.replace(`${pathname}?${sp.toString()}${window.location.hash}`, { scroll: false });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden, idx, variants, params, pathname, router]);

  if (hidden) return null;
  const step = (delta: number) => {
    const next = variants[(idx + delta + variants.length) % variants.length];
    const sp = new URLSearchParams(params.toString());
    sp.set('variant', next.key);
    router.replace(`${pathname}?${sp.toString()}${window.location.hash}`, { scroll: false });
  };
  const btn = 'flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white';
  return (
    <div role="group" aria-label="Variante del prototipo" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 ring-2 ring-amber-400 py-1.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/40">
      <button type="button" aria-label="Variante precedente" onClick={() => step(-1)} className={btn}>
        ←
      </button>
      <span aria-live="polite" className="min-w-0 max-w-[60vw] truncate px-2 text-center">
        {variants[idx].label}
      </span>
      <button type="button" aria-label="Variante successiva" onClick={() => step(1)} className={btn}>
        →
      </button>
    </div>
  );
}
