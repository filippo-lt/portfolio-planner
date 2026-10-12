# Backlog: feedback from a knowledgeable friend

Status: draft for product review. Not code. Sizes: S = about 1 day, M = 2-5 days, L = more than 1 week.
Priorities: P0 = do first, P1 = next, P2 = nice to have.

## What exists today (short map)

- Benchmark presets (4 buttons), default `VWCE.DE`, free ticker input: `src/components/ReportView.tsx` (`PRESETS`, `DEFAULT_BENCHMARK`, input "Altro ticker, es. CSPX.L"). The default is also hard-coded in `src/lib/report.ts` and `src/app/api/report/route.ts`.
- Benchmark choice is stored per user in the browser: `src/lib/profileStore.ts` (`useBenchmarkPref`).
- Report build (fund + benchmark, metrics, rebased series): `src/lib/report.ts` (`buildReport`), `src/lib/metrics.ts`.
- Chart: `src/components/PriceChart.tsx` (Recharts; x-axis uses `tickFormatter` = `d.slice(0, 4)`, `minTickGap=32`).
- Data: `src/lib/data/yahoo.ts`, `src/lib/data/types.ts`, `src/lib/data/provider.ts`, cache in `src/lib/cache.ts`. Prices are adjusted close, so distributions are already reinvested in the numbers.
- Costs: only `ter` (a fraction) exists in `InstrumentProfile`; shown as "Costo annuo (TER)" in `ReportView.tsx`, tone in `src/lib/tone.ts`. `isin` exists in the type but is only filled when the user searched by ISIN. No entry/exit fees, no tax, no money simulation.
- Side cards (loss threshold, max drawdown, volatility, horizon vs data): `ReportView.tsx` + `src/lib/profileFit.ts`, `src/lib/tone.ts`. Benchmark comparison table is near line 654 of `ReportView.tsx`.
- Product rules: `SPEC.md` says "never suggest what to buy" and "no opinions". **Decision:** the app does not tell the user what to buy, but it guides them to similar products (same asset class and type) and shows the facts side by side. See item 3.6.

---

## Phase 0: Quick fixes

Delivers: a clean chart and a correct message on the current screen. Comes first because it is small, has no dependencies, and the chart is the screen everyone sees.

### 0.1 Fix repeated year labels on x-axis
- Priority: P0 | Size: S | Type: bug fix (extension)
- What/why: Ticks appear about every 6 months but only the year is shown, so "2022, 2022, 2023, 2024, 2024...". Show month+year (e.g. "gen 23") when ticks are less than a year apart, or force one tick per year.
- Source: review note (screenshot bug).
- Files: `src/components/PriceChart.tsx` (`XAxis` `tickFormatter`, `minTickGap`, `ticks`), `src/lib/format.ts`.
- Acceptance: No two neighbouring labels are equal on 1y, 3y, 5y and 10y ranges; labels readable on a phone.
- Depends on: none.

### 0.2 Show the gap between fund and benchmark in one sentence
- Priority: P1 | Size: S | Type: extension
- What/why: The chart already shows the fund below the bond ETF. Add a neutral line under the chart: "In X years the fund is +Y% and the reference is +Z%". Keep it factual, no judgment (SPEC rule).
- Source: friend 1.
- Files: `src/components/PriceChart.tsx`, `ReportView.tsx` (chart section), `src/lib/metrics.ts`.
- Acceptance: Line uses same numbers as the chart end values; hidden if there is no common period.
- Depends on: none.

---

## Phase 1: Right benchmark for the right fund

Delivers: presets that match the fund's asset class, and benchmarks that are real products with ticker and ISIN. Comes before money simulation because a wrong benchmark makes every later number meaningless.

### 1.1 Detect the asset class of the analysed fund
- Priority: P0 | Size: M | Type: new
- What/why: Know if the fund is equity, bond, mixed or other. Needed to choose fair presets. Use Yahoo category/holdings data when available; fall back to "unknown".
- Source: friend 4, review note (agree with 4 and 7).
- Files: `src/lib/data/yahoo.ts`, `src/lib/data/types.ts` (add an `assetClass` field), `src/lib/__tests__/` (new tests).
- Acceptance: Test fund `0P00009U6I.F` is classified as bond (or "unknown" with a clear reason); unknown never silently picks equity.
- Depends on: none.

