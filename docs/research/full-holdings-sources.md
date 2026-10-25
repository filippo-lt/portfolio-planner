# Free sources of full holdings

Research for issue #14. Question: which free, primary sources give a product's full holdings list, and can we fetch them server-side?

Probes were run on 2026-10-25 with plain `curl` and a generic bot User-Agent, no cookies, no JS. "Reliable" below means "worked in that probe"; none of these are contractual APIs.

## Summary

- Only two issuer families gave a plain, scriptable file in the probe: **iShares** (`latest-holdings.csv`, ~1,270 lines for MSCI World) and **State Street SPDR** (`holdings-daily-*.xlsx`, US and EMEA).
- **Xtrackers** is a JS single-page app behind an entry gate. **Amundi** and **Vanguard** show a table but the download endpoint was not found without a browser. **Invesco US** returned HTTP 406 to curl.
- Irish UCITS ETFs may now publish full holdings only quarterly (Central Bank of Ireland, April 2025), so "daily full holdings" cannot be assumed for UCITS.
- US-domiciled funds and ETFs: SEC N-PORT bulk data is a clean, free, primary source (quarterly, public domain).
- Funds sold by Italian banks (mostly Luxembourg/Irish UCITS or Italian funds): the free primary route is the semi-annual and annual report PDF. It is hard to parse and months stale. No structured source exists.
- Issuer site terms generally forbid redistribution. Treat issuer files as "display derived analytics, link to source", not "republish the list".

## Per-source table

