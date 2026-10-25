# Where an Italian investor's fund and ETF costs live, and how to collect them

Research for issue #12. Retrieved 2026-10-25. Free, primary sources only.

## Short answer

- Costs split into two families. **Product costs** (entry/exit, ongoing, transaction, performance) sit in the fund's KID, one PDF per ISIN, with a fixed layout set by EU regulation. **Intermediary costs** (custody, trading commission, stamp-duty recovery) sit in each bank's *foglio informativo* PDF, with a different layout per bank.
- Neither family is published as structured data. Both are PDFs. The KID layout is fixed, so one parser covers every fund. Bank sheets have to be read by hand into a dataset.
- A curated dataset is feasible: roughly 100 to 150 instruments from KIDs, plus about 8 intermediaries by hand. Estimated effort: 3 to 5 days to build, then about half a day per quarter.
- Custody fees are the biggest surprise. At some banks they dwarf the fund's TER on a small portfolio (see the worked example).
- Retrocessions (the share of the fund fee the bank keeps) are not published per product. They only appear in the investor's personal MiFID cost report. We cannot curate them.

## 1. Cost inventory

"Machine-readable" means usable without a person reading the document. Items marked "not verified" come from general knowledge or secondary summaries and were not re-read in a primary source in this session.

| Cost | Applies to | Published where | Format | Changes how often | Machine-readable? |
|---|---|---|---|---|---|
| Entry cost (commissione di sottoscrizione / ingresso) | Mutual funds, some ETF-like products. Not ETFs bought on exchange. | KID cost table "one-off costs"; prospectus; for bank-sold funds also the bank's placement terms | PDF, fixed table | With each KID revision | Per ISIN: yes, via KID parsing |
| Exit cost | Funds | Same KID table | PDF | Same | Same |
| Ongoing charges / TER (management and other running costs) | Funds, ETFs | KID "recurring costs" ("costi correnti"); also issuer fact sheets and Borsa Italiana pages | PDF, fixed table | KID reviewed periodically (RTS rule of at least yearly: not verified) | Per ISIN: yes |
| Portfolio transaction costs (fund's own trading costs) | Funds, ETFs | KID "recurring costs", separate line | PDF | Same | Per ISIN: yes |
| Performance fee | Mostly active funds | KID "incidental costs" line (% of return above a hurdle) | PDF | Same | Per ISIN: yes |
| Placement / distribution fee, retrocession | Bank-sold funds | Inside the TER and entry fee. The split is never shown per product. Disclosed in aggregate in the client's personal MiFID ex-ante and ex-post cost reports | Personal PDF or portal page | Per client, at least yearly | No. Not public. |
| Custody / dossier titoli fee (diritti di custodia, commissione di gestione e amministrazione) | Anything held in a bank deposito titoli | Bank's *foglio informativo* "Deposito titoli a custodia e amministrazione" | PDF, bank-specific tables | Several revisions a year (see section 3) | No. Needs manual capture. |
| Trading commission (commissione di negoziazione) | ETFs and shares; bank-sold funds use the subscription fee instead | Same bank *foglio informativo*, or the broker's price page | PDF or web page | Several revisions a year; promos change monthly | No. Manual. |
| Execution / fixed order costs (costi di esecuzione) | ETFs, shares | Same sheet | PDF | Same | No. Manual. |
| Imposta di bollo, 0.2% a year on the deposit value | All financial products held in a deposit, funds and ETFs alike | Law (Tariffa, DPR 642/1972, art. 13 c. 2-ter); banks only say "nella misura prevista per legge" | Law text | Rarely | Yes, it is one constant. Charged by the bank at statement frequency. |
| Account / canone costs | Linked current account or monthly fee | Bank *foglio informativo* | PDF | Several a year | No. Manual. |
| Statement and document fees | Paper statements, confirmations | Same sheet | PDF | Same | No. Small amounts. |
| FX cost (currency conversion) | Foreign-currency ETFs and securities | Same sheet: "commissioni valutarie" and "Out-Euro" lines | PDF | Same | No. Manual. |
| Bid-ask spread (implicit) | ETFs on exchange | Live market data | Market feed | Continuous | Not free to collect. Out of scope. |
| Taxes (26%, 12.5% on government bonds) | Gains and income | Law. Already in `src/lib/tax/it.ts` | n/a | Rarely | Yes |

### Regulatory basis

- **PRIIPs.** The KID cost tables are set by Commission Delegated Regulation (EU) 2017/653 (the PRIIPs RTS), as amended by Delegated Regulation (EU) 2021/2268. The costs section separates one-off costs (entry and exit), recurring costs (portfolio transaction costs, other recurring costs) and incidental costs (performance fees). UCITS funds and ETFs moved from the old KIID to the PRIIPs KID with the revised RTS, for products sold from January 2023 (FinDatEx notes on its European PRIIPs Template v2.0). Sources: [EUR-Lex 2017/653](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0653), [Delegated Regulation 2021/2268](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32021R2268), [FinDatEx EPT v2.0 news](https://findatex.eu/news/59/findatex-publishes-ept-v2). Note: EUR-Lex blocked direct download in this session, so the article-level detail above was confirmed through search extracts of the regulation, not by reading the full text.
- **MiFID II.** Article 24(4) of Directive 2014/65/EU and Article 50 of Delegated Regulation (EU) 2017/565 require ex-ante disclosure of all costs and charges, ex-post information at least once a year for ongoing client relationships, and an illustration of the cumulative effect of costs on return. Source: [Delegated Regulation 2017/565](https://eur-lex.europa.eu/eli/reg_del/2017/565/oj/eng); ESMA reading in [ESMA Q&A 1843](https://www.esma.europa.eu/publications-data/questions-answers/1843). These reports are personalised, so they are not a public data source.
- **Transparency of banking services.** Bank *fogli informativi* exist under Banca d'Italia's transparency rules (artt. 115 ff. TUB). Each sheet cites this basis in its header, for example UniCredit DT01 below.
- **Stamp duty.** 0.2% a year on the deposit's financial products. Agenzia delle Entrate states the rate and the EUR 14,000 annual cap for holders who are not natural persons ([Risoluzione 84/E 2014](https://www.agenziaentrate.gov.it/portale/documents/20143/303732/Risoluzione+84E+del+16+settembre+2014_RIS+84e+del+16+09+14.pdf/e2373152-d447-28cc-86e7-2a809e677fc7)). The search extracts found no product-specific minimum for individuals, only the general EUR 1 minimum of art. 3 c. 3 DPR 642/1972. Check the current text of the Tariffa before coding edge cases.

## 2. What banks actually charge (primary sources)

All figures are taken from the bank's own PDF, read on 2026-10-25. "Per semester" fees are charged twice a year, so double them for a yearly cost.

### Custody (dossier titoli)

| Bank | Source document | Figure for ETF/fund holdings |
|---|---|---|
| Intesa Sanpaolo | [Foglio informativo n. 004/068](https://www.intesasanpaolo.com/content/dam/vetrina/trasparenza/it/Documenti/Doc/Pdf/FI/FI-Other/FI-1004.pdf), "Aggiornato al 01.10.2026" | Per semester: EUR 0.00 for deposits holding only Intesa Group funds; EUR 2.58 group securities; EUR 10 BOT/Italian govt bonds; **EUR 50 other Italian securities; EUR 80 foreign securities**. Highest category present applies. Linked to an XME Conto: EUR 1.50 a month; XME Silver/Gold/Platinum: EUR 0. |
| UniCredit | [Foglio informativo DT01, aggiornamento n. 060](https://trasparenza.unicredit.it/pdfprod/DT01_CONTO+TITOLIServizio+di+custodia+ed+amministrazione+di+titoli+e+strumenti+finanziari.pdf), "ultimo aggiornamento 01.10.2026" | Per semester: EUR 10 govt bonds; **EUR 63 other Italian instruments; EUR 80 foreign** (annual equivalent EUR 126 and EUR 160). Promo: all these fixed fees waived until 31 Dec 2028 for new contracts signed through the protected multichannel flow with "Filiale buddy"; the sheet says the promo does not apply to the Wealth contract. |
| Banco BPM | [Webank (Banco BPM) sheet, "Aggiornato al 19/06/2026"](https://www.bancobpm.it/DWN/trasparenza/Documenti/64384.pdf) | Custody rights (diritti di custodia) **EUR 0.00 and 0.0000% in every category**, charged semi-annually in principle. Online-only product. The branch product sheet was not retrieved. |
| MPS | [Foglio informativo "Deposito titoli a custodia e amministrazione", "Aggiornato al 21 novembre 2022"](http://www.gruppo.mps.it/ap_trasparenzaweb/Documenti/103048599.pdf) | Per semester: centralised securities EUR 0 fixed, 0%, max EUR 50. Foreign: **EUR 50 + 0.025% of value, capped at EUR 80**. Optional segregated sub-deposit EUR 1,200 per semester. **This is the newest MPS sheet the search surfaced, dated 2022. It may be superseded. Treat as unverified.** |
| BPER | [Foglio informativo, "Aggiornamento 27/07/2026"](https://www.bper.it/nuovatrasparenza/PartePrima/99057963.pdf) | Per semester, tiered by value of "other securities": up to EUR 3,000 **EUR 32**; to 30,000 **EUR 62**; to 110,000 EUR 87; above EUR 162. EUR 10 for govt bonds only. Group-placed funds and BPER Sicav are excluded from the count. Detail on whether ETFs count as "altri titoli" is not stated; assume yes. |
| Poste Italiane | [FI_DT n. 16, "Decorrenza dal 26 gennaio 2026"](https://www.media.poste.it/bancoposta/pdf/trasparenza/FI_DT.pdf) | Per semester: EUR 10 govt bonds only; **EUR 15 any other securities** (EUR 20.66 if settled on a postal savings book); free if the deposit is empty all semester. |
| Fineco | [Deposito titoli sheet FIADV_DepTitoli, vers. 1/2019](https://images.fineco.it/extranet/pvt/pdf/advice/contratti/Allegato_foglio_informativo.pdf) | "Diritti di custodia: nessuno". This is an old version (2019). The current sheet was not reachable; secondary sources (justETF, QualeBanca) also say EUR 0. |
| Directa | [Allegato economico](https://www.directa.it/api/media/file/allegato-economico-costi-commissioni.pdf), conditions "in vigore al 1 febbraio 2025" | The retrieved annex lists trading commissions only. No custody fee for the ordinary account was found in primary documents. Secondary sources say free. The PIR account has its own fee (a quarterly 0.05% with a EUR 15 minimum, from a Directa web page, search extract). |

### Trading commissions on an ETF (online channel unless noted)

| Bank | Figure | Source |
|---|---|---|
| Intesa Sanpaolo | Remote channel: 2.4 per mille, min EUR 3.50 on Italian venues; min EUR 11 on foreign venues. Branch: 6 per mille, min EUR 8.50. Order cancelled: EUR 6.16 in branch. | Sheet 004/068 above |
| UniCredit | Internet: 0.40%, min EUR 11.50 (Italian market), 0.90%, min EUR 28.50 (foreign). Branch: 1.25%, min EUR 22.50. Extra "spese su negoziazione" EUR 4.75 on internet. Promo for new "Filiale buddy" contracts: 0.10%, min EUR 2.00, service fees zero, until 31 Jul 2027. | DT01 above |
| Banco BPM (Webank) | Two profiles. Variable: 0.19% (min EUR 2.75, max EUR 18.90) falling to flat EUR 2.75 above EUR 2,000. The band depends on the previous month's commissions. Fixed profile: EUR 12 down to EUR 2.75. Note this table is for Italian shares, bonds, certificates and ETP; the ETF line is not separately labelled in the sheet. | Webank sheet above |
| MPS, BPER, Poste | **Not extracted.** The MPS 2022 sheet and the BPER sheet carry commission tables in layouts I did not parse; Poste publishes trading terms in a separate document. | n/a |
| Fineco | Fineco Trading account: 0.19% of value, min EUR 2.95, max EUR 19. One/Classic/Max accounts: flat EUR 19, 9.95, 6.95 or 2.95 per order depending on the month's commission band. Under-30s EUR 2.95. Zero commission on purchase for ETFs on a promo list (about 700 ETFs per justETF, not primary), refreshed monthly. | [it.finecobank.com/trading/commissioni](https://it.finecobank.com/trading/commissioni/) |
| Directa | Italian ETFs: Simple EUR 5 per order; Dynamic EUR 8 scaling to EUR 1.50 by orders per day; Variable 1.9 per mille, min EUR 1.50, max EUR 18. Xetra: 0.025%, min EUR 9.50. | Directa annex above |

### Stamp duty

Every sheet says the bank recovers the tax "nella misura prevista per legge" and charges it at statement frequency (Intesa, UniCredit, Banco BPM, BPER, Poste, Fineco). The rate is the same everywhere: 0.2% a year.

## 3. Worked example: EUR 10,000 in one ETF (illustrative, from the sheets above)

Assumptions: one individual, ETF held for a year, one purchase of EUR 5,000 online (the second EUR 5,000 not modelled), ETF counted as "other Italian security" where a sheet distinguishes. TER is excluded because it varies by fund (typically 0.07% to 0.40% for broad ETFs: general knowledge, not sourced).

| Cost | Intesa | UniCredit (standard) | BPER | Poste | Webank / Fineco / Directa |
|---|---|---|---|---|---|
| Bollo 0.2% | EUR 20 | EUR 20 | EUR 20 | EUR 20 | EUR 20 |
| Custody, per year | EUR 100 | EUR 126 | EUR 124 (two semesters at EUR 62) | EUR 30 | EUR 0 |
| One EUR 5,000 buy | EUR 12.00 (plus execution costs) | EUR 20.00 | not extracted | not extracted | Fineco EUR 9.50; Directa EUR 5 or free promo ETF; Webank EUR 2.75 |

Reading: on a EUR 10,000 position, custody alone is 1.0% to 1.3% a year at the three banks that charge it as a flat fee, several times a cheap ETF's TER. This is why the report needs intermediary costs, not just TER. A larger portfolio dilutes it: the same EUR 126 is 0.13% on EUR 100,000.

## 4. Why it is hard to collect

- **No structured source.** Everything is a PDF or web page. Machine-readable bank data does not exist for retail price sheets (not verified beyond the banks checked).
- **Layouts differ per bank.** Fee models seen: flat per semester by category (Intesa, UniCredit, Poste), tiered by portfolio value (BPER), percentage with min/max (MPS), monthly canone tied to the current account (Intesa XME), zero (Webank, Fineco).
- **Classification ambiguity.** The sheets rank holdings as "titoli di Stato", "altri titoli Italia", "titoli esteri". They do not say where an Irish-domiciled ETF listed in Milan falls. The dataset must record the assumption per bank.
- **"Highest category wins".** Intesa, UniCredit, BPER and Poste apply only the costliest category present in the semester, so costs are not additive per instrument. The simulation must treat custody as a per-deposit cost, not per-ETF.
- **Conditions are maxima.** Sheets say standard conditions allow derogations. Real clients often pay less (or get promos).
- **Promotions.** UniCredit zeroes custody until end of 2028 for some new accounts and halves trading costs until 2027. Fineco refreshes its zero-commission ETF list monthly. A static dataset cannot capture a client's actual promo, so it should show standard terms with a promo note.
- **Unstable URLs and old documents.** Several Banco BPM document IDs from search results returned 404 (the older 61850, 62644, 63130 and 63228 files); the current ID was 64384 when checked. MPS's surfaced sheet is four years old. Poste moved its PDF with a 301 redirect. Some sites block automated downloads (UniCredit returned 403 to the fetch tool, but a plain `curl` with a browser user agent worked).
- **Frequent revisions.** Intesa's sheet moved from 004/067 to 004/068; UniCredit is at update 060; BPER published sheets dated 31/03, 27/07, 17/09 and 09/10/2026 (different products). Expect a changed sheet at least quarterly.

## 5. Proposal: a curated, dated dataset

Two tables, kept apart because they refresh differently.

### A. Instrument costs (per ISIN)

- **What:** entry %, exit %, ongoing charges %, transaction costs %, performance fee text/%, "euro per 10,000 over 1 year" if the KID gives it, KID date, holding period, source URL, retrieved date.
- **From:** the fund's current KID PDF on the issuer's site (iShares, Amundi, Xtrackers, Vanguard, Invesco and similar) or the Borsa Italiana instrument page.
- **How:** the KID follows the PRIIPs layout, so text extraction (`pdftotext`) plus a few regexes on the cost headings covers every fund. Hand-check a sample.
- **Scope:** the roughly 100 to 150 ETFs Italian retail investors actually buy, plus a short list of bank-sold funds. Do not try to cover the whole universe.
- **Refresh:** yearly, or when the KID date changes. Store the KID date and flag entries older than 14 months.
- **Effort:** about 2 days (parser, run, spot checks).
- **Caveat:** entry fees on bank-sold funds are ceilings. The bank may discount them, and the actual retrocession is unknown. State "up to".

### B. Intermediary costs (per bank, per product)

- **What:** for each bank, custody fee model (type, tiers, per-semester amounts, which asset categories count), ETF trading commission (percentage, min, max, channel), bollo handling, document date ("aggiornato al"), sheet number, URL, retrieved date, PDF hash, and a promo note.
- **From:** the banks' trasparenza pages. Start with the eight above plus 3 to 5 more (Mediolanum, Banca Sella, ING, Trade Republic, Scalable) if the report should cover online options.
- **How:** read by hand into a typed file in the repo (YAML or TS). About 1 hour per bank initially. A small script that downloads each PDF, stores its hash and flags changes is worthwhile; the figures stay manual.
- **Refresh:** quarterly check by hash; re-enter only changed sheets. About 2 hours per quarter.
- **Effort:** about 1.5 to 2 days initial.
- **Honesty rule:** every record carries its `valid_from` / `retrieved` date and a link. The UI should say "standard published terms, may differ for your account" and keep the existing user override (`UserFees` in `src/lib/fees.ts`) as the escape hatch.

### C. Rules (constants)

- Bollo 0.2% a year, tax rates 26% and 12.5% (already in `src/lib/tax/it.ts`). Add a `BOLLO_RATE` constant and a note on the cap for non-natural persons.

### Suggested record shape

```ts
type CustodyFee =
  | { kind: 'flat_by_category'; perSemester: Record<'govt' | 'otherIt' | 'foreign', number> }
  | { kind: 'tiered_by_value'; perSemester: { upTo: number | null; fee: number }[]; govtOnly: number }
  | { kind: 'pct_with_cap'; fixed: number; pct: number; max: number }
  | { kind: 'monthly_canone'; perMonth: number }
  | { kind: 'none' };

interface BrokerCosts {
  id: string;            // 'intesa', 'unicredit', ...
  custody: CustodyFee;
  etfCommission: { pct: number; min: number; max?: number; channel: 'online' | 'branch' }[];
  source: { url: string; sheetRef: string; documentDate: string; retrieved: string; sha256: string };
  notes?: string;        // promos, assumptions on ETF classification
}
```

### Out of scope (cannot curate for free)

- Retrocessions per product and per client.
- Bid-ask spread and tracking difference (live data, not a published cost).
- Personal MiFID ex-ante and ex-post cost reports (only the client has them). The app could let a user paste their own figures instead.

## 6. Gaps in this research

- MPS: only a 2022 sheet found. BPER and MPS trading commission tables, and Poste trading terms, were not extracted.
- Banco BPM figures come from the Webank online product, not the branch product.
- Fineco custody is from a 2019 sheet version; the current Fineco trading-commission page does not state custody or bollo.
- Directa custody is not in the primary annex retrieved.
- Regulation text was confirmed through search extracts because EUR-Lex downloads were blocked; the KID review interval and exact article numbers should be re-read before being quoted in the product.
- Figures on bank sheets change often; all numbers here are as of 2026-10-25.
