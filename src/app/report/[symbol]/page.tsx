import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ReportRoute } from '@/components/ReportRoute';
import { PageLoading } from '@/components/ui';
import { BASE_OPEN_GRAPH, SHARE_SIZE } from '@/lib/brand';
import { decodeSymbol, shareProfile } from '@/lib/shareProfile';

export async function generateMetadata({ params }: PageProps<'/report/[symbol]'>): Promise<Metadata> {
  const symbol = decodeSymbol((await params).symbol);
  const profile = await shareProfile(symbol);
  const title = profile ? `${profile.name} (${symbol})` : symbol;
  const description = `Rendimenti, volatilità e drawdown di ${profile?.name ?? symbol}, confrontati con il benchmark e con il tuo profilo di investitore.`;
  const url = `/report/${encodeURIComponent(symbol)}`;
  const image = {
    url: `/api/og?symbol=${encodeURIComponent(symbol)}`,
    ...SHARE_SIZE,
    alt: `Analisi di ${profile?.name ?? symbol}`,
  };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...BASE_OPEN_GRAPH, title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/** Marks the per-symbol metadata as intentionally request-time without blocking the static shell. */
async function RequestTime() {
  await connection();
  return null;
}

export default function ReportPage() {
  return (
    <>
      <Suspense fallback={<PageLoading />}>
        <ReportRoute />
      </Suspense>
      <Suspense>
        <RequestTime />
      </Suspense>
    </>
  );
}
