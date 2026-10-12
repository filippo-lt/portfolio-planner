import { SHARE_SIZE, SITE_DESCRIPTION, SITE_NAME } from '@/lib/brand';
import { shareCard } from '@/lib/shareCard';

export const alt = `${SITE_NAME}: ETF, fondi e azioni confrontati con il tuo profilo`;
export const size = SHARE_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return shareCard({ title: 'ETF, fondi e azioni, numeri chiari.', subtitle: SITE_DESCRIPTION, chips: ['Rendimenti', 'Volatilità', 'Drawdown'] });
}