### 1.2 Presets depend on asset class
- Priority: P0 | Size: M | Type: extension
- What/why: Bond fund shows only bond presets (e.g. Global Aggregate `AGGH.MI`). Equity fund shows the equity presets. Unknown shows the free ticker input plus a short note. Default benchmark also depends on class (today it is always `VWCE.DE`).
- Source: friend 4, 8; review notes.
- Files: `ReportView.tsx` (`PRESETS`, `DEFAULT_BENCHMARK`), `src/lib/report.ts`, `src/app/api/report/route.ts`, `src/lib/profileStore.ts` (saved choice must be reset when class changes).
- Acceptance: Bond fund never shows equity buttons; saved benchmark pref from another class is ignored; fallback logic (last good benchmark) still works.
- Depends on: 1.1.

### 1.3 S&P 500 only for equity funds
- Priority: P1 | Size: S | Type: extension
- What/why: Keep S&P 500 as an optional toggle for equity funds only. Not always-on. (We disagree with friend 8 for bonds.)
- Source: friend 8, review note.
- Files: `ReportView.tsx` (`PRESETS`).
- Acceptance: S&P 500 button visible for equity funds, hidden for bond funds.
- Depends on: 1.2.

### 1.4 Warning when a custom ticker has a different asset class
- Priority: P1 | Size: S | Type: new
- What/why: If the user types an equity ticker for a bond fund, show a neutral note: "Different type of instrument, comparison may not be fair". Do not block.
- Source: friend 4, review note.
- Files: `ReportView.tsx` (custom input), `src/lib/report.ts`.
- Acceptance: Note shown when classes differ; not shown when equal or unknown.
- Depends on: 1.1.

### 1.5 Benchmarks as real products: curated list with ticker + ISIN
- Priority: P0 | Size: M | Type: new
- What/why: Replace the 4 hard-coded presets with a small curated list: ticker, ISIN, name, asset class, TER, accumulating/distributing, replication (physical/synthetic). The button text shows the real product, e.g. "iShares Core Global Aggregate Bond (ISIN ...)".
- Source: friend 2, 7.
- Files: new `src/lib/benchmarks.ts` (data), `ReportView.tsx`, `src/lib/data/types.ts`.
- Acceptance: Every preset shows ticker and ISIN in the UI; data is reviewed by a person before release; ISIN passes the `ISIN_RE` check in `src/lib/data/yahoo.ts`.
- Depends on: 1.2 (list is grouped by class). Data source: see Open questions.

### 1.6 Show ISIN for the analysed fund and for a custom ticker
- Priority: P1 | Size: S | Type: extension
- What/why: ISIN is in the type but often empty. Fill it (OpenFIGI is already used for ISIN to ticker; check reverse lookup) and show it on both sides of the comparison.
- Source: friend 2.
- Files: `src/lib/data/yahoo.ts` (`figiLookup`), `src/lib/report.ts`, `ReportView.tsx`.
- Acceptance: ISIN shown when known; "Dato non disponibile" when not (SPEC rule, no guessing).
- Depends on: none.

---

## Phase 2: Costs first

Delivers: clear, early view of what the fund costs (TER, entry/exit fees) compared with the reference product. Comes before the simulation because the simulation needs these numbers, and because cost is the strongest simple message.

### 2.1 Move cost card to the top of the report
- Priority: P0 | Size: S | Type: extension
- What/why: TER card exists but is low on the page. Put costs before the risk cards. Show fund TER vs benchmark TER side by side.
- Source: friend 5.
- Files: `ReportView.tsx` (Figure "Costo annuo (TER)", around line 319-361), `src/lib/tone.ts` (`terTone`).
- Acceptance: Cost block is the first card after the chart header; shows "not available" when TER is missing; tone thresholds reviewed (funds 1.5-3% should read as high).
- Depends on: none.

### 2.2 Add entry and exit fee fields to the data model
- Priority: P1 | Size: M | Type: new
- What/why: Add `entryFee`, `exitFee` (and maybe `performanceFee`) to `InstrumentProfile`. Fill from a data source or from a manual overrides file. Yahoo does not give these reliably.
- Source: friend 3, 5.
- Files: `src/lib/data/types.ts`, `src/lib/data/yahoo.ts`, `src/lib/data/provider.ts`, new `src/lib/data/costOverrides.ts` (optional).
- Acceptance: Fields are optional; missing value never estimated; each value has a source label ("from KID", "manual") shown on hover.
- Depends on: data source decision (Open questions).

