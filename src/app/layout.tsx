import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { TabBar, TopBar } from '@/components/AppNav';
import { BASE_OPEN_GRAPH, SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/brand';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: 'Analisi', statusBarStyle: 'default' },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: SITE_NAME, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // theme-color is set by THEME_SCRIPT so it follows the in-app choice, not only the OS
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink has-[[data-tabbar]]:pb-[calc(env(safe-area-inset-bottom)+3.5rem)] sm:has-[[data-tabbar]]:pb-0">
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
        >
          Vai al contenuto
        </a>
        <TopBar />
        <main id="contenuto" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-6 sm:px-6 sm:pt-8">
          {children}
        </main>
        <footer>
          <p className="mx-auto w-full max-w-5xl px-4 py-5 text-xs text-muted sm:px-6">
            Informazioni a scopo informativo, non è consulenza finanziaria.
          </p>
        </footer>
        <TabBar />
      </body>
    </html>
  );
}