| Source | Coverage | Format | URL pattern (verified unless noted) | Update | Server-side fetch (probe result) | Terms / robots |
|---|---|---|---|---|---|---|
| iShares (BlackRock) | All iShares funds, UK/IE/IT sites. Full equity list, plus cash, futures | CSV, UTF-8, a metadata preamble then a header row | `https://www.ishares.com/uk/individual/en/products/{portfolioId}/{slug}/latest-holdings.csv`, found in the product page HTML. Example: `/uk/individual/en/products/251882/ishares-core-msci-world-ucits-etf/latest-holdings.csv` | Daily (page showed as-of 22 Oct 2026) | HTTP 200, `text/plain`, 195 KB, 1,275 lines. The older `.ajax?fileType=csv&fileName=...` link I tried returned the HTML page, so it is not a stable pattern. Needs the numeric ID and slug from the product page. | robots.txt: `*` disallows only `/search/`, sign-on, `*.dl`, `?truepdf`. `Brightbot 1.0` is fully disallowed. Site terms page not retrievable in the probe (404 at the URL I guessed): read before launch. |
| State Street SPDR, US | All US SPDR ETFs | XLSX, header block then table (Name, Ticker, Identifier, SEDOL, Weight, Sector, Shares, Location) | `https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-{ticker}.xlsx`. Example `...-spy.xlsx` | Daily (22 Oct 2026) | HTTP 200, 54 KB, ~600 rows | robots.txt does not disallow `/library-content/`. The file's own disclaimer: no part may be "reproduced, copied or transmitted ... to third parties without SSGA's express written consent". |
| State Street SPDR, EMEA UCITS | SPDR UCITS ETFs | XLSX, columns ISIN, SEDOL, Security Name, Currency, Shares, Percent of Fund, Country, Sector, Industry, Market Value | `https://www.ssga.com/library-content/products/fund-data/etfs/emea/holdings-daily-emea-en-{ticker}-{exch}.xlsx`. Example `...-spyw-gy.xlsx` (Euro Dividend Aristocrats, 51 rows) | Daily | HTTP 200, 13 KB | Same as above |
| Vanguard UK/EU | Vanguard UCITS ETFs and funds | Product page shows top 10 plus a "Download" button, whose URL I could not read from the HTML. Factsheet, prospectus and reports at `fund-docs.vanguard.com` | Page: `https://www.vanguard.co.uk/uk-fund-directory/product/etf/equity/{id}/{slug}`. PDF: `https://fund-docs.vanguard.com/{name}.pdf` (factsheet fetched OK, 328 KB) | Page: monthly or quarterly snapshots (30 Sep 2026 seen) | Page not scraped. PDFs 200. | robots.txt (investor.vanguard.com, US): disallows only images, static and 404 paths. T&Cs text not read. |
| Vanguard US | Vanguard US ETFs and funds | HTML profile page, JS-rendered holdings | `https://investor.vanguard.com/investment-products/etfs/profile/{ticker}` | | Page 200 (220 KB) but holdings not in static HTML. Use N-PORT instead. | |
| Xtrackers (DWS) | All Xtrackers ETFs | JS app (Nuxt) with `ENTRY_GATE_ENABLED` and audience selection. API base `https://etf.dws.com/api/`, undocumented | Page: `https://etf.dws.com/en-gb/{ISIN}-{slug}/`. The `en-ie` locale returned 404 for the same ISIN. | Daily (claimed, unverified) | HTTP 200 but only an empty app shell (2.5 KB). No holdings without running JS and passing the gate. | robots.txt disallows `/etfdata/*` and `/export/*`, which are the likely data endpoints. Do not use. Annual and semi-annual report PDFs exist at `etf.dws.com/{locale}/AssetDownload/Index/{guid}/...pdf`. |
| Amundi ETF | All Amundi ETFs | HTML; no holdings file link found in the static HTML | Page: `https://www.amundietf.it/it/professionali/products/equity/{slug}/{isin}`, from sitemap. The retail-style URL I guessed returned 404. | | Page 200 (328 KB) but no holdings or download URL found. Sitemap is 21 MB. | robots.txt (amundietf.it) disallows only query-string search pages. Holdings likely load via an internal API not documented. |
| Invesco | Invesco US ETFs | CSV from a download action | `https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&action=download&ticker=QQQ` (unverified as a stable pattern) | Daily | HTTP 406 to curl, empty body. Blocks non-browser clients. | robots.txt disallows `*.zip`, `asOfDate=` parameters, others. |
| SEC N-PORT bulk data | All US-registered mutual funds and ETFs except money market funds. Full holdings per series | Quarterly ZIP of TSV tables | `https://www.sec.gov/files/dera/data/form-n-port-data-sets/{YYYY}q{N}_nport.zip` | Quarterly | HTTP 200 for `2026q2_nport.zip`, 441 MB (downloaded only to confirm access, then deleted). Needs batch ingestion, not request-time use. | SEC page has no license text, only an accuracy disclaimer. US government data. EDGAR also asks for a declared User-Agent and a request-rate cap (not re-verified here). |
| Fund reports (semi-annual, annual) | Every UCITS and Italian fund, including bank-sold ones | PDF, schedule of investments | Issuer sites, e.g. Vanguard `fund-docs.vanguard.com`, Xtrackers `AssetDownload/Index/...`; Italian management companies' sites; KIID/KID does not list holdings | Twice a year, published weeks to months after period end | PDFs fetch fine, but parsing tables is fragile and umbrella reports mix many sub-funds in one file | Public regulatory documents. Linking is safe. |

## Regulatory context

