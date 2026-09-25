# Precedent: AI Trading Desk

## Team Product and Engineering Document

This document explains what Precedent is, who it is for, how the product works, how data moves through the system, which mechanics are implemented, what the hard product rules are, and where the team can extend it.

It is intended to be the shared working reference for product, design, frontend, backend, data, and demo work.

---

## 1. Product summary

Precedent is a natural-language research workbench for tokenized US stocks, also called rTokens, traded on crypto venues such as Bitget.

The product accepts a trader's:

- operating style,
- selected rToken or underlying symbol,
- concrete research question.

It then gathers four evidence streams:

1. fundamental company information,
2. technical market information,
3. equity news and macro context,
4. historically similar chart setups.

The system combines those streams into one reasoned briefing. The briefing is deliberately not a trading signal. It does not place orders, manage positions, or make an autonomous decision. The human trader remains responsible for deciding what to do.

The central product idea is:

> Research first. Decide yourself.

Precedent is designed for Bitget AI Base Camp Hackathon S2, Track 3: AI Trading Desk / AI Research Workbench, with Decision Stress Testing as the recommended sub-theme.

---

## 2. Target user

The target user is not a generic trader.

Precedent is for:

> Self-directed retail traders trading tokenized US stocks who lack institutional research access.

These traders:

- already understand how to execute trades;
- do not have a Bloomberg terminal or dedicated analyst desk;
- need to research quickly across a 7x24 rToken trading window;
- need to compare the continuously trading rToken venue with the underlying stock's cash-session tape;
- want evidence and context rather than a bare directional answer;
- need help stress-testing a thesis before making their own decision.

The product serves this user through adaptive intake. At the beginning of a session, the trader identifies the style they are operating in:

- Day trader
- Swing trader
- Event-driven / macro
- Position trader

The selected style changes:

- the relevant time horizon;
- the amount of detail;
- the relative weight of catalysts, tape, filings, and analogs;
- the language and framing of the final briefing;
- the analog horizon used in the synthesis.

This is a real product behavior, not merely a label in the interface.

---

## 3. Product principles

### 3.1 Evidence before impulse

The system should show what was retrieved and where it came from before asking the trader to interpret it.

### 3.2 One pipeline, not four dashboards

The four pillars are separate data-collection stages, but they are not separate products or independent dashboards. They converge into one synthesis layer and one memo.

### 3.3 Historical analogs are the anchor

Historical pattern matching is the product's main differentiation. The system does not only say what the current indicators look like. It asks:

> When charts looked like this before, what happened next?

The answer is shown as a small historical sample and distribution of outcomes, not as a prediction.

### 3.4 The human retains the decision

The product does not execute trades or manage positions. The final section presents considerations, invalidation conditions, and questions for the trader.

The UI includes a human decision reflection field. This lets the trader record what they are deciding, what they are waiting for, and what would change their mind. It is local browser state, not an order or portfolio control.

### 3.5 No bare directional signal or hype

The system must not output directional trade calls, unearned certainty, or influencer hype. The LLM prompt, deterministic fallback, and language guard enforce this rule strictly.

The prohibited patterns include:

- Directional recommendations: BUY, SELL, LONG, SHORT.
- Influencer hype and slang: "going to rip", "to the moon", "send it", "printing cash", "squeeze incoming", "massive rally", "guaranteed profit".
- Patronizing coaching: "a beginner should note", "for beginners", "fear of missing out", "FOMO".
- Directional leans: "constructive setup", "cautious lean", "slight edge", "favors higher prices", "room to run".
- Unearned probability / confidence percentages: "78% confidence", "90% probability".

They must not appear as a headline, conclusion, or recommendation. The post-processor actively sanitizes and rewrites them into objective empirical observations.

Forward-looking inquiry is permitted strictly within trader deliberation questions and invalidation boundaries.

### 3.6 Persona: Clerk of Evidence

Precedent acts as a **Clerk of Evidence**, not a trade advisor, coach, or signal service.

- **Intended Feel**: Calm, sourced, and slightly cold. Clarity over heat. Structure over vibe.
- **Product Motto**: *Pure research · non-execution · no directional bias or hype · every claim attributed · your judgment stays sovereign.*
- **Four Independent Witnesses**: Retrieved data is cross-examined across four distinct witnesses that are allowed to disagree:
  1. *Live Tape & Basis*: 24/7 Bitget order flow vs. New York cash equity close, venue basis, depth, and session spreads.
  2. *10-Year Historical Analogs*: Empirical setup matching, base rates, quantile dispersion ($p_{10}$ to $p_{90}$), and regime fit.
  3. *News & Social Discourse*: Verified financial media headlines, editorial lean, and engagement-weighted social sentiment.
  4. *Fundamentals & Market Structure*: SEC EDGAR XBRL filings, EPS, catalysts, and RMT residual-correlation community stability.

#### Texture of the Writing: Contrast Matrix

| Should feel like | Should not feel like |
|---|---|
| Institutional desk note | Influencer thread |
| Stress-test of a thesis | Trade prediction or forecast |
| “Here is the basis vs NY close” | “This is going to rip” |
| Disagreement between pillars | One smooth artificial narrative |
| Quiet, attributed, multi-stream data | Directional cheerleading or FOMO |
| “Here is the invalidation point” | “You should enter here” |
| Cross-examination of witnesses | Conversational coaching for beginners |

#### The 6-Point Reader Orientation Contract

After one quick pass over a Precedent memo, the reader must know:

