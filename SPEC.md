# Analisi Strumento – MVP spec

Web app (Next.js App Router + TypeScript + Tailwind, UI in **Italian**). An investor enters an ETF or stock (ISIN or ticker) and gets a neutral, number-based report on how the instrument fits their investor profile.

## Hard rules
- Not a trading platform (no buy/sell/deposit), not a portfolio builder (never suggest what to buy), not financial education.
- No opinions/judgments ("buono", "cattivo", "compra", "consigliato", "adatto/non adatto" as verdicts). Only facts, numbers and comparisons with the user's profile, phrased neutrally (e.g. "Il drawdown massimo storico (-34%) supera la tolleranza indicata (-20%) di 14 punti").
- Disclaimer visible on every page: "Informazioni a scopo informativo, non è consulenza finanziaria."
- All external calls server-side; keys in `.env` (`ANTHROPIC_API_KEY`). Never expose keys to client.
- Missing data shown as "Dato non disponibile" — never estimated.

## Data source (approved)
- Yahoo Finance via `yahoo-finance2` npm (free, unofficial) + OpenFIGI (free, `https://api.openfigi.com/v3/mapping`, optional `OPENFIGI_API_KEY`) for ISIN → ticker fallback.
- Everything behind a `DataProvider` interface (`src/lib/data/provider.ts`) so an EODHD provider can be added later.
- Server-side cache (`src/lib/cache.ts`): in-memory + file cache in `.cache/` (gitignored), TTL 24h prices, 7d fundamentals/profile.

## User flow
1. Onboarding (once, editable anytime, saved in localStorage): age, investment horizon (years), target retirement age, invested net worth (EUR, approximate), risk tolerance = max acceptable drawdown % on whole portfolio, financial knowledge: base / intermedio / avanzato.
2. Search: ISIN or ticker.
3. Report page `/report/[symbol]`.

## Report (computed in code)
- name, type (ETF/Azione), currency, exchange
- TER / ongoing charges (ETF)
- annualized return 1y/3y/5y, annualized volatility (daily log/simple returns × √252), historical max drawdown (on all available history, ≥5y requested)
- benchmark comparison (default VWCE.DE – Vanguard FTSE All-World UCITS ETF Acc; user can change ticker): return, volatility, drawdown side by side + price chart of both rebased to 100
- top holdings, sector and country split if available
- stocks: revenue, net income, total debt, free cash flow (latest annual)
- Profile fit (rule-based): max drawdown vs tolerance; volatility vs horizon; currency exposure vs EUR.
- Detail by knowledge level: base = few key numbers; intermedio = more; avanzato = everything.

## AI layer
- `POST /api/summary`: send computed report JSON to Claude (model `claude-haiku-5-5` default, configurable `ANTHROPIC_MODEL`). System prompt: Italian, short neutral summary, use ONLY numbers in the JSON, no opinions/advice. Server validates that every number in the output appears in the input; on failure returns no summary.
- If no API key: summary section hidden gracefully.

## Out of scope
Macro/geopolitics, entry/exit points, alternatives, mutual funds, accounts, payments.
