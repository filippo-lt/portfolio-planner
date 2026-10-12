# Plan: implement docs/backlog-friend-feedback.md

Spec: `SPEC.md` (hard rules) + `docs/backlog-friend-feedback.md` (item numbers like 0.1, 3.2 refer to it). Read the backlog item(s) your task names before coding.

## Global Constraints

- UI copy is **Italian**. Neutral, factual wording only. Never use: "migliore", "peggiore", "conviene", "consigliato", "compra", "dovresti", "buono", "cattivo", "adatto/non adatto" as verdicts. No single highlighted "winner".
- Missing data shows "Dato non disponibile" (or "non incluso" for a cost/tax line). Never estimate a missing value. Estimates that come from rules (tax) must be labelled "stima" with the rule used.
- Next.js 16 / React 19 with breaking changes: before touching app/route code read the relevant guide in `node_modules/next/dist/docs/`.
- Pure logic goes in `src/lib/` with vitest tests in `src/lib/__tests__/`. UI in `src/components/`.
- Before reporting done, all must pass: `npx vitest run`, `npx tsc --noEmit` (one pre-existing error in `src/app/profilo/layout.tsx` is known — ignore only that one), `npx eslint src`.
- Commit with: `git commit --author="filippo-lt <filippo.tosetto@leadtech.com>" -m "<concise message>"`. No Co-Authored-By lines, no AI mention in messages.
- Match the surrounding code style (comment density, naming, Tailwind tokens, components in `src/components/ui.tsx`).
- Mobile first: layouts must work at 375px wide.
- Product decisions (from the product owner):
  - Curated data (benchmarks, fee overrides) is hand-made in code, each entry has a `reviewed: false` flag until a person checks it.
  - "Last year" in the euro box = last 12 months.
  - Italian tax when the government-bond share is unknown: show a range 12.5%–26%.
  - Phase 5 countries: IT, ES, DE, FR, UK. Default FX cost 0.25% per conversion, user-editable.

---

## Task 1: Chart fixes (backlog 0.1 + 0.2)

- 0.1: in `src/components/PriceChart.tsx` the x-axis repeats the year. Compute explicit `ticks` from the data: if the span is > ~3 years use one tick per year (first date of each year, label "2023"); otherwise label month+year in Italian short form ("gen 23"). Put the label helper in `src/lib/format.ts` (`fmtMonthYear`) and the tick selection in a pure, tested helper (e.g. `src/lib/chartTicks.ts`). No two neighbouring labels may be equal on 1y/3y/5y/10y spans; test that.
- 0.2: under the chart add one neutral sentence: "In {N} anni {nameA} è {+Y%} e {nameB} è {+Z%}." (use "mesi" when under 1 year). Numbers = the chart end values (last.a − 100, last.b − 100 on the rebased series). Pure helper in `src/lib/metrics.ts` (`chartGap`) with tests. Hidden when there is no common period (empty chart).

## Task 2: Asset class detection (backlog 1.1)

- Add to `src/lib/data/types.ts`: `export type AssetClass = 'equity' | 'bond' | 'mixed' | 'other' | 'unknown'` and on `InstrumentProfile`: `assetClass?: AssetClass; assetClassReason?: string` (short Italian reason, e.g. "Categoria Yahoo: EUR Diversified Bond").
- New pure module `src/lib/assetClass.ts`: `classifyAssetClass(input: { type; name; category?: string; stockPosition?: number; bondPosition?: number; cashPosition?: number }): { assetClass; reason }`. Rules, in order: STOCK → equity. Positions when present: stock ≥ 0.7 → equity, bond ≥ 0.7 → bond, stock+bond ≥ 0.7 with both ≥ 0.15 → mixed. Then category / name keywords (case-insensitive, IT+EN): bond words ("bond", "obblig", "aggregate", "treasury", "govt", "government", "corporate", "fixed income", "reddito fisso", "monetari", "money market") → bond; "allocation", "bilanciat", "multi-asset", "flessibil", "mixed", "lifestrategy" → mixed; "equity", "azionar", "stock", "msci", "s&p", "ftse all-world" → equity; commodity/gold → other. Nothing matches → unknown with reason "Dati insufficienti per stabilire il tipo". Unknown must never become equity.
- In `src/lib/data/yahoo.ts` `getProfile`: read `fundProfile.categoryName`, `topHoldings.stockPosition/bondPosition/cashPosition`, call the classifier, set the two fields.
- Tests in `src/lib/__tests__/assetClass.test.ts`. Include a case modelled on the test fund `0P00009U6I.F` (a bond fund; check what Yahoo returns for it with a quick live script if network allows, and encode those inputs as a fixture; if not reachable, use a name-based bond fixture and note it).

