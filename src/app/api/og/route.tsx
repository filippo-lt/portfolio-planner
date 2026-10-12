import { exchangeLabel, typeLabel } from '@/lib/labels';
import { SYMBOL_RE } from '@/lib/report';
import { shareCard } from '@/lib/shareCard';
import { shareEuro, shareProfile } from '@/lib/shareProfile';

/** Share image for a report link: /api/og?symbol=VWCE.DE (a colocated opengraph-image breaks the route's static shell). */
export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get('symbol')?.trim();
  if (!symbol || !SYMBOL_RE.test(symbol)) return new Response('Simbolo non valido', { status: 400 });
  const [profile, euro] = await Promise.all([shareProfile(symbol), shareEuro(symbol)]);
  const chips = [symbol, profile && typeLabel(profile.type), exchangeLabel(profile?.exchange)].filter(
    (c): c is string => !!c,
  );
  const image = shareCard({
    title: profile?.name ?? symbol,
    subtitle: 'Rendimenti, volatilità e drawdown a confronto con il benchmark.',
    chips,
    euroLine: euro.line,
  });
  // Cache only complete cards (a card with no euro line by design is complete); a fallback (provider slow or down) should be retried by the next crawler.
  image.headers.set(
    'Cache-Control',
    profile && euro.final ? 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' : 'no-store',
  );
  return image;
}
