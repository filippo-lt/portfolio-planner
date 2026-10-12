/** Brand constants and marks shared by the generated icons and share images (next/og). */

export const SITE_NAME = 'Analisi Strumento';
export const SITE_DESCRIPTION =
  'Dati e confronti numerici su ETF, fondi e azioni rispetto al tuo profilo di investitore.';

/** Shared Open Graph fields: a route's `openGraph` replaces the parent's instead of merging. */
export const BASE_OPEN_GRAPH = { type: 'website', siteName: SITE_NAME, locale: 'it_IT' } as const;

export const SHARE_SIZE = { width: 1200, height: 630 };

export const BRAND_GRADIENT = 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)';

/** Public origin used for absolute share URLs (og:image, og:url). */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}

/** The rising-line mark from the favicon, drawn on a 32×32 grid. */
export function TrendMark({ size, color = '#fff' }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path
        d="M7 21.5l5.5-5.5 4 4L24.5 12"
        fill="none"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="12" r="2.4" fill={color} />
    </svg>
  );
}