## Task 3: Curated benchmark list + class-dependent presets (backlog 1.5, 1.2, 1.3)

- New `src/lib/benchmarks.ts`: `export interface Benchmark { symbol; isin; name; assetClass: AssetClass; ter: number; distribution: 'acc' | 'dist'; replication: 'physical' | 'synthetic'; currency: string; govtShare?: number /* 0..1, bonds only, used later for IT tax */; label: string /* short Italian button label */; optional?: boolean; reviewed: boolean }` and `BENCHMARKS: Benchmark[]`. Seed (all `reviewed: false`, values from issuer data, to be verified by a person):
  - equity: VWCE.DE Vanguard FTSE All-World UCITS ETF (USD) Acc, IE00BK5BQT80, TER 0.19%, acc, physical, EUR, "Azioni mondo" | SWDA.MI iShares Core MSCI World UCITS ETF USD (Acc), IE00B4L5Y983, 0.20%, acc, physical, EUR, "Azioni paesi sviluppati" | EIMI.MI iShares Core MSCI EM IMI UCITS ETF USD (Acc), IE00BKM4GZ66, 0.18%, acc, physical, EUR, "Azioni paesi emergenti" | SXR8.DE iShares Core S&P 500 UCITS ETF USD (Acc), IE00B5BMR087, 0.07%, acc, physical, EUR, "Azioni USA (S&P 500)", `optional: true` | SC0J.DE Invesco S&P 500 UCITS ETF Acc, IE00B3YCGJ38, 0.05%, acc, synthetic, EUR, "Azioni USA sintetico (S&P 500)", `optional: true`.
  - bond: AGGH.MI iShares Core Global Aggregate Bond UCITS ETF EUR Hedged (Acc), IE00BDBRDM35, 0.10%, acc, physical, EUR, "Obbligazioni globali", govtShare 0.55 | XGLE.DE Xtrackers II Eurozone Government Bond UCITS ETF 1C, LU0290355717, 0.07%, acc, physical, EUR, "Titoli di Stato area euro", govtShare 1 | IEGA.MI iShares Core € Govt Bond UCITS ETF (Dist), IE00B4WXJJ64, 0.07%, dist, physical, EUR, "Titoli di Stato area euro (dist.)", govtShare 1 | IEAC.MI iShares Core € Corp Bond UCITS ETF (Dist), IE00B3F81R35, 0.20%, dist, physical, EUR, "Obbligazioni societarie euro", govtShare 0 | IBGS.MI iShares € Govt Bond 1-3yr UCITS ETF (Dist), IE00B14X4Q57, 0.07%, dist, physical, EUR, "Titoli di Stato euro 1-3 anni", govtShare 1.
  - mixed: V60A.DE Vanguard LifeStrategy 60% Equity UCITS ETF (Acc), IE00BMVB5R75, 0.25%, acc, physical, EUR, "Bilanciato 60/40" | V40A.DE Vanguard LifeStrategy 40% Equity UCITS ETF (Acc), IE00BMVB5P51, 0.25%, acc, physical, EUR, "Bilanciato 40/60".
  - Helpers: `benchmarksFor(cls)`, `defaultBenchmarkFor(cls): string | undefined` (equity → VWCE.DE, bond → AGGH.MI, mixed → V60A.DE, other/unknown → undefined), `findBenchmark(symbol)`.
  - Tests: every ISIN matches `ISIN_RE` AND passes the ISIN check-digit algorithm (implement `isValidIsin` in `src/lib/isin.ts`, tested with known-good ISINs). If a seeded ISIN fails the checksum, report it as a concern; do not invent a replacement.