### 2.3 Costs summary line in euros per year
- Priority: P1 | Size: S | Type: new
- What/why: "On a given amount, TER costs about X per year." Uses the amount from Phase 3; before that, a fixed example of 1,000 EUR.
- Source: friend 5, 7.
- Files: `ReportView.tsx`, `src/lib/format.ts`.
- Acceptance: Number = amount x TER, rounded to whole euros; shown for fund and reference.
- Depends on: 2.1.

### 2.4 Let user enter a fee manually when data is missing
- Priority: P2 | Size: S | Type: new
- What/why: Small input "Entry fee %" / "Exit fee %" so the user can type what their bank charges.
- Source: friend 5.
- Files: `ReportView.tsx`, `src/lib/profileStore.ts`.
- Acceptance: Value saved in the browser, used by Phase 3, clearly marked as "entered by you".
- Depends on: 2.2.

---

## Phase 3: "What do I take home?" money simulation (core differentiator)

Delivers: plain-euro result: invest an amount, see the result after costs in the fund and in the reference product. Comes after Phases 1 and 2 because it needs a fair benchmark and cost data. This is the real value; the chart is secondary.

### 3.1 Amount input and gross simulation (no tax)
- Priority: P0 | Size: M | Type: new
- What/why: User enters an amount (default 1,000 EUR). Show what it became over the available period (and the last 12 months) in the fund and in the reference product, using the adjusted prices already loaded. Plain numbers: "You gain 10 EUR / lose 100 EUR".
- Source: friend 3, 7.
- Files: new `src/lib/simulation.ts`, `src/lib/metrics.ts` (reuse `rebase`), new `src/components/EuroVerdict.tsx`, `ReportView.tsx`, `src/lib/__tests__/` (new test file).
- Acceptance: Unit tests on known series; period shown clearly; currency conversion handled or a note shown if fund and reference currencies differ; works with missing benchmark.
- Depends on: 1.2, 1.5.

### 3.2 Apply entry/exit fees and TER
- Priority: P0 | Size: M | Type: extension
- What/why: Subtract entry fee, exit fee and yearly TER. Show "fees cost you X EUR". Note: fund prices are net of TER already; do not subtract TER twice (check this carefully).
- Source: friend 3, 5, 7.
- Files: `src/lib/simulation.ts`, `src/lib/data/types.ts`, `EuroVerdict.tsx`.
- Acceptance: Test shows TER is not double counted; result shows a breakdown (gross, fees, net); missing fee data shown as "not included".
- Depends on: 3.1, 2.2.

### 3.3 Accumulating vs distributing
- Priority: P1 | Size: M | Type: new
- What/why: Adjusted prices hide this difference. Show coupons/dividends as cash received (distributing) or reinvested (accumulating). Needs dividend history and the share class flag.
- Source: friend 3.
- Files: `src/lib/data/yahoo.ts` (dividend events), `src/lib/data/types.ts`, `src/lib/simulation.ts`.
- Acceptance: For a distributing product, result shows price change plus cash received; for accumulating, one line; flag clearly labelled.
- Depends on: 3.1.

### 3.4 Same-volatility, same-type equivalent ETF
- Priority: P1 | Size: L | Type: new
- What/why: Show "what with 1,000 EUR in an ETF of similar volatility and same instrument type". List 2-3 products from the curated list (1.5) with the same asset class and closest volatility, all shown equally (no single "winner", see 3.6). Explain the rule used in one line.
- Source: friend 3, 7.
- Files: `src/lib/benchmarks.ts`, `src/lib/simulation.ts`, `src/lib/metrics.ts` (`annualizedVolatility`), `EuroVerdict.tsx`.
- Acceptance: Selection rule is deterministic and tested; if no product fits, the section is hidden, not guessed.
- Depends on: 1.5, 3.1.

### 3.5 Shift the page hierarchy: euro result first, chart second
- Priority: P1 | Size: M | Type: extension
- What/why: Put the euro box at the top, chart below as supporting evidence. Keep risk cards (loss threshold, drawdown, volatility, horizon) after.
- Source: friend 7, review note.
- Files: `ReportView.tsx` (layout), `src/lib/shareCard.tsx` (share image may need the euro numbers).
- Acceptance: On mobile the first screen shows the euro numbers without scrolling.
- Depends on: 3.1.

