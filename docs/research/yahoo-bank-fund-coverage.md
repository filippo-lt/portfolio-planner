# Yahoo coverage of funds sold by Italian bank networks

Ticket: filippo-lt/portfolio-planner#11. Run date: 2026-10-25.

## Verdict

Free sources are enough for a basic report on Italian-domiciled and Irish (Mediolanum) funds. They are not enough for the cross-border funds (LU/FR) that Fideuram, Intesa Private, UniCredit and similar networks push, unless the resolver is fixed.

- Resolution is not the problem: all 17 real ISINs resolved. The data behind the chosen symbol is.
- Italian/Irish funds (11): 8 have 5+ years of history, none has 10 (best 8.8). 9 have holdings, 10 have an asset class from data. TER is present for 3.
- Cross-border funds (6): the app picks a Frankfurt/Munich/Stuttgart listing with 0 to 1 price points. No TER, no holdings, asset class mostly unknown. A better listing exists for some (BlackRock Global Allocation has a Luxembourg USD line with about 4.6 years), so part of this is a resolver bug, not a source gap.
- TER is the gap that matters most: present for 4 of 17 funds (3 of 4 controls). A cost picture needs another source (KID/PRIIPs) or manual entry.
- 10-year history is out of reach for most funds. The best fund series is 8.8 years.

## Method

1. Fund list: ISINs come from exchange and asset-manager pages where a search found them (see Sources). Assogestioni publishes flows by category, not by fund, so a ranked "most-sold" list from a primary source was not found. The list is a representative sample of bank-network funds, not a verified top 20. Cross-border ISINs (rows 12-17) are from memory; the names Yahoo returned matched them.
2. Three further guessed ISINs (JPM Global Income, PIMCO GIS Income, a Fidelity fund) are excluded. JPM and PIMCO did not resolve, and the Fidelity one resolved to an unrelated fund (Asia Focus). They are most likely wrong ISINs, not data gaps.
3. Each ISIN went through the app's own `YahooProvider` (`src/lib/data/yahoo.ts`): `resolve()` (Yahoo search plus OpenFIGI fallback, first candidate taken), `getProfile()`, and `getHistory()` for 5 and 10 years. History years = today minus the first returned date. No OpenFIGI key was set.
4. For the failures, every candidate symbol was tried to see whether a better listing exists.

## Results

"Hist" is years available when 5 / 10 years were requested. A dash in TER means absent.

| # | ISIN | Fund | Network | Yahoo symbol | Hist 5y / 10y | TER | Holdings | Asset class |
|---|------|------|---------|--------------|---------------|-----|----------|-------------|
| 1 | IT0005241697 | Eurizon Progetto Italia 70 PIR | Intesa/Eurizon | 0P00019VE0.F | 5.0 / 7.8 | - | 10 | mixed |
| 2 | LU0230568445 | Eurizon Fund Absolute Prudent R | Intesa/Eurizon | 0P00001W5W.F | 4.6 / 4.6 | 1.13% | 1 | bond |
| 3 | LU2643223329 | Eurizon Fund Absolute Prudent CD | Intesa/Eurizon | 0P0001RVRF.F | 2.9 / 2.9 | 0.62% | 1 | bond |
| 4 | IT0005241085 | Arca Economia Reale Bilanciato Italia 30 P | Arca | 0P00019Q0J.F | 5.0 / 7.8 | - | 7 | mixed |
| 5 | IT0005186041 | Anima Iniziativa Italia A | BPM/Anima | 0P00018BC9.F | 5.0 / 7.8 | - | 10 | equity |
| 6 | IE0004905604 | Mediolanum Challenge Italian Equity LA | Mediolanum | 0P00000BVC.F | 5.0 / 8.8 | - | 10 | equity |
| 7 | IE00B13C3B10 | Mediolanum Challenge Solidity & Return S A | Mediolanum | 0P0000JQVE.F | 5.0 / 8.8 | - | 3 | bond (reported 111%) |
| 8 | IE00B608CJ84 | Mediolanum Challenge International Income L B | Mediolanum | 0P0000RTIS.F | 5.0 / 8.8 | - | 0 | bond (reported 109%) |
| 9 | IT0004331820 | BancoPosta Azionario Euro | Poste | 0P0000GCAA.F | 5.0 / 7.8 | 1.66% | 9 | equity |
| 10 | IT0005199606 | BancoPosta Mix (ISIN unconfirmed, sources conflict) | Poste | 0P00018C2F.F | 5.0 / 7.8 | - | 0 | unknown |
| 11 | LU1883840305 | Amundi Funds Pioneer Income Opportunities I2 USD | Amundi/UniCredit | 0P0001DIJG | 4.6 / 4.6 | 0.77% | 9 | mixed |
| 12 | LU0323578657 | Flossbach von Storch Multiple Opportunities R | cross-border | S6TB.F | 0 / 0 | - | 0 | unknown |
| 13 | FR0010135103 | Carmignac Patrimoine A EUR Acc | cross-border | Y9U6.F | 0 / 0 | - | 0 | unknown |
| 14 | LU0336084032 | Carmignac Portfolio Flexible Bond A EUR Acc | cross-border | C5Q7.MU | 0 / 0 | - | 0 | bond (from name only) |
| 15 | LU0119620416 | Morgan Stanley Global Brands | cross-border | MSJD.F | 0 / 0 | - | 0 | unknown |
| 16 | LU0072462426 | BlackRock Global Allocation | cross-border | MI9D.F (alt: LU0072462426-USD.LU) | 0 / 0 (alt: 4.6) | - | 0 | mixed (from name only) |
| 17 | LU1279334210 | Pictet Robotics | cross-border | LU1279334210.SG | 0 / 0 | - | 0 | unknown |
| C1 | IE00B4L5Y983 | iShares Core MSCI World | control | IWDA.AS | 5.0 / 10.0 | 0.20% | 10 | equity |
| C2 | IE00BK5BQT80 | Vanguard FTSE All-World Acc | control | IE00BK5BQT80.SG (alt: VWCE.DE) | 0 / 0 (alt: 7.2, share class launched 2019) | - | 0 | equity (from name only) |
| C3 | IE00B5BMR087 | iShares Core S&P 500 | control | CSSPX.MI | 5.0 / 10.0 | 0.07% | 10 | equity |
| C4 | IE00B3F81R35 | iShares Core EUR Corp Bond | control | IEAC.L | 5.0 / 10.0 | 0.20% | 0 | bond |

