# Exposure detection from free data

Question (issue #13): which free fields tell us a product's exposure (asset class + region + category/style), for Italian bank-sold funds and UCITS ETFs, and where do we get a candidate ETF universe?

Probe run on 2026-10-25 with `yahoo-finance2` v4 (same `quoteSummary` modules as `src/lib/data/yahoo.ts`), plus direct fetches of Borsa Italiana pages. Raw probe scripts were throwaway and are not committed.

## Short answer

1. **Yahoo `fundProfile.categoryName` is `null` for every European product tested** (20 of 20 that returned a profile). It cannot be the first signal.
2. **Asset class** is detectable from Yahoo `topHoldings.stockPosition / bondPosition` for most ETFs and for funds Yahoo knows.
3. **Region and style are not in Yahoo at all.** The only free structured source is the Borsa Italiana per-ETF page (`Area Benchmark`, `Stile Benchmark`, `Benchmark`, TER), which covers ETFs only, not bank funds.
4. For bank funds, region and style rest on name parsing (and, optionally, the KID text). Where that fails, the product is "exposure unknown" and gets no alternatives.
5. The ETF universe: no downloadable current list was found. Enumerate ISINs, then read each Borsa Italiana ETF page. See "ETF universe".

## Candidate signals

| Signal | Gives | Source (primary) |
|---|---|---|
| Yahoo `fundProfile.categoryName` / `defaultKeyStatistics.category` | Morningstar-style category | Yahoo `quoteSummary` via [yahoo-finance2 quoteSummary module](https://github.com/gadicc/yahoo-finance2/blob/devel/docs/modules/quoteSummary.md) |
| Yahoo `topHoldings.stockPosition/bondPosition/cashPosition` | Asset class mix | same |
| Yahoo `topHoldings.sectorWeightings`, `holdings` (top 10) | Sector mix, top names | same |
| Yahoo `fundProfile.styleBoxUrl` | Size/style box image (e.g. `3_0stylelargeeq2.gif`) | same |
| Yahoo `quote.longName`, `fundProfile.family`, `legalType`, TER | Name for parsing, issuer, TER | same |
| Borsa Italiana ETF page: `Benchmark`, `Area Benchmark`, `Stile Benchmark`, `Classe`, `Commissioni totali annue`, `Dividendi` | Index, region/style bucket, TER, acc/dist | Example: [IE00B4L5Y983 scheda](https://www.borsaitaliana.it/borsa/etf/scheda/IE00B4L5Y983-ETFP.html?lang=it) |
| Borsa Italiana search form filters (`idBenchmark`: Corporate E Gov. Bond, Developed Markets, Emerging, Others; `idBenchmarkStyle`; ESG Art. 8/9) | Borsa's own taxonomy | [ETF home form](https://www.borsaitaliana.it/borsa/etf.html?lang=it) |
| Fund name parsing (e.g. "Azioni America", "Obbligazioni Euro Breve", "MSCI World") | Region, asset class, theme | the name itself |
| KID/prospectus "objectives" text naming the benchmark | Index name | KID content rules: [Commission Delegated Regulation (EU) 2017/653](https://eur-lex.europa.eu/eli/reg_del/2017/653/oj) |
| ESMA FIRDS reference data | ISIN, CFI code, issuer, name | [ESMA FIRDS download instructions](https://www.esma.europa.eu/sites/default/files/library/esma65-8-5014_firds_-_instructions_for_download_of_full_and_delta_reference_files.pdf) |
| justETF / Morningstar category pages | Category, region | Not tested: no documented free API; scraping terms not checked. Treat as out of scope. |

## Coverage on the sample

Sample: 10 UCITS ETFs and 10 funds by ISIN (Yahoo search by ISIN, then `quoteSummary`), plus 8 Italian bank/asset-manager funds searched by name.

**ETFs (10, resolved by ISIN, mostly London/Milan/Xetra listings):**

| Field | Covered |
|---|---|
| Resolved to a symbol | 10/10 |
| `categoryName` | 0/10 |
| `stockPosition`/`bondPosition` (asset class) | 9/10 (one iShares listing `0GGH.L` returned no fund data) |
| Sector weights | 7/10 (equity ETFs; bond ETFs correctly have none) |
| TER | 7/10 (Vanguard ETFs returned none) |
| Region | 0/10 |

**Funds by ISIN (10):**

| Field | Covered |
|---|---|
| Resolved to a fund | 5/10 (the Italian `IT…` ISINs and one Luxembourg ISIN found nothing; two hits were a different product) |
| Fund data usable (positions) | 3/10 |
| `categoryName` | 0/10 |
| Region | 0/10 |

**Funds by name (8 Italian names):** 5/8 resolved; all 5 had stock/bond positions and a style box. Unresolved: Mediolanum Challenge Italian Equity, Fideuram Fonditalia Bond Global, Eurizon Obbligazioni Euro Breve Termine. So **name search finds Italian funds that ISIN search misses**; the app already searches by name.

Other observations:
- `styleBoxUrl` exists but is unreliable for region: the Fonditalia Emerging Markets fund shows the same "large equity" box as a US fund. Treat it as noise.
- Yahoo `topHoldings` holds only the top 10 holdings and sector weights; no country weights (also noted in `src/lib/data/yahoo.ts`).
- Borsa Italiana's ETF page returned `Area Benchmark EQUITY WORLD`, `Stile Benchmark Sviluppati`, `Benchmark MSCI TRN WORLD INDEX`, TER 0,20% for the MSCI World ETF: all four needed fields in one place, in Italian-market terms.

## Which to trust first

For **ETFs listed in Italy** (alternatives are ETFs, so the candidate side is always this):
1. Borsa Italiana page: `Area Benchmark` + `Stile Benchmark` + `Classe` + benchmark name. Official venue data, one consistent taxonomy for every candidate.
2. Benchmark name parsing (MSCI World, S&P 500, FTSE MIB...) to split within an area.
3. Yahoo positions only as a cross-check.

For the **searched product** (fund or ETF):
1. Asset class: Yahoo `stockPosition/bondPosition` (already used by `classifyAssetClass`), then name keywords. Keep the current rules.
2. Region and category: if the product is a Borsa-listed ETF, use signal 1 above (look up by ISIN). Otherwise name parsing with a small curated keyword table (America/USA, Europa, Italia, Mondo/Global/World, Emergenti/Emerging, Asia, Pacifico, Euro, Corporate, Governativi/Government, Breve termine/Short...).
3. Confidence rule: if asset class and region both resolve, match; if only asset class resolves, show nothing or say so, never guess.

Not trusted as a primary signal: Yahoo category (empty), style box (wrong), sector weights (equity only, say nothing about region).

## What stays undetectable

- Region/category for bank funds whose name does not state it (e.g. a branded or thematic name) and that Yahoo does not resolve (3 of 8 Italian names here, 5 of 10 by ISIN).
- Geographic breakdown of any product (Yahoo gives none; only the KID/prospectus or issuer factsheet does, as PDF).
- Hedged vs unhedged, ESG/SRI screening, smart-beta factor, from Yahoo alone. Name and Borsa's ESG Art. 8/9 filter partly cover this for ETFs.
- Sub-categories such as duration or credit quality for bond products, beyond what the name says.
- Funds Yahoo does not carry at all (no price series, so no volatility tie-breaker either).

## ETF universe (Italy)

- **No current downloadable list found.** `https://www.borsaitaliana.it/etf/etf/fulllist.pdf` still serves, but its header and PDF metadata date it December 2017 (about 770 ISIN rows with columns ISIN, name, trading code, issuer, benchmark index, TER, grouped under Borsa's headings like "AZIONARIO MONDO"). Use it only as a format reference. A 2012 copy exists at `.../etf/etfold/etflist.pdf`.
- **Current data is per ETF:** each listed ETF has a page at `https://www.borsaitaliana.it/borsa/etf/scheda/<ISIN>-ETFP.html` with ISIN, TER ("Commissioni totali annue"), issuer, currency, benchmark, area, style and distribution policy (checked on IE00B4L5Y983, 2026-10-25). Fetch worked with plain HTTP and a browser user agent.
- **Enumerating ISINs:** the ETF home page has a search form (`/borsa/etf/search.html`) with benchmark-area and style filters, but direct requests to it returned HTTP 400 from a script, so its result list could not be confirmed. The documents search (`/borsa/etfplus/search.html?lang=it&instrumenttype=ETF&page=N`) does load, but it lists recent KID/prospectus publications (ISIN, issuer, date), not the full universe. Open question for the build: find the list endpoint (browser network tab), or maintain the universe as a curated, versioned JSON of ISINs (the app already has `src/lib/benchmarks.ts`) enriched from the scheda pages at build time.
- **ESMA FIRDS** gives ISIN, name, CFI and issuer for all EU instruments in weekly full files, but no index, TER or region. Useful to validate ISINs and filter to ETFs, not to classify.
- **Terms of use:** not checked for Borsa Italiana scraping. Decide before automating; a periodic build-time snapshot is the lowest-risk shape.

## Recommendation for the matcher

Build the candidate list from a snapshot (ISIN, name, TER, benchmark, area, style, trading code, Yahoo symbol) refreshed offline, not scraped at request time. Match on asset class, then area, then benchmark family; use volatility only as tie-breaker. Products whose exposure cannot be resolved show no alternatives.