### 3.6 "Similar products" wording (decided: guide, don't recommend)
- Priority: P0 | Size: S | Type: copy + rules
- What/why: Friend 7 wants "you should buy this ISIN". Decision: no buy suggestion. Instead show a neutral "Prodotti simili" list (same asset class and type) with ISIN, TER, fees and the euro result side by side. The user compares and decides. No ranking words ("migliore", "consigliato"), no "compra", no single highlighted winner. Sort by a stated, neutral rule (e.g. closest volatility) and say the rule.
- Example copy: "Prodotti simili per tipo e volatilità: ISIN ... · TER 0,10% · 1.000 € → 1.042 €". Not: "Dovresti comprare ISIN ...".
- Files: `SPEC.md` (rule added), `src/app/api/summary/route.ts` (system prompt), `src/lib/summaryValidation.ts` (block words like "migliore"/"conviene"), `src/lib/tone.ts`.
- Source: friend 2, 7; SPEC.
- Files: `SPEC.md`, `src/app/api/summary/route.ts` (system prompt), `src/lib/summaryValidation.ts`, `src/lib/tone.ts`.
- Acceptance: Written decision in `SPEC.md`; copy reviewed. Legal check only before a public launch (not for the MVP).
- Depends on: none (needed before 3.1 ships to users).

---

## Phase 4: Italy-only tax (optional, after Phase 3 is trusted)

Delivers: net-of-tax euro result for Italian residents only. Comes last because it is the highest risk: wrong tax is worse than no tax.

### 4.1 Tax country setting, Italy only
- Priority: P2 | Size: S | Type: new
- What/why: Add "Residenza fiscale" in the profile with one value: Italy. Other countries show "tax not included". Do not build a country list.
- Source: friend 6, review note.
- Files: `src/lib/profileFit.ts` (`InvestorProfile`), `src/lib/profileValidation.ts`, `src/app/profilo/page.tsx`, `src/lib/profileStore.ts`.
- Acceptance: Old saved profiles still load; field optional.
- Depends on: Phase 3.

### 4.2 Italian capital gains in the simulation
- Priority: P2 | Size: L | Type: new
- What/why: 26% on gains in general, 12.5% on the government-bond part; for ETFs, gains are "redditi di capitale" so losses cannot offset them (show this as a note). Apply to the exit result only. Needs a tax-advisor review.
- Source: friend 6, review note.
- Files: new `src/lib/tax/it.ts`, `src/lib/simulation.ts`, `EuroVerdict.tsx`, tests.
- Acceptance: Tests with hand-checked examples; every tax line labelled "estimate" with the rule used; government-bond share needs a data source (see Open questions); if share is unknown, show range or "not included".
- Depends on: 4.1, 3.2.

---

## Not now / parked

- Multi-country tax: each country has its own rates, rules and loss offsets. Too big, high risk of wrong numbers. Revisit after Italy works.
- Currency conversion costs (friend 6): small effect, needs broker-specific data. Show a note only; revisit with Phase 4.
- S&P 500 always on as a benchmark: rejected, conflicts with friend 4 (unfair for bond funds). Kept only for equity funds (1.3).
- Equity ETFs offered as benchmark for a bond fund: removed by 1.2. Acceptable in the first beta only.
- Becoming a general fund comparator like other sites: against the product direction (friend 7).
- Portfolio of several funds / accounts / buy button: outside the SPEC scope.

## Open questions

1. Where do entry/exit fees and fund TER come from? Yahoo is weak on this. Options: KID documents, a paid data API (the `DataProvider` interface allows one), or a hand-made table for the top funds. Who keeps it updated?
2. Where does the curated benchmark list (ticker + ISIN + replication + accumulating/distributing) come from, and who reviews it? How often?
3. How do we reliably detect asset class and "same instrument type" for a fund from the data we have?
4. Decided: guide to similar products, never suggest what to buy (item 3.6). Legal check not needed for the MVP (private, between friends); revisit only before a public launch.
5. For Italian tax, how do we get the government-bond share of a bond fund (12.5% vs 26%)? Without it, do we show a range or skip tax?
6. Currency: if the fund is in EUR and the reference is in USD or GBP, do we convert and how do we show it?
7. Which period is the "last year" figure in the euro box: last 12 months, or calendar year?