1. **The setup in one sentence**: Target horizon, underlying asset, and venue basis (e.g. 24/7 Bitget pricing vs. NY cash close).
2. **What the tape is doing now vs cash hours**: Venue basis gap, depth, session liquidity, and key structural levels.
3. **What history rhymes with — and where the rhyme breaks**: Historical analog sample size ($n$), follow-through frequency, quantile dispersion ($p_{10}$ to $p_{90}$), and regime clashes.
4. **What social and fundamentals add or contradict**: Corroboration or friction from SEC filings, earnings disclosures, and headline sentiment.
5. **What can go wrong next week (Pre-Mortem)**: Catalyst drift, unexpected filings, macro volatility, liquidity vacuums, and predetermined invalidation boundaries.
6. **What is still unknown**: Explicit disclosure of degraded streams, missing SEC CIKs, limited analog samples, or stale RMT snapshots.

---

## 4. Required briefing structure

Every completed research memo follows an editorial institutional desk note layout with deep quantitative backing. The memo presents clear, attributed facts first, supported by collapsible technical accordions and an interactive decision record:

### 4.1 Document Header & Metadata
- **Status Banner**: Displays `Institutional Desk Note · Clerk of Evidence` (or `Quantitative Research Memo · Empirical Baseline` when the deterministic fallback synthesizer is engaged).
- **Engine Label**: Transparent model attribution showing the active LLM (e.g. `Engine: opencode/ling-3.0-flash-fin-free`) or deterministic fallback indicator (`Engine: Precedent Quantitative Desk (fallback)`).
- **Memo Title & Style Note**: A natural-language title summarizing the current setup for the asset, paired with horizon-specific guidance (e.g. 5–10 trading sessions for Swing).
- **Style & Market Badges**: Badges indicating the selected operating style and market context (`Shown for context only`).

### 4.2 Decision Stress Test (Primary Memo)

The primary body of the memo delivers the 6-point orientation contract:

#### 1. What we did
A crisp, one-sentence orientation stating the target horizon, underlying asset, and venue basis (e.g., cross-examining Bitget 24/7 rails against the NY cash close, 10-year analogs, SEC filings, and recent headline flow).

#### 2. Historical Rhyme & Quantile Dispersion (“went up X times out of Y”)
The core quantitative anchor of the research memo:
- **Sample Size**: Total count of verified historical chart matches found (e.g., `300 past cases`) or an explicit note when historical comparison data is unavailable.
- **Historical Summary**: Objective, factual summary of past pattern follow-through without directional bias.
- **Horizon Outcome Cards**: Three structured cards covering standard forward windows ("Next 1 trading day", "Next 5 trading days", "Next 10 trading days"):
  - **Frequency / Win Rate**: Explicit factual occurrences formatted strictly as **“went up X times out of Y”** (e.g., "went up 147 times out of 300").
  - **Typical Move**: The middle 80% outcome range (e.g., "usually between -4.8% and +4.7%").
  - **Median Result**: The sample median outcome (e.g., "Median: -0.1%").
- **Past examples**: 2 to 3 verified past occurrences (preferring same-ticker matches like `AAPL (2023-06-15)`) detailing plain-language forward outcomes (e.g., `rose about 0.4% over the next 5 days`). Never displays "n/a", null, or empty outcomes.
- **Important Note**: Mandatory caveat stating clearly: *"Historical results are past occurrences only, not predictions."*

#### 3. Top 3-Column Summary Cards
Organized directly below the historical snapshot to give the reader an instant synthesis of the setup:
- **Card 1: Core Verified Takeaways (01 / Takeaways)**: Plain-language, verified empirical observations across tape, corporate disclosures, and news.
- **Card 2: Witness Clashes & Divergences (02 / Divergences)**: Pushes tension first—states the two differing facts side-by-side (e.g. tape momentum vs. cautious headlines; crypto venue basis vs. closed equity cash market; reported profitability vs. secondary price fluctuations) and explains why the divergence matters.
- **Card 3: Pre-Mortem & Invalidation Boundaries (03 / Invalidation)**: Deliberation and pre-mortem questions addressing what can go wrong next week, catalyst drift, and precise invalidation triggers.

### 4.3 Human Decision Record
Positioned directly below the research memo, the Human Decision Record is an interactive, browser-local reflection module:
- Allows the trader to record their personal thesis, planned entry/exit criteria, and what specific evidence would invalidate their setup.
- Enforces the core product principle: **Research first. Decide yourself.** Precedent never executes trades, manages positions, or transmits orders to an exchange. All decisions remain strictly with the human trader.

### 4.4 Expandable Technical Accordions & Deep Telemetry
For quantitative traders who require deep inspection, the memo provides collapsible technical detail sections:
- **01 Verified Evidence & Source Attribution**: Full source-attributed data across all 4 witnesses (SEC EDGAR XBRL filings, Yahoo Finance technical levels, Bitget rToken tape basis, news sentiment, and Marcenko-Pastur RMT market structure eigenstructure and community stability).
- **02 Where the Signals Diverge**: Complete, unabridged tension matrix contrasting conflicting witness streams.
- **03 Quantitative Scoring & Plan Boundaries**: Horizon-specific considerations, explicit invalidation triggers, and Structure & Fundamentals flags.
- **04 Historical Analogs & Deep Quantitative Telemetry (`#advanced-precedents`)**: Chart Library state string, 5-row analog match table with similarity distances, base rates across 1d/5d/10d excess-return bands, quantile distribution range bar (`<UnsignedRanges />`), and normalized SVG trajectory comparison chart (`<AnalogOverlay />`).