- Remove the duplicated `DEFAULT_BENCHMARK`/`PRESETS` in `ReportView.tsx`; use `benchmarks.ts`. `buildReport(symbol, benchmarkSymbol?)`: when no benchmark is given, pick `defaultBenchmarkFor(instrument.assetClass)`; when that is undefined, return the report with a benchmark error state meaning "Scegli un riferimento" (no silent equity). `src/app/api/report/route.ts` must not inject a default anymore. Keep `/api/og` working.
- Preset buttons show only `benchmarksFor(instrument class)`; bond funds never see equity buttons. Optional (S&P 500) entries are shown for equity funds only, behind a "Mostra anche S&P 500" toggle (not on by default). Each button shows the label, the real product name, ticker and ISIN (ISIN may be in smaller text). Unknown/other class: no preset buttons, the free ticker input plus a short note "Tipo di strumento non riconosciuto: scegli tu il riferimento".
- `src/lib/profileStore.ts` `useBenchmarkPref`: store `{ symbol, assetClass }` (keep reading the old plain-string value as legacy with unknown class). A saved pref whose class differs from the current instrument class is ignored. The existing "last good benchmark" fallback logic in ReportView must still work.
- Update `SPEC.md` default-benchmark line to describe class-dependent defaults.

## Task 4: Custom-ticker class warning + ISIN everywhere (backlog 1.4, 1.6)

- 1.4: when the benchmark's assetClass and the instrument's assetClass are both known (not unknown) and differ, show a neutral note near the benchmark choice: "Strumento di tipo diverso (obbligazionario vs azionario): il confronto potrebbe non essere omogeneo." Do not block. Put the comparison logic in a pure tested helper (e.g. in `src/lib/report.ts`, `classMismatch(a, b)`), and add the note to `report.notes` or a dedicated field.
- 1.6: fill `isin` in `getProfile` when missing: first the curated list (`findBenchmark`), then OpenFIGI reverse lookup if it supports ticker → ISIN (check OpenFIGI v3 docs; mapping by `TICKER` + `exchCode` returns FIGI data but usually not ISIN — if no ISIN is available that way, do not fake it). Cache result via the existing profile cache. Show ISIN on both sides of the comparison (instrument header and benchmark column) or "Dato non disponibile".

## Task 5: Costs first (backlog 2.1 + 2.3)

- Move the cost block ("Costo annuo (TER)") so it is the first card after the chart header, before risk cards. Show fund TER and benchmark TER side by side (benchmark TER from the profile, falling back to the curated list). "Dato non disponibile" when missing.
- Review `terTone` in `src/lib/tone.ts`: funds with TER 1.5%–3% must read as the "high" tone; keep the tone descriptive (tone colour), not a verdict word. Update tests.
- 2.3: line "Su 1.000 € il TER costa circa X € all'anno" for fund and reference; X = round(amount × TER) in whole euros, formatted with a new `fmtEur` in `src/lib/format.ts` (it-IT, "1.000 €"). Use a fixed 1,000 € now; Task 8 will wire the user amount. Pure helper + tests.

## Task 6: Entry/exit fee data + manual input (backlog 2.2 + 2.4)

- `src/lib/data/types.ts`: `export interface FeeValue { value: number /* fraction */; source: 'kid' | 'manual' | 'user' }`; on `InstrumentProfile` add optional `entryFee?: FeeValue; exitFee?: FeeValue; performanceFee?: FeeValue`.
- New `src/lib/data/costOverrides.ts`: a table keyed by symbol and/or ISIN with fees + source + `reviewed: false`. Start with the curated ETFs (entry 0, exit 0, source 'kid' — ETFs have no entry/exit fee at the fund level) and no guessed fund values. Apply overrides in the provider layer (after `getProfile`, in `report.ts` `profileOf` or a provider wrapper). Never estimate missing fees.
- UI: show entry/exit (and performance if present) in the cost block; each value has a source label shown on hover/focus ("da KID", "inserito manualmente", "inserito da te"). Missing → "non disponibile".
- 2.4: small inputs "Commissione di ingresso %" / "Commissione di uscita %" shown when the fund's fee is missing. Saved in the browser via `profileStore.ts` per symbol (`useFeeOverride(symbol)`), validated (0–10%), marked "inserito da te". A user value takes effect only when the data value is missing. Export a pure merge helper `effectiveFees(profile, userFees)` with tests; Task 8 will consume it.

