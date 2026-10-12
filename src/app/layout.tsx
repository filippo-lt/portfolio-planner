import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900 focus:ring-2 focus:ring-blue-700"
        >
          Vai al contenuto
        </a>
        <header className="border-b border-slate-200">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="rounded text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
              Analisi Strumento
            </Link>
            <nav aria-label="Principale">
              <Link
                href="/profilo"
                className="rounded px-2 py-1 text-sm font-medium text-blue-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Profilo
              </Link>
            </nav>
          </div>
        </header>
        <main id="contenuto" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200">
          <p className="mx-auto w-full max-w-4xl px-4 py-4 text-sm text-slate-700">
            Informazioni a scopo informativo, non è consulenza finanziaria.
          </p>
        </footer>
      </body>
    </html>
  );
}