---

## 5. Session flow

The intended demo and normal user flow are:

1. The trader chooses an operating style.
2. The trader selects an rToken.
3. The trader asks a concrete research question.
4. The frontend sends the request to the research API.
5. The API identifies the requested asset.
6. The pipeline starts all four pillar jobs.
7. The frontend receives streaming status events.
8. Each pillar returns either ready data or a degraded result with a caveat.
9. The synthesis layer combines the four results.
10. The language guard scrubs prohibited language.
11. The frontend renders the unified briefing.
12. The trader records or makes their own decision based on the briefing.

The recommended recorded demo should use this type of question:

> I am a swing trader. Stress-test the current AAPL rToken setup into next week, especially the 7x24 window versus the cash session. What did historically similar charts do next, and where do the pillars disagree?

The demo must visibly show:

- style selection;
- a specific rToken question;
- retrieval of all four pillars;
- the unified beginner-friendly memo with expandable technical accordions;
- the trader retaining the final decision via the Human Decision Record.

---

## 6. High-level architecture

The application is a Next.js application using the App Router.

### Main layers

```text
Browser UI
  |
  | POST /api/research
  v
Research API route
  |
  v
Research pipeline
  |
  +--> Historical analog pillar
  |      +--> Chart Library state packet
  |      +--> Yahoo historical bars
  |
  +--> Technical pillar
  |      +--> Yahoo chart data
  |      +--> Bitget rToken ticker
  |      +--> Local indicator calculations
  |
  +--> Fundamentals pillar
  |      +--> SEC submissions
  |      +--> SEC companyconcept XBRL
  |      +--> SEC Atom 8-K headlines
  |
  +--> News pillar
         +--> Yahoo Finance search/news
         +--> Yahoo Finance RSS
         +--> Google News RSS
         +--> Macro Google News query
  |
  v
Synthesis layer
  |
  v
Language guard
  |
  v
Server-sent events
  |
  v
Unified frontend memo
```

### Runtime

- Framework: Next.js 15
- UI: React 19
- Language: TypeScript with strict checking
- Styling: Tailwind CSS plus `app/globals.css`
- LLM client: OpenAI-compatible SDK
- Runtime for research API: Node.js
- Research response: Server-sent events

---

## 7. Repository map

### Application files

| File | Responsibility |
|---|---|
| `app/layout.tsx` | Root HTML layout and page metadata |
| `app/page.tsx` | Client-side intake UI, streaming state, unified briefing |
| `app/globals.css` | Global dark visual system, paper memo styles, grain effect |
| `app/api/research/route.ts` | Validates requests and streams research events |
| `app/api/universe/route.ts` | Returns the live Bitget rToken universe |

### Core library files

| File | Responsibility |
|---|---|
| `lib/types.ts` | Shared TypeScript contracts |
| `lib/pipeline.ts` | Orchestrates the four pillars and synthesis |
| `lib/synthesis.ts` | LLM synthesis, deterministic fallback, normalization |
| `lib/language-guard.ts` | Prohibited-language rewriting and verdict detection |
| `lib/style-profiles.ts` | Style-specific horizons and framing |
| `lib/universe.ts` | Known assets, Bitget-to-asset mapping, lookup helpers |
| `lib/indicators.ts` | Technical indicator calculations |
| `lib/http.ts` | Fetching, timeout, caching, headers, formatting helpers |

### Pillars

| File | Pillar |
|---|---|
| `lib/pillars/fundamentals.ts` | SEC fundamentals and filing catalysts |
| `lib/pillars/technicals.ts` | Native tape, rToken tape, indicators, levels |
| `lib/pillars/sentiment.ts` | Equity news, macro news, headline tags and lean |
| `lib/pillars/analogs.ts` | Chart Library analogs and forward outcomes |

### Providers

| File | Provider |
|---|---|
| `lib/providers/bitget.ts` | Bitget spot rToken discovery, RWA contracts, tickers |
| `lib/providers/chart-library.ts` | Chart Library state packet |
| `lib/providers/yahoo.ts` | Yahoo chart, news, nearest bars, forward returns |
| `lib/providers/sec.ts` | SEC submissions, XBRL concepts, Atom filings |
| `lib/providers/news.ts` | RSS parsing and headline classification |

---

## 8. Bitget integration and complete rToken support

The live Bitget integration is the source of truth for the supported rToken selector.

### 8.1 Explicit rToken discovery

The provider calls:

```text
GET https://api.bitget.com/api/v2/spot/public/symbols
```

It filters for:

- `baseCoin` matching `r[A-Za-z0-9]+`;
- `status === "online"`.

This is important because Bitget exposes actual rToken spot assets with names such as:

- `rAAPL`
- `rNVDA`
- `rTSLA`

and symbols such as:

- `RAAPLUSDT`
- `RNVDAUSDT`
- `RTSLAUSDT`

The application does not rely only on a manually maintained list.

### 8.2 Related RWA futures discovery

The provider also supports Bitget USDT-Futures RWA contract discovery through:

```text
GET https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES
```

This is used as a supplemental fallback for symbols that may have a related Bitget RWA contract but no immediately matched explicit spot rToken.

The primary public universe remains the explicit live spot rToken market list. This prevents underlying RWA futures from being incorrectly presented as rTokens.

### 8.3 Dynamic universe behavior

