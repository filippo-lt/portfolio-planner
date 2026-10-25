// PROTOTYPE (throwaway): alternatives comparison for wayfinder ticket "How are a Product and its Alternatives compared, including Cost and Tax?"
import { NA } from '@/lib/profileFit';
import type { Row } from './altData';

export function statusNote(r: Row): string | undefined {
  if (r.state === 'loading') return 'Caricamento…';
  if (r.state === 'history') return 'Storia insufficiente per questo periodo';
  if (r.state === 'error') return NA;
  if (r.state === 'ter') return 'Costi correnti non disponibili: costo reale ' + NA.toLowerCase();
  return undefined;
}
