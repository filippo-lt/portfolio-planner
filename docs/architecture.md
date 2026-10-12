# Architecture

## 1. System context

```mermaid
flowchart LR
  User((Investor)) -->|browser| App
  subgraph App["Next.js app (single deployable)"]
    UI[Client UI<br/>React 19]
    API[API routes<br/>Node runtime]
  end
  UI <-->|localStorage| LS[(Profile +<br/>benchmark pref)]
  UI -->|fetch JSON| API
  API --> Y[Yahoo Finance<br/>yahoo-finance2]
  API --> F[OpenFIGI<br/>ISIN mapping]
  API --> C[Anthropic API<br/>Claude]
  API <--> FS[(.cache/<br/>JSON files)]
```

- **No database and no accounts.** The only persisted user data is in the browser.
- **Every external call is server-side.** API keys stay in `.env.local` and are never in the client bundle.

## 2. Layers

```mermaid
flowchart TB
  subgraph Client["Client (browser)"]
    Pages["Pages<br/>/ · /profilo · /report/[symbol]"]
    Comp["Components<br/>ReportView · PriceChart · AiSummary · ReportRoute"]
    Store["profileStore<br/>useSyncExternalStore + localStorage"]
    FitC["profileFit (isomorphic)"]
  end
  subgraph Server["Server (Next.js route handlers)"]
    RS["/api/search"]
    RR["/api/report"]
    RSum["/api/summary"]
    Report["lib/report.ts<br/>buildReport · searchInstruments"]
    Metrics["lib/metrics.ts (pure)"]
    Cache["lib/cache.ts<br/>memory LRU + files"]
    Prov["DataProvider interface"]
    Yahoo["YahooProvider"]
    SV["summaryValidation (pure)"]
  end
  Pages --> Comp --> Store
  Comp --> FitC
  Comp -->|fetch| RS & RR & RSum
  RS & RR --> Report --> Cache --> Prov --> Yahoo
  Report --> Metrics
  RSum --> SV
  RSum --> Cache
```

`profileFit`, `metrics` and `summaryValidation` are **pure modules**. They have no I/O and are unit-tested, so the same code can run on the server or the client.

## 3. Request flows

### 3.1 Search (ISIN or ticker)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant S as /api/search
  participant C as cache
  participant Y as Yahoo
  participant F as OpenFIGI
  B->>S: GET ?q=IE00BK5BQT80
  S->>S: validate (≤40 chars, [\w .&-])
  S->>C: get search:IE00BK5BQT80
  alt cache hit (7d TTL)
    C-->>S: candidates
  else miss
    S->>Y: search(q)
    Y-->>S: quotes (may miss EU listings)
    opt q is an ISIN
      S->>F: POST /v3/mapping {ID_ISIN}
      F-->>S: tickers + exchCode
      S->>S: exchCode → Yahoo suffix<br/>(GY→.DE, IM→.MI, NA→.AS, LN→.L …)
    end
    par for each candidate (max 12)
      S->>Y: quote(symbol)
      Y-->>S: currency / exists?
    end
    S->>S: drop unknown, sort EUR first
    S->>C: set (7d)
  end
  S-->>B: { results: SymbolCandidate[] }
```

### 3.2 Report

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (ReportView)
  participant R as /api/report
  participant BR as buildReport
  participant C as cache
  participant Y as Yahoo
  B->>R: GET ?symbol=AAPL&benchmark=VWCE.DE
  R->>R: validate symbols /^[A-Za-z0-9.\-=^]{1,20}$/
  R->>BR: buildReport(AAPL, VWCE.DE)
  par instrument
    BR->>C: profile:AAPL (7d) / history:AAPL:20 (24h)
    C-->>Y: on miss: quoteSummary · chart(20y)
  and benchmark
    BR->>C: profile:VWCE.DE / history:VWCE.DE:20
  end
  BR->>BR: computeMetrics ×2 · rebase · monthlyCloses · notes
  BR-->>R: Report
  R-->>B: 200 Report  (or 502 fixed Italian error)
  B->>B: profileFit(localProfile, metrics) — client-side
  B->>B: filter sections by knowledge level
```

### 3.3 AI summary

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (AiSummary)
  participant S as /api/summary
  participant C as cache
  participant A as Anthropic
  B->>S: POST {report, fit, level}
  alt no ANTHROPIC_API_KEY
    S-->>B: {summary:null, reason:'non configurato'} → section hidden
  end
  S->>S: rate limit 10/min/IP · body ≤100 KB
  S->>S: slimReport (whitelist fields, top-10 lists)
  S->>C: get summary:sha1(model+payload)
  alt hit
    C-->>S: text
  else miss
    loop max 2 attempts
      S->>A: messages.create (system prompt IT, max_tokens 300)
      A-->>S: text
      S->>S: validateSummary(text, input)
    end
    S->>C: set if valid (7d)
  end
  S-->>B: {summary} or {summary:null}
```

## 4. Module map

```
src/
├── app/
│   ├── layout.tsx              header, skip link, disclaimer footer
│   ├── page.tsx                search (redirects to /profilo if no profile)
│   ├── profilo/page.tsx        onboarding / edit form
│   ├── report/[symbol]/page.tsx  → <ReportRoute/>
│   └── api/
│       ├── search/route.ts     GET  → searchInstruments
│       ├── report/route.ts     GET  → buildReport
│       └── summary/route.ts    POST → Claude + validation
├── components/
│   ├── ReportRoute.tsx         reads + decodes the [symbol] param
│   ├── ReportView.tsx          fetch report, compute fit, level filtering, sections
│   ├── PriceChart.tsx          Recharts line chart (rebased = 100)
│   └── AiSummary.tsx           calls /api/summary, hides on null
└── lib/
    ├── data/
    │   ├── types.ts            domain types
    │   ├── provider.ts         DataProvider interface
    │   └── yahoo.ts            Yahoo + OpenFIGI implementation
    ├── report.ts               orchestration + caching keys
    ├── metrics.ts              pure math
    ├── profileFit.ts           pure fit rules (isomorphic)
    ├── profileValidation.ts    pure form validation
    ├── profileStore.ts         localStorage hooks (client)
    ├── summaryValidation.ts    pure number / word checks for AI output
    ├── cache.ts                memory LRU + file cache, in-flight de-dup
    └── format.ts               it-IT number / % / date formatting
```

## 5. Client state

```mermaid
stateDiagram-v2
  [*] --> Loading: first render (SSR snapshot)
  Loading --> NoProfile: localStorage empty / invalid / old version
  Loading --> HasProfile: valid v1 profile
  NoProfile --> HasProfile: save on /profilo
  HasProfile --> HasProfile: edit on /profilo
  NoProfile --> [*]: redirect to /profilo
```

`profileStore` uses `useSyncExternalStore` and the `storage` event, so edits in another tab propagate. Every localStorage read and write is in a try/catch, so private mode or blocked storage degrades to "no profile".

## 6. Tech stack

| Concern     | Choice                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| Framework   | Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript          |
| Styling     | Tailwind CSS 4, light theme, neutral slate/blue palette                   |
| Charts      | Recharts                                                                  |
| Market data | `yahoo-finance2` v4 (unofficial) + OpenFIGI REST                          |
| LLM         | `@anthropic-ai/sdk`, model `ANTHROPIC_MODEL` (default `claude-haiku-5-5`) |
| Tests       | Vitest                                                                    |