`GET /api/universe`:

1. fetches the current online rToken markets;
2. maps each market into the app's `NameCard` shape;
3. returns the live list to the browser;
4. falls back to the built-in known list if Bitget discovery is unavailable.

The frontend loads this endpoint on mount. If discovery succeeds, the instrument selector contains the live Bitget list. If it fails, the original local fallback list remains usable.

### 8.4 Asset mapping

For an explicit Bitget market:

```text
Bitget baseCoin: rAAPL
Native symbol:   AAPL
Display rToken:  rAAPL
Market symbol:   RAAPLUSDT
```

Known assets retain richer metadata:

- company name;
- sector;
- SEC CIK;
- aliases;
- alternate Bitget symbols.

Unknown assets receive safe generic metadata:

- native symbol derived from the rToken base coin;
- display name equal to the native symbol;
- sector `Bitget rToken`;
- Bitget market symbol as the primary ticker;
- no fabricated SEC CIK.

### 8.5 Symbol matching safety

Research requests use boundary-aware matching rather than unrestricted substring matching.

This prevents an ordinary word or a one-letter symbol from hijacking a request. For example, a request about AAPL must not accidentally resolve to a one-letter market because the question contains a matching character sequence.

Matching checks:

- explicit rToken base coin;
- full Bitget market symbol;
- native symbol without the leading `r`.

The fallback built-in universe is still used when Bitget discovery fails.

### 8.6 Current support model

The system supports all currently online explicit Bitget rToken spot markets at runtime. The exact count can change as Bitget lists or delists markets.

The team should not hardcode a permanent count into product copy. The API response and provider should remain dynamic.

---

## 9. Fundamentals pillar

File: `lib/pillars/fundamentals.ts`

### Purpose

Provide company-level context for the underlying asset behind the rToken.

### Data collected

For assets with a known SEC CIK:

1. SEC submissions JSON;
2. recent 10-K, 10-Q, 8-K, and 8-K/A filings;
3. diluted EPS from SEC companyconcept XBRL;
4. revenue from a prioritized list of SEC concepts;
5. SEC Atom 8-K titles;
6. fiscal year end and sector context.

### Filing selection

The provider examines up to 40 recent filing rows and returns up to eight relevant filings:

- `10-K`
- `10-Q`
- `8-K`
- `8-K/A`

Each filing includes:

- form;
- filing date;
- report date;
- primary document title;
- direct SEC archive URL.

### EPS logic

The provider requests:

```text
EarningsPerShareDiluted
```

It considers:

- `USD/shares`;
- `USD`.

It prefers quarterly framed records where available and returns the latest value plus the prior value.

### Revenue logic

Revenue concepts are attempted in order:

1. `RevenueFromContractWithCustomerExcludingAssessedTax`
2. `Revenues`
3. `SalesRevenueNet`

The first available concept is used.

### Catalyst logic

Recent 8-K filings are converted into catalyst strings. SEC Atom titles are added when they are not duplicates.

The product does not claim to have a paid earnings calendar. Catalysts are inferred from the recent filing tape and explicitly described as such.

### Degradation behavior

For a newly discovered Bitget rToken without a known SEC CIK:

- the fundamentals pillar returns `ok: false`;
- no company identity or filing data is invented;
- the result contains a clear caveat;
- the synthesis layer can still use technical, news, and analog data.

If SEC requests fail for a known asset, the pillar also degrades rather than blocking the complete research run.

---

## 10. Technicals pillar

File: `lib/pillars/technicals.ts`

### Purpose

Compare the underlying native stock tape with the live Bitget rToken venue tape and calculate interpretable technical context.

### Data collected

Native stock data comes from Yahoo Finance chart data:

- one year;
- daily bars;
- open, high, low, close, volume;
- regular market price;
- daily change;
- 52-week high and low;
- volume;
- market timestamp.

rToken data comes from Bitget ticker endpoints. The provider tries each known Bitget symbol against:

```text
GET /api/v2/spot/market/tickers
GET /api/v2/mix/market/ticker?productType=USDT-FUTURES
```

The first usable numeric last price is returned.

### Calculated indicators

The local indicator module calculates:

- SMA 20;
- SMA 50;
- SMA 200;
- RSI 14;
- MACD line;
- MACD signal;
- ATR 14;
- annualized 20-session realized volatility;
- distance from 52-week high;
- approximate support levels;
- approximate resistance levels.

### Trend description

The system describes whether price is:

- above the 20/50/200 averages;
- below the 50/200 averages;
- above the 20 and 50 averages;
- below the 20 while above the 50;
- in a mixed unresolved moving-average configuration.

### Momentum description

The system describes:

- RSI as high-side stretched, low-side stretched, or mid-range;
- MACD relative to its signal line.

### Native versus rToken comparison

When a Bitget rToken print is available, the system calculates:

```text
premium or discount = (rToken last - native last) / native last * 100
```

The result is described as a venue print, not NAV.

When no rToken print is available, the system says so explicitly. The product does not fabricate an overnight gap or premium.

### Why this matters

The native stock generally reflects the cash session. The rToken can trade outside that session. A difference between the two is therefore a context and stress-test input, not automatically a mispricing or signal.

---

## 11. News and sentiment pillar

File: `lib/pillars/sentiment.ts`

### Purpose

Provide recent equity-relevant news and macro context. Crypto-only sentiment is not treated as a substitute for equity news.

### Sources

The provider combines:

