import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Il tuo profilo',
  description: 'Età, orizzonte, patrimonio e tolleranza alle perdite: i dati con cui confrontare ogni strumento.',
};

export default function ProfiloLayout({ children }: LayoutProps<'/profilo'>) {
  return children;
}
