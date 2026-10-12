import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'Analisi',
    description: SITE_DESCRIPTION,
    lang: 'it',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f5fa',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  };
}