- Yahoo Finance search/news;
- Yahoo Finance RSS;
- Google News RSS for the company and ticker;
- Google News RSS for Federal Reserve, CPI, tariffs, and US stocks.

### De-duplication

Headlines are de-duplicated using a lowercased first-80-character key.

The final list is limited to ten company-relevant headlines. Macro headlines are limited to four.

### Headline tags

Each headline is classified as one of:

- earnings;
- guidance;
- macro;
- product;
- legal;
- other.

Classification uses keyword patterns.

### Headline lean

Each headline receives a simple interpretive label:

- constructive;
- cautious;
- mixed.

The label is based on keyword counts. Positive terms include words such as beat, surge, rally, record, raise, upgrade, and strong. Caution terms include miss, cut, delay, probe, weak, drop, warning, and slow.

This is a lightweight heuristic, not an investment conclusion.

### Degradation behavior

Individual news sources are allowed to fail without blocking all news:

- Yahoo search failure becomes an empty source;
- RSS failure becomes an empty source;
- Google News failure becomes an empty source.

If the complete news operation fails, the pillar returns a degraded result with a caveat.

---

## 12. Historical analog pillar

File: `lib/pillars/analogs.ts`

### Purpose

Make historical pattern matching the anchor of the product.

### Primary source

The preferred source is Chart Library:

```text
https://chartlibrary.io/api/v1/state-packet?symbol={native}
```

The state packet contains:

- current date;
- current state;
- previous state;
- tape features;
- closest analogs;
- sample size;
- symbol count;
- session count;
- excess follow-through ranges;
- informative statistics where available.

### Closest analogs

The provider takes up to five closest matches. Each match includes:

- ticker;
- historical date;
- distance score.

The lower the distance, the closer the mathematical match.

### Outcome calculation

For each analog ticker, Yahoo daily history is fetched for two years. The system finds the closest bar to the analog date and calculates cash close-to-close forward returns for:

- one session;
- five sessions;
- ten sessions.

If the date or future bars are unavailable, that outcome is `null`, not invented.

### Base-rate ranges

Chart Library ranges are normalized into:

- horizon;
- sample size;
- p10;
- p50;
- p90;
- share of positive excess outcomes.

These ranges describe excess performance versus a liquid-stock baseline, where the provider indicates that comparison. They are not raw-return guarantees and not forecasts.

### Overlay data

The provider also prepares normalized overlay series:

- current native series;
- analog series;
- values indexed from a window before to a window after the analog point.

The current UI uses the memo presentation first, but the structured overlay data is available for future chart visualization.

### Caveats

The pillar explicitly states:

- analogs are historical samples;
- follow-through is based on cash-session closes;
- analog data is not an rToken mark;
- the distribution is a range, not a direction.

### Degradation behavior

If Chart Library is unavailable or returns a non-OK packet:

- the pillar returns `ok: false`;
- closest analogs and ranges are empty;
- the synthesis layer says pattern matching degraded;
- no analogs or dates are fabricated.

---

## 13. Research pipeline mechanics

File: `lib/pipeline.ts`

The pipeline is an async generator that emits typed events.

### Step 1: resolve the asset

The pipeline combines the submitted symbol and question into a search string.

It first tries the live Bitget rToken market list. If a matching explicit rToken is found, it maps it to a `NameCard`.

If no explicit rToken is found, it tries the Bitget RWA futures contract list.

If Bitget discovery fails, it falls back to the built-in universe.

### Step 2: emit metadata

The first event identifies:

- selected style;
- resolved native symbol;
- company/display name;
- original question.

### Step 3: mark all pillars running

The pipeline emits a running event for:

- analogs;
- technicals;
- fundamentals;
- news.

### Step 4: run in parallel

All four pillar jobs run through `Promise.all`.

This minimizes total latency and prevents one sequential provider from delaying every other pillar.

### Step 5: emit pillar results

Each pillar emits:

- `ready` if `ok === true`;
- `degraded` if `ok === false`;
- its structured data payload.

### Step 6: synthesize

The full `PillarBundle` is passed to the synthesis layer along with:

- style;
- question;
- resolved asset.

### Step 7: emit briefing and completion

The pipeline emits:

- one briefing event;
- one done event.

---

## 14. Research API contract

File: `app/api/research/route.ts`

### Request

```http
POST /api/research
Content-Type: application/json
```

Example:

```json
{
  "style": "swing",
  "symbol": "AAPL",
  "question": "Stress-test the AAPL rToken setup into next week and show where the pillars disagree."
}
```

### Accepted styles

- `day`
- `swing`
- `event`
- `position`

Invalid or missing style defaults to `swing`.

### Validation

The route rejects:

- malformed JSON;
- null bodies;
- arrays;
- non-object bodies;
- missing or non-string questions;
- questions shorter than eight characters;
- questions longer than 2,000 characters.

It trims questions and limits the submitted symbol to 20 characters.

### Response

The response is an SSE stream:

```text
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

Each event has this format:

```text
data: {"type":"..."}
```

### Event types

`meta`:

```json
{
  "type": "meta",
  "style": "swing",
  "symbol": "AAPL",
  "name": "Apple",
  "question": "..."
}
```

`pillar`:

```json
{
  "type": "pillar",
  "id": "analogs",
  "status": "running"
}
```

or:

```json
{
  "type": "pillar",
  "id": "analogs",
  "status": "ready",
  "data": {}
}
```

`briefing`:

```json
{
  "type": "briefing",
  "briefing": {}
}
```

`error`:

```json
{
  "type": "error",
  "message": "..."
}
```

`done`:

```json
{
  "type": "done"
}
```

The route catches pipeline errors, sends an error event, sends done, and closes the stream.

---

## 15. Synthesis layer

File: `lib/synthesis.ts`

### Provider selection

The synthesis provider is selected in this order:

1. `XAI_API_KEY` -> xAI-compatible OpenAI client;
2. `BITGET_QWEN_API_KEY` -> Bitget hackathon Qwen gateway;
3. deterministic synthesizer if neither key exists.

The configured model labels are:

- `grok-4.5`;
- `qwen3.8-max`;
- `deterministic-synthesizer`.

### LLM prompt rules

The system prompt tells the model:

- it is a research workbench;
- the human makes the trade;
- it must synthesize all four pillars;
- it must follow the exact JSON schema;
- it must cite actual sources;
- it must name real tensions;
- it must treat analogs as base rates;
- it must not invent missing data;
- it must distinguish native cash tape from rToken tape;
- it must adapt to the selected style;
- it must end with questions.

### JSON schema

The briefing contains:

- title;
- style note;
- evidence citations;
- tension items;
- historical analog setup;
- analog rows;
- base-rate rows;
- caveat;
- style considerations;
- invalidation conditions;
- questions;
- model label;
- source references.

### LLM fallback

The system first attempts the chat completions API. If that fails, it attempts the responses API.

If parsing or completion still fails:

- the deterministic briefing is returned;
- the model label says it fell back to the deterministic synthesizer;
- the user still gets a complete memo.

### Deterministic synthesis

The fallback synthesizer:

- builds evidence from available fundamentals, technicals, news, and analogs;
- creates tension from analog dispersion, RSI/news disagreement, and missing rToken data;
- lists up to five closest analogs;
- formats p10, median, p90, and sample size;
- adapts considerations to the selected style;
- creates invalidation conditions;
- ends with three questions.

The fallback is important for a live demo because the research desk remains usable without an LLM key.

### Normalization

If the model returns incomplete JSON, normalization fills missing sections from the deterministic fallback.

Examples:

- missing title uses fallback title;
- empty evidence uses fallback evidence;
- missing analog list uses fallback analog section;
- missing questions uses fallback considerations.

---

## 16. Language guard

File: `lib/language-guard.ts`

The guard is the final safety layer before a briefing reaches the UI.

### Rewriting behavior

It detects and rewrites prohibited directional terms and directive phrases.

Examples of transformations:

- prohibited directional terms become neutral constructive or cautious wording;
- directive phrases become a statement that the desk does not take a side;
- confidence-style wording is removed;
- list items containing only an unwanted verdict line are filtered.

The guard runs on:

- title;
- style note;
- evidence claims;
- tension text;
- historical setup;
- analog outcomes;
- base-rate notes and ranges;
- caveats;
- style considerations;
- invalidation conditions;
- questions.

This broad application matters because unsafe language can appear in any generated field, not only in the title.

---

## 17. Trading style profiles

File: `lib/style-profiles.ts`

### Day trader

- Desk: intraday / next cash session
- Horizon: hours to the next cash open or close
- Analog horizon: 1 day
- Emphasis: tape, realized volatility, rToken gaps, and immediate catalyst checks

### Swing trader

- Desk: several sessions to two weeks
- Horizon: 5 to 10 sessions
- Analog horizon: 5 days
- Emphasis: full four-pillar memo, historical analogs, and disagreement between evidence streams

### Event-driven / macro

- Desk: around a catalyst
- Horizon: event window, including weekend and after-hours rToken trade
- Analog horizon: 5 days
- Emphasis: filings, guidance language, catalysts, macro headlines, and repricing before cash opens

### Position trader

- Desk: weeks to a quarter
- Horizon: 20 to 60 sessions
- Analog horizon: 10 days
- Emphasis: filings, earnings trajectory, longer-term regime, and whether analog dispersion changes the thesis

---

## 18. Frontend mechanics

File: `app/page.tsx`

### Intake state

The client stores:

- selected style;
- selected symbol;
- question;
- pillar statuses;
- structured pillar data;
- resolved metadata;
- final briefing;
- user decision note;
- busy state;
- error state.

### Dynamic universe loading

On page mount, the browser calls `/api/universe`.

If it receives a non-empty list, it replaces the local fallback list. If the request fails, the built-in list remains available.

### Streaming parser

The frontend:

1. sends the POST request;
2. reads the response body with `getReader`;
3. decodes chunks with `TextDecoder`;
4. buffers partial frames;
5. splits complete SSE frames on blank lines;
6. parses each `data:` line as JSON;
7. updates the UI by event type.

This lets the user see the research run progressing rather than waiting on a blank screen.

### Pillar status UI

Each pillar can show:

- queued;
- retrieving source data;
- included in synthesis;
- included with caveat.

### Unified briefing UI

The frontend renders one cohesive memo in the beginner-friendly layout:

1. What we did;
2. Historical stress test (“went up X times out of Y”);
3. Other things we checked;
4. Where things do not agree;
5. Simple takeaways;
6. Questions only you can answer;
7. Human Decision Record.

Supported by expandable technical detail accordions:
- Technical details (Evidence details & Where the Facts Differ);
- Historical chart details (Setup, Analogs match table, Base-rate cards, Quantile range bar, Normalized trajectory chart);
- Additional technical scoring (Horizon considerations, Invalidation triggers, Structure & Fundamentals flags).

The memo also shows:

- active model or fallback status;
- selected style;
- source citations;
- caveats;
- interactive human decision layer.

### Human Decision Record

The decision note is intentionally not sent to the backend. It remains in browser component state and is not an execution mechanism.

The prompt asks the trader to record:

- what they will do;
- what they are waiting for;
- which fact would change their mind.

---

## 19. Source and data quality rules

The system should follow these rules when adding new providers or features:

1. Cite the actual source used.
2. Do not call a venue print NAV.
3. Do not fabricate missing rToken prices.
4. Do not fabricate SEC filings or analog dates.
5. Label degraded pillars.
6. Preserve the difference between cash-session returns and rToken returns.
7. Describe heuristic sentiment as heuristic.
8. Keep analogs as historical samples, not forecasts.
9. Make source timestamps visible where useful.
10. Keep the synthesis complete even if one pillar fails.

---

## 20. Error handling and fallback strategy

The product is designed to degrade gracefully.

### Provider-level failures

Each pillar catches its own provider errors and returns a typed degraded result.

### Pipeline-level failures

The API route catches uncaught pipeline errors and emits SSE error and done events.

### Synthesis failures

The LLM synthesis falls back to deterministic synthesis.

### Universe failures

The live Bitget universe falls back to the local known list.

### Data absence

Missing fields are represented as:

- `undefined`;
- `null`;
- empty arrays;
- explicit textual caveats.

The system must not silently turn missing data into positive-looking data.

---

## 21. Environment variables

Defined in `.env.example`:

```text
XAI_API_KEY=
BITGET_QWEN_API_KEY=
BITGET_API_KEY=
BITGET_API_SECRET=
BITGET_PASSPHRASE=
```

### XAI_API_KEY

Optional. Enables xAI-compatible LLM synthesis.

### BITGET_QWEN_API_KEY

Optional. Enables the Bitget hackathon Qwen gateway when xAI is not configured.

### Bitget API credentials

The current public market-data paths work without private credentials. These variables are reserved for future authenticated Bitget capabilities and should not be committed.

No order execution should be added to this product without an explicit product decision and a separate scope review. The current product is intentionally research-only.

---

## 22. What is implemented versus future work

### Implemented

- Next.js application shell;
- responsive research desk UI;
- trader style intake;
- concrete rToken question intake;
- live Bitget rToken discovery;
- dynamic universe selector;
- boundary-safe symbol routing;
- all four research pillars;
- parallel pillar execution;
- SSE progress events;
- SEC fundamentals;
- Yahoo technical data;
- Bitget rToken tape comparison;
- equity and macro news;
- Chart Library historical analogs;
- Yahoo analog forward returns;
- LLM synthesis;
- deterministic synthesis fallback;
- language guard;
- unified beginner-friendly memo with expandable technical accordions;
- human decision reflection field (Human Decision Record);
- API input validation;
- graceful degradation;
- production build support.

### Future work

Potential future additions, subject to team agreement:

- visual analog overlay chart;
- richer rToken-specific historical candles;
- authenticated Bitget MCP tools where they provide data unavailable through public endpoints;
- deeper earnings-surprise and guidance extraction;
- balance-sheet red-flag extraction;
- better entity resolution for symbols without SEC mappings;
- source timestamps and freshness badges;
- persisted research sessions;
- shareable read-only briefing links;
- demo recording and hosted deployment;
- user feedback collection from three to five target traders;
- automated contract tests for each provider;
- observability and latency metrics;
- rate limiting and abuse protection;
- accessibility audit;
- mobile layout refinement.

Future features must not turn the product into an execution agent or signal generator.

---

## 23. Bitget MCP and skill relationship

The product's Bitget-specific capability is represented in code by the Bitget provider layer and the live public Bitget market-data endpoints.

The Bitget MCP/skill direction is relevant for team expansion in two ways:

1. It provides a standard agent tool path for Bitget market research and signal skills.
2. It can later supply richer authenticated or specialized market context without changing the four-pillar product contract.

Regardless of whether a provider is called through REST, MCP, or a skill, its output must be normalized into the existing pillar types and must preserve:

- source identity;
- timestamp or session;
- symbol identity;
- data quality;
- explicit caveats;
- the difference between observation and recommendation.

The UI and synthesis layer should not become coupled to one provider protocol.

---

## 24. Testing and validation expectations

The existing project is validated with:

```text
npm run build
```

The team should also repeatedly test:

### Frontend

- homepage returns successfully;
- intake controls update state;
- demo task loads correctly;
- all live rTokens can be selected;
- streamed statuses render;
- the memo appears in the required order;
- the decision note stays client-side.

### API

- malformed JSON returns 400;
- null and array bodies return 400;
- short questions return 400;
- oversized questions return 400;
- invalid style falls back to swing;
- valid Unicode questions work;
- unknown but live Bitget rTokens produce a degraded-but-complete memo;
- the stream includes meta, pillar events, briefing, and done.

### Data integrity

- `/api/universe` matches live online explicit Bitget rToken markets;
- no synthetic underlying-only futures are presented as rTokens;
- AAPL resolves to AAPL, not a one-letter collision;
- a missing SEC CIK does not create fabricated filing data;
- a missing Bitget print is disclosed;
- a failed Chart Library call does not create fake analogs.

### Output safety

- no prohibited directional terms reach the final memo;
- no confidence percentage appears as a final recommendation;
- no execution control exists in the frontend or API;
- the final section ends with trader questions.

---

## 25. Collaboration plan

### Product / demo owner

Own:

- target-user language;
- demo script;
- submission form;
- hosted demo;
- judge-facing explanation.

### Frontend owner

Own:

- intake usability;
- streaming states;
- responsive layout;
- unified memo readability;
- accessibility;
- decision reflection UX.

### Data / provider owner

Own:

- Bitget discovery;
- rToken ticker reliability;
- SEC mapping;
- Chart Library integration;
- news source quality;
- freshness and failure behavior.

### Synthesis / AI owner

Own:

- prompt;
- JSON contract;
- deterministic fallback;
- normalization;
- language guard;
- source citations;
- model configuration.

### QA / reliability owner

Own:

- provider contract tests;
- API boundary tests;
- concurrent request tests;
- live universe consistency checks;
- output safety checks;
- latency and failure reporting.

---

## 26. Team decisions still needed

The following decisions should be made explicitly:

1. Which LLM provider will be used for the recorded demo?
2. Will the hosted demo use public provider data only?
3. Will the team add an analog overlay chart before submission?
4. Which three to five traders will provide qualitative validation?
5. What task-completion time target will be reported?
6. How will source freshness be displayed?
7. Will research sessions be persisted or remain ephemeral?
8. Which authenticated Bitget MCP or skill capabilities are worth adding?
9. What is the final hosted URL and submission materials link?
10. Who owns the demo recording and final hackathon form?

---

## 27. Recommended validation metrics

The submission should use concrete metrics rather than generic claims.

Recommended measurements:

- time from question submission to first pillar status;
- time from question submission to completed briefing;
- percentage of runs where all four pillars return ready;
- percentage of runs where at least three pillars return usable data;
- number of live Bitget rToken markets discovered;
- number of analogs returned per successful run;
- percentage of final briefings passing the language guard;
- qualitative usefulness ratings from three to five target users;
- time required for a trader to complete a multi-factor research task before and after using Precedent.

The metrics are for judging and product learning. They are not intended to market a win rate, Sharpe ratio, or trading performance claim.

---

## 28. Demo script

Use one complete, repeatable task.

### Step 1: state style

Select Swing trader.

### Step 2: select instrument

Select `rAAPL`.

### Step 3: ask the question

Use:

> I am a swing trader. Stress-test the current AAPL rToken setup into next week, especially the 7x24 window versus the cash session. What did historically similar charts do next, and where do the pillars disagree?

### Step 4: show retrieval

Show the four status cards moving from retrieval to included in synthesis:

- Fundamentals;
- Technicals;
- News / sentiment;
- Historical analogs.

### Step 5: show the memo

Scroll through:

1. Evidence;
2. Tension;
3. Historical analog;
4. Considerations for the trader.

Point out:

- cited facts;
- native versus rToken context;
- the five closest analogs;
- p10, median, and p90 ranges;
- caveats;
- invalidation conditions;
- questions.

### Step 6: show the human decision layer

Enter a short note describing the trader's own decision or what they are waiting for.

The demo should make clear that Precedent informs the decision but does not make or execute it.

---

## 29. Submission positioning

### Thesis

Precedent turns a natural-language question about an rToken into a cited, multi-factor research briefing that exposes historical precedent and disagreement instead of hiding them behind a signal.

### Target user

Self-directed retail rToken traders without institutional research access who need to work across a 7x24 market window.

### Validation

Report:

- completion time;
- pillar availability;
- analog retrieval count;
- qualitative feedback;
- output safety rate.

### Progress

The core pipeline, dynamic Bitget rToken support, four pillars, synthesis, fallback, and unified memo are implemented.

### Deliverables

- accessible frontend;
- source repository;
- recorded complete research task;
- product and technical documentation;
- submission links.

### Role of the LLM

The LLM is a synthesis and framing layer. It does not independently invent market facts or act as an execution agent. It receives structured pillar data, returns a constrained JSON briefing, and is protected by deterministic fallback and language scrubbing.

---

## 30. Non-goals

Precedent is not:

- an order-placement system;
- an autonomous trading agent;
- an automated position manager;
- a paper-trading log;
- a backtesting product;
- a win-rate or Sharpe marketing product;
- a generic dashboard for every trader;
- a substitute for the trader's own judgment.

The product should not drift into these areas merely because the underlying market data could support them.

---

## 31. Quick start for teammates

From the project directory:

```text
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

For a production-style run:

```text
npm run build
npm start -- -p 3100
```

Open:

```text
http://localhost:3100
```

Useful endpoints:

```text
GET  /api/universe
POST /api/research
```

Do not commit `.env` files or API keys.

On Windows, stop an existing Next.js process before rebuilding if `.next/trace` is locked.

---

## 32. Final product definition

Precedent is a focused research desk for a specific user and a specific problem:

> How can a self-directed rToken trader quickly stress-test a live setup across company fundamentals, market structure, equity news, macro context, and historical chart precedent while keeping the final decision human?

The answer is a single natural-language research pipeline:

```text
Trader style + rToken question
  -> Bitget-aware asset resolution
  -> Four parallel evidence pillars
  -> Historical analog anchor
  -> One constrained synthesis
  -> Language safety guard
  -> Evidence / Tension / Historical analog / Considerations
  -> Human decision
```

That sequence is the product. Every new feature should strengthen it, make it faster, make it more trustworthy, or make it easier to demonstrate. Features that obscure the evidence, turn the product into a signal generator, or remove the human decision layer are out of scope.