- No EU rule forces daily full holdings for every UCITS. The Central Bank of Ireland (Q&A 1012, April 2025) now lets Irish UCITS ETFs use "periodic" disclosure: full holdings published as at each calendar quarter end, within 30 business days, provided daily information for authorised participants and a procedure for investors to request portfolio information. Irish ETFs (many iShares, Xtrackers, SPDR, Vanguard, Amundi products) can therefore move to a quarterly cadence without notice. Source: [A&L Goodbody summary](https://www.algoodbody.com/insights-publications/cbi-updates-its-position-in-relation-to-portfolio-transparency-for-ucits-etf).
- Italian fund annual reports (rendiconto) must list the securities held and the liquid share. Source: [Borsa Italiana, Il Rendiconto Annuale dei Fondi](https://www.borsaitaliana.it/notizie/sotto-la-lente/rendiconto-fondi.htm). The page covers the annual report only; I did not confirm the semi-annual rules.

## Italian bank-sold funds without a public holdings file

Typical cases: Luxembourg or Irish SICAVs from Amundi, Eurizon, Fideuram, Mediolanum, Anima, Generali, or third-party funds (Fidelity, JPM, Carmignac) sold through bank platforms.

1. **Manager's own site**: the manager (not the bank) publishes factsheet, monthly report, and sometimes a holdings or "composition" download. Check by ISIN. Many give top 10 only.
2. **Semi-annual and annual report PDF**: the only guaranteed full list. Fully free, but two parsing problems: umbrella reports cover every sub-fund, and layouts differ by manager. Not suitable for automated parsing at launch.
3. **Aggregated breakdown instead of list**: factsheets almost always carry asset class, sector, region, top 10 and a holdings count. This matches the decided composition model (breakdown plus top holdings), so the full list is not needed for the bank-fund case.
4. **Italian insurance and pension products** (fondi interni, unit-linked) publish rendiconti by asset category, not security. Show category breakdown only.
5. **Say so in the UI**: label such products "full holdings not publicly available", show the as-of date of the top-holdings data, and link to the manager's report.

## Recommendation

1. Keep Yahoo (breakdown plus top holdings) as the base for every product. This covers all cases, including bank funds.
2. Add a "full holdings" deeper layer only for **iShares** and **SPDR** (US and EMEA). Both give daily CSV/XLSX with stable URLs that worked unauthenticated. For US-domiciled funds, add **SEC N-PORT** as a batch-ingested source (quarterly, public domain).
3. Resolve the iShares URL by reading the product page once and caching the link (portfolioId + slug), not by hardcoding. Cache the parsed result server-side with a daily TTL and store the as-of date. Never call issuers from the browser.
4. Do not build scrapers for Xtrackers (disallowed `/etfdata/` and `/export/`, gated SPA), Amundi, Vanguard UK or Invesco until a stable endpoint is verified. For these, link to the issuer page and the latest report PDF.
5. Terms risk: the SPDR file states no copying or transmission to third parties without consent, and issuer terms generally restrict reuse. Use the data to compute derived analytics (exposure, concentration, overlap) and show a limited list with source attribution and a link, rather than republishing whole files. Have the terms of each issuer read before launch; I could not retrieve iShares' terms page.
6. Expect holdings to be quarterly for some Irish UCITS ETFs. Always display the as-of date and degrade gracefully to top holdings when a file is missing or old.

## Limits of this research

- One fund per issuer was probed once, from one IP, so rate limits, bot challenges and regional behaviour were not tested.
- Vanguard UK and Amundi download endpoints were not found in static HTML; they may exist behind browser-only calls.
- Issuer terms-of-use texts were not fully read (iShares terms URL 404, Vanguard and Invesco not fetched).
- Xtrackers daily-file claim is unverified.

## Sources

- iShares product page and CSV: https://www.ishares.com/uk/individual/en/products/251882/ishares-core-msci-world-ucits-etf/latest-holdings.csv ; robots https://www.ishares.com/robots.txt
- SPDR files: https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx ; https://www.ssga.com/library-content/products/fund-data/etfs/emea/holdings-daily-emea-en-spyw-gy.xlsx ; robots https://www.ssga.com/robots.txt
- Xtrackers: https://etf.dws.com/en-gb/IE00BJ0KDQ92-msci-world-ucits-etf-1c/ ; robots https://etf.dws.com/robots.txt
- Amundi: https://www.amundietf.it/sitemap/sitemap.xml ; robots https://www.amundietf.it/robots.txt
- Vanguard UK: https://www.vanguard.co.uk/uk-fund-directory/product/etf/equity/9679/ftse-all-world-ucits ; robots https://investor.vanguard.com/robots.txt
- Invesco robots: https://www.invesco.com/robots.txt
- SEC N-PORT data sets: https://www.sec.gov/data-research/sec-markets-data/form-n-port-data-sets
- Central Bank of Ireland position (via law firm): https://www.algoodbody.com/insights-publications/cbi-updates-its-position-in-relation-to-portfolio-transparency-for-ucits-etf
- Borsa Italiana, rendiconto: https://www.borsaitaliana.it/notizie/sotto-la-lente/rendiconto-fondi.htm