Counts over the 17 funds: resolves 17/17; 5-year history 8/17 (all Italian/Irish; rows 2, 3 and 11 are shorter); 10-year history 0/17 (best 8.8 years); TER 4/17; holdings 9/17; asset class from data 10/17 (2 more from the name only).

## Findings that matter

- **The resolver picks the wrong listing.** For cross-border funds and the Vanguard control, `resolve()` returns a Frankfurt/Munich/Stuttgart ticker first (EUR is the only sort key). Trying all candidates finds usable history for BlackRock (Luxembourg line) and Vanguard (VWCE.DE). Ranking candidates by history length would fix part of this at no data cost. It would not help Flossbach, Carmignac, Morgan Stanley or Pictet, where no candidate had more than 1 point.
- **Mediolanum bond weights above 100%** (111%, 109%) are what Yahoo returns for the bond position. The asset-class text "Obbligazioni al 111%" would look wrong in a report; cause not investigated.
- **Yahoo's `0P...` fund series are short**: 2.9 to 8.8 years here, so a 10-year view is not available for these funds.
- **Holdings** are a top-10 list at best, and 0 or 1 for flexible and absolute-return funds.
- **TER** is mostly absent for funds. Entry, exit and performance fees are not in Yahoo at all.
- Yahoo prints a schema-validation message for some fund profiles; `validateResult: false` keeps it from failing.

## Gaps that matter for this effort

1. TER and other costs for funds (needs KID/PRIIPs data or manual entry).
2. 10-year price history (needs another source, or show the available span and say so).
3. Listing choice for cross-border funds (code fix).
4. Holdings and asset class for flexible and absolute-return funds (the category/name fallback already exists).

## Sources

- Borsa Italiana fund pages (Eurizon Progetto Italia 70 PIR IT0005241697; Arca Economia Reale Bilanciato Italia 30 P IT0005241085): https://www.borsaitaliana.it/borsa/fondi/dettaglio/1FADB392827.html and https://www.borsaitaliana.it/borsa/fondi/dettaglio/1FADB392830.html
- Anima SGR product page for Iniziativa Italia: https://www.animasgr.it/en/products/Scheda/Anima-Iniziativa-Italia-Classe-A (class A ISIN IT0005186041 came from a distributor page, not the manager's own page)
- Poste BancoPosta Fondi KID for Azionario Euro (IT0004331820): https://www.media.poste.it/12ba2293-592b-48a3-91d3-ed60f86f0982/file/azionario_euro_kid . BancoPosta Mix ISIN IT0005199606 appears on Poste factsheets that conflict about which fund it belongs to.
- Amundi KID for LU1883840305: https://www.amundi.com/globaldistributor/dl/doc/kiid/LU1883840305/SPA/ESP
- Eurizon Fund Absolute Prudent ISINs: finanzen.ch and finanzen.net fund pages (secondary).
- Mediolanum Challenge ISINs (IE0004905604 via Borsa Italiana; IE00B13C3B10 and IE00B608CJ84 via finanzen.ch/finanzen.at, secondary).
- Assogestioni monthly data is published by category, not by fund: https://www.assogestioni.it
- Data under test: `yahoo-finance2` and OpenFIGI via `src/lib/data/yahoo.ts`.
