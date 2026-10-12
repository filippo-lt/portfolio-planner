import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TabBar, TopBar } from "@/components/AppNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Analisi Strumento",
  description: "Dati e confronti numerici su ETF e azioni rispetto al tuo profilo di investitore.",
  appleWebApp: { capable: true, title: "Analisi", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e14" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg text-ink has-[[data-tabbar]]:pb-[calc(env(safe-area-inset-bottom)+3.5rem)] sm:has-[[data-tabbar]]:pb-0">
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
        >
          Vai al contenuto
        </a>
        <TopBar />
        <main id="contenuto" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-6 pt-5 sm:px-6 sm:pt-8">
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