## Task 7: "Similar products" rules (backlog 3.6)

- `SPEC.md` already has the rule; check it states: guide to similar products, never suggest what to buy, sort by a stated neutral rule, legal check only before a public launch. Add any missing piece.
- `src/app/api/summary/route.ts` system prompt: add that the summary must never suggest buying/selling or name a product as preferable, and must not use ranking words.
- `src/lib/summaryValidation.ts`: reject outputs containing (case-insensitive, word-boundary, Italian inflections) "migliore/migliori", "peggiore", "conviene/conveniente", "consigliat*", "compra/comprare/acquista", "dovresti", "raccomand*". Tests.
- `src/lib/tone.ts`: export a shared `BANNED_WORDS` list (or similar) reused by validation, and a test that scans the Italian UI copy constants you can reach (e.g. strings in `src/lib/labels.ts`) for banned words.

## Task 8: Euro simulation with fees (backlog 3.1 + 3.2)

- New `src/lib/simulation.ts` (pure): `simulate({ amount, prices: PricePoint[], from?: string, to?: string, entryFee?: number, exitFee?: number }) → { start, end, startDate, endDate, years, grossValue, entryFeeEur, exitFeeEur, netValue, gainEur, feesIncluded: { entry: boolean; exit: boolean } }`. Entry fee reduces the invested amount; exit fee applies to the final value. Prices are adjusted close and **already net of TER**: TER is never subtracted again. Expose `terCostEstimate(amount, ter, years)` only as an informational "già incluso nel prezzo" line. Two periods: full common period of fund and reference, and last 12 months (`lastYear` = last date minus 365 days, nearest available point).
- Unit tests on hand-made series: gross value, fees, net value, no TER double count (explicit test), missing fee → `feesIncluded.entry = false`, missing benchmark → reference result undefined, period too short → undefined.
- Currency: if fund or reference currency is not EUR, show a note "Valori nella valuta di quotazione (USD): conversione non inclusa" (Task 14 will add conversion).
- New `src/components/EuroVerdict.tsx`: amount input (default 1.000 €, saved in browser via profileStore `useSimAmount`), for fund and reference side by side: "1.000 € → 1.042 €" (full period, with dates) and last 12 months, plus breakdown lines "Valore lordo", "Commissioni" ("non incluse" when missing), "Valore netto". Plain words: "Guadagno: 42 €" / "Perdita: 100 €". Use `effectiveFees` from Task 6. Wire the amount into the Task 5 "Su X € il TER costa…" line. Place it in ReportView near the chart for now (Task 11 moves it).

## Task 9: Accumulating vs distributing (backlog 3.3)

- `src/lib/data/types.ts`: `distribution?: 'acc' | 'dist'` on `InstrumentProfile` and a `DividendEvent { date; amount }`. Provider: add `getDividends(symbol, years)` to `DataProvider` and implement in yahoo (chart `events: 'div'`); also expose raw (non-adjusted) closes: add `getHistory` option or a separate `getRawHistory` (cache like history). Distribution flag: curated list first, then name heuristics ("Acc", "(Acc)", "1C", "Accumulating", "Capitalizzazione" → acc; "Dist", "(Dist)", "1D", "Distributing", "Distribuzione", "Inc" → dist), else undefined shown as "Dato non disponibile".
- `simulation.ts`: for a dist product, result = price change on raw closes + cash received (sum of dividends × shares, not reinvested). For acc (or unknown) keep the adjusted series, one line. Tests on hand-made series.
- EuroVerdict shows the flag labelled ("Ad accumulazione" / "A distribuzione") and, for dist, "di cui cedole/dividendi incassati: X €".

## Task 10: Similar products (backlog 3.4)

- Pure `similarProducts(instrumentClass, instrumentVol, candidates: { benchmark; vol }[], n = 3)` in `src/lib/benchmarks.ts` or new `src/lib/similar.ts`: same assetClass only, sorted by |vol − instrumentVol| ascending, tie-break by symbol; exclude the instrument itself; return [] if class unknown/other or no candidates. Deterministic, tested.
- Server: compute volatility for the curated products of the same class (reuse cached history + `annualizedVolatility`) and the euro simulation per product (same amount and period as the fund) — add to the report payload or a small API route; keep it cached.
- UI section "Prodotti simili per tipo e volatilità" listing up to 3, all styled the same (no highlight): name, ISIN, TER, fees, "1.000 € → X €". One line stating the rule: "Ordinati per volatilità più vicina a quella dello strumento analizzato." Hidden when the list is empty. Banned words from Task 7 must not appear.

