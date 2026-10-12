# Analisi Strumento

Web app (Next.js App Router, TypeScript, Tailwind; UI in Italian). An investor enters an ETF, mutual fund or stock (ISIN or ticker) and gets a neutral, number-based report comparing the instrument with their own profile. `SPEC.md` is the source of truth.

Detailed documentation with diagrams is in [`docs/`](docs/README.md): business logic, architecture, data structures and technical details.

## Hard rules

- Not a trading platform, not a portfolio builder, not financial education.
- Facts and numbers only: no opinions or verdicts, no suggestions about what to buy or sell.
- Footer on every page: "Informazioni a scopo informativo, non è consulenza finanziaria."
- All external calls are server-side; keys live in `.env.local` and never reach the client.
- Missing data is shown as "Dato non disponibile", never estimated.

## Setup

Requires Node 22+.

```bash
npm i
cp .env.example .env.local   # ANTHROPIC_API_KEY (optional), ANTHROPIC_MODEL, OPENFIGI_API_KEY (optional)
npm run dev      # http://localhost:3000
npm test         # vitest
npm run build
npm run check    # lint + format + types + tests (run before pushing)
```

Coding standards and tooling: [`docs/coding-standards.md`](docs/coding-standards.md).

Without `ANTHROPIC_API_KEY` the "Riepilogo (AI)" section is simply hidden.

## Data source and limitations

- Yahoo Finance through the unofficial `yahoo-finance2` package; OpenFIGI maps ISIN to ticker/exchange when Yahoo search does not find the listing. EUR listings are listed first.
- Unofficial and unguaranteed: endpoints can change or rate-limit.
- Patchy fields: TER is missing for many European ETFs; Yahoo exposes no country split for ETFs; ETF holdings are limited to about 10; stock sector/country are plain labels, not splits.
- Mutual funds come from Yahoo's Morningstar listings (`0P…` symbols, often on German exchanges): price history can be shorter than for ETFs, holdings are often just a few lines, and sector splits are hidden when the fund holds almost no equity.
- Prices are in each instrument's listing currency; comparison with the benchmark ignores FX (a note says so).
- To switch provider (e.g. EODHD), implement `DataProvider` (`src/lib/data/provider.ts`: `resolve`, `getProfile`, `getHistory`) and swap it in `src/lib/report.ts`.

## Cache

`src/lib/cache.ts`: in-memory LRU (500 entries) plus JSON files in `.cache/` (gitignored). TTL 24h for prices, 7 days for profiles/search/AI summaries. Expired files are deleted on read.

## AI summary

`POST /api/summary` sends the computed report to Claude (`ANTHROPIC_MODEL`, default `claude-haiku-5-5`). The output is accepted only if every number appears in the input (including percentage forms) and no forbidden words are present; one retry, otherwise no summary.

## Structure

```
src/app/                 pages: / (search), /profilo, /report/[symbol]; api/{search,report,summary}
src/components/          ReportView, PriceChart, AiSummary
src/lib/data/            types, DataProvider interface, Yahoo/OpenFIGI implementation
src/lib/metrics.ts       returns, volatility, drawdown, rebase, rolling windows (pure)
src/lib/profileFit.ts    neutral profile statements (pure, isomorphic)
src/lib/summaryValidation.ts  AI output number/word validation
src/lib/report.ts        buildReport
src/lib/cache.ts, format.ts, profileStore.ts (localStorage)
```