## Task 11: Page hierarchy (backlog 3.5)

- Reorder `ReportView.tsx`: euro box (EuroVerdict) first, right after the instrument header; then costs; then chart (with gap sentence) as supporting evidence; then risk cards (loss threshold, drawdown, volatility, horizon), then the rest. On a 375×812 viewport the euro numbers must be visible without scrolling — verify in the browser.
- `src/lib/shareCard.tsx`: add the euro result line (full period) to the share image when available.

## Task 12: Tax residence + Italian tax (backlog 4.1 + 4.2)

- 4.1: add optional `taxCountry?: 'IT' | 'ES' | 'DE' | 'FR' | 'UK' | 'OTHER'` to `InvestorProfile` (`src/lib/profileFit.ts`), validation in `src/lib/profileValidation.ts`, field "Residenza fiscale" in `src/app/profilo/page.tsx`, persistence in `profileStore.ts`. Old saved profiles (no field) must still load — test it. Until Task 13, non-IT shows "Tasse non incluse".
- 4.2: new `src/lib/tax/it.ts`: on a positive gain at exit only: equity/other → 26%; bond/mixed with known `govtShare` g (from curated list) → effective rate 12.5%·g + 26%·(1−g); unknown share → range low 12.5% high 26%. Loss → tax 0 with the note "Per ETF e fondi i guadagni sono redditi di capitale: le perdite non possono compensarli." (show this note always for ETF/FUND). Result `{ low, high, rateLabel, notes }` in euros. Hand-checked tests (e.g. gain 100 € equity → 26 €; bond g=1 → 12.5 €; unknown → 12.5–26 €).
- EuroVerdict: line "Tasse (stima, regola: …): X €" or a range, and "Netto dopo tasse". Every tax line labelled "stima".

## Task 13: Tax engine per country (backlog 5.1)

- `src/lib/tax/index.ts` common interface: `interface TaxRules { country; label; estimate(input: { gainEur; assetClass; govtShare?; type }): { low; high; rateLabel; notes: string[] } }`, `taxRulesFor(country)` returning undefined for OTHER ("Tasse non incluse"). Move IT into it.
- Add (simplified, 2026 rules, every result labelled "stima", flagged for review in a code comment):
  - ES: savings brackets on the gain: 19% up to 6.000 €, 21% to 50.000 €, 23% to 200.000 €, 27% to 300.000 €, 30% above. Note: losses can offset gains (not modelled).
  - DE: 26,375% (25% + 5,5% Soli) on the taxable gain after Teilfreistellung: equity funds 30% exempt, mixed 15%, bond 0. Notes: Sparer-Pauschbetrag 1.000 € and Vorabpauschale not included; church tax not included.
  - FR: PFU flat 31,4% (12,8% income tax + 18,6% social charges, from 2026) — note "PEA/assurance-vie non considerati".
  - UK: range 18%–24% (CGT basic/higher rate), note "Annual exempt amount (£3.000) e fondi non 'reporting' non considerati".
- Hand-checked tests per country. UI shows the rule label for the chosen residence.

## Task 14: Currency conversion costs (backlog 5.2)

- Provider: FX history via Yahoo (`EURUSD=X` style: for currency C, symbol `EUR${C}=X` gives C per 1 EUR); GBp (pence) handled as GBP/100. Cached like prices.
- `simulation.ts`: when the product currency ≠ EUR, convert: at start EUR → C at the start rate minus FX cost, value in C at the end, C → EUR at the end rate minus FX cost. Result in EUR with its own line "Costo cambio valuta: X €" and the FX rate dates shown. Tests with hand-made series.
- FX cost default 0,25% per conversion, user-editable in the EuroVerdict ("Costo cambio %", saved via profileStore), with the source label "valore predefinito (stima tipica broker)" or "inserito da te".
- Remove the Task 8 "conversione non inclusa" note when conversion is applied; keep it when FX data is missing.
