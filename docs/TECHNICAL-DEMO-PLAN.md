# Precedent — Technical Demo Plan & Voiceover Script

**Autonomous AI Research Desk & Decision Stress Testing for Tokenized US Equities on Bitget**
*Bitget AI Base Camp Hackathon S2 · Track 3 — AI Trading Desk (AI Research Workbench)*

---

## 1. Executive Summary & Demo Objectives

Precedent is a natural-language research workbench for tokenized US equities (rTokens) traded continuously on crypto rails such as Bitget. Traded 24/7 across New York cash closes, SEC corporate disclosure windows, and global macro events, rToken traders face structural information asymmetry.

The goal of this technical demo is to demonstrate:
1. **The 4-Witness Parallel Research Architecture**: How Precedent fetches live tape basis, 10-year historical analogs ($p_{10}$ to $p_{90}$ quantile dispersion), SEC EDGAR XBRL disclosures, and macro headline sentiment in parallel without single points of failure.
2. **Active Language Guard Compliance**: How 21 automated rules actively sanitize directional hype, influencer slang, and paternalistic coaching into cold, empirical facts.
3. **Random Matrix Theory (RMT) Market Structure**: How market-mode removal and average-linkage correlation clustering cleanly segment 500 rToken underlyings into 103 coherent sector communities without single-linkage collapse.
4. **Sovereign Human Decision Layer**: How the trader retains 100% execution authority, documenting their rationale in a private local Decision Record.

---

## 2. Demo Formats & Timing Breakdown

### Option A: 5-Minute Hackathon Demo Pitch (Standard)
- **0:00 - 0:45 | The Problem & Persona**: Structural gap of 24/7 rToken trading vs. New York cash market; introducing the *Clerk of Evidence* persona.
- **0:45 - 2:00 | Live Research Intake & Streaming Pipeline**: Invoking the 4-witness parallel retrieval engine on `rAAPL` swing setup; live SSE status trace.
- **2:00 - 3:30 | The Institutional Desk Note**: The 6-point orientation contract, empirical "went up X times out of Y" base rates, witness clashes, and pre-mortem questions.
- **3:30 - 4:30 | Deep Telemetry & RMT Market Structure**: Collapsible accordions showing SEC EDGAR XBRL metrics, quantile outcome distributions, and RMT residual correlation clusters.
- **4:30 - 5:00 | Sovereign Decision Record & Conclusion**: Demonstrating non-execution human reflection logging, zero-LLM quantitative fallback, and test suite verification.

### Option B: 15-Minute Technical Architecture Review
- Extended deep dives into `lib/pipeline.ts`, `lib/synthesis.ts`, `lib/language-guard.ts`, `lib/rmt.ts`, and fallback resiliency during API degradation.

---

## 3. Shot-by-Shot Storyboard & Voiceover Script

| Scene | Duration | Visual Action | Voiceover Narration |
|---|---|---|---|
| **Scene 1: Introduction** | 0:00 - 0:45 | Highlighting the Precedent dark research workbench UI; zoom in on header and "Clerk of Evidence" status banner. | *"A trader holding an rToken on Bitget faces a structural blind spot: their position trades 24/7 on crypto rails, but underlying equity disclosures and liquidity operate on New York cash hours. Generic AI tools offer hyped, ungrounded directional calls. Precedent changes this. Built for the Bitget AI Base Camp, Precedent is an autonomous AI research desk that cross-examines setups across four independent witnesses—handing the trader factual evidence while preserving sovereign human decision authority."* |
| **Scene 2: Research Intake** | 0:45 - 1:15 | Clicking "Load recommended demo" button; showing Swing trader profile, rAAPL instrument, and concrete question. | *"We begin by selecting our trading style—Swing trader—and choosing rAAPL from the live Bitget universe. We submit a concrete research question: 'Stress-test the current AAPL rToken setup into next week—especially the 24/7 window versus cash session.' Precedent immediately initiates a server-sent events stream."* |
| **Scene 3: Parallel 4-Witness Pipeline** | 1:15 - 2:00 | Watching the 4 pillar cards transition from 'retrieving' to 'ready' in real-time. | *"In parallel, Precedent interrogates four independent witnesses that are allowed to disagree. Witness 1 examines the live 24/7 Bitget tape versus the New York cash close, quantifying venue basis. Witness 2 queries a 10-year chart library state packet for historical analogs. Witness 3 streams financial headlines and social sentiment. Witness 4 pulls SEC EDGAR XBRL disclosures and RMT market structure telemetry."* |
| **Scene 4: The Institutional Desk Note** | 2:00 - 3:15 | Smooth scroll through the primary memo: 1-sentence orientation, historical base rates ("went up 147 of 300 times"), and 3 summary cards. | *"In under 6 seconds, Precedent renders an Institutional Desk Note. Notice the core quantitative anchor: 300 historically similar setups showing exact empirical follow-through—147 of 300 went up over 5 days, with a median return of plus 0.4% and a p10 to p90 quantile dispersion range. Below, Precedent highlights witness clashes—contrasting elevated tape momentum against cautious headline sentiment—and poses pre-mortem invalidation questions."* |
| **Scene 5: Active Compliance & Active Rewriting** | 3:15 - 3:45 | Hovering over the active compliance indicator and mentioning language guard checks. | *"Precedent's Active Language Guard enforces 21 compliance rules. Prohibited directional calls like 'BUY' or 'SELL', influencer hype like 'going to rip', and patronizing coaching are actively sanitized into cold, objective facts before display."* |
| **Scene 6: Expandable Technical Accordions & RMT** | 3:45 - 4:30 | Expanding '04 Historical Analogs & Deep Telemetry', displaying RMT residual correlation communities and quantile range bars. | *"For quantitative inspection, expandable accordions disclose full source attributions, SEC CIK filings, and Random Matrix Theory correlation communities—isolating market-mode noise to group 500 underlyings into 103 clean sector cohorts."* |
| **Scene 7: Human Decision Record** | 4:30 - 5:00 | Typing a private decision rationale into the Decision Record at the memo foot. | *"Research first. Decide yourself. Precedent never executes trades or manages positions. At the foot of the memo, the trader logs their private decision rationale in browser-local storage. This is Precedent: cold empirical research, complete transparency, and human judgment sovereign."* |

---

## 4. Technical Architecture & Proof Points

```text
Browser UI (dark research desk)
  │  POST /api/research  (SSE stream)
  ▼
Research Pipeline (lib/pipeline.ts)
  ├── Witness 1: Live Tape & Basis      (Yahoo chart data + Bitget rToken ticker + local indicators)
  ├── Witness 2: Historical Analogs     (Chart Library state packet + 10-yr forward distributions)
  ├── Witness 3: News & Social          (Alpha Vantage + You.com + Yahoo / Google News RSS + X discourse)
  ├── Witness 4: Corporate Fundamentals (SEC EDGAR submissions, XBRL companyconcept, 8-K Atom)
  └── Market-Structure Telemetry        (Scheduled Marcenko-Pastur RMT precompute snapshot)
  ▼
Synthesis Layer (lib/synthesis.ts)
  LLM Waterfall: Experiential Qwen 3.8-27B → Bitget Qwen → OpenRouter → TokenHarbor / OpenAI → xAI Grok
  Deterministic Quantitative Desk Fallback (guarantees a complete memo if all LLMs timeout)
  ▼
Language Guard (lib/language-guard.ts) — 21 automated compliance sanitization regexes
  ▼
Unified Institutional Desk Note + Private Human Decision Record (localStorage)
```

---

## 5. Resiliency & Fallback Matrix

| Subsystem | Primary Provider | Fallback Strategy | Verification |
|---|---|---|---|
| **Synthesis Layer** | Qwen 3.8-27B via Experiential Labs | LLM Waterfall → Deterministic Quantitative Desk (`lib/deterministic-briefing.ts`) | Zero failure rate; complete memo guaranteed even with zero API keys |
| **Tape & Basis** | Bitget Spot Public API (`/api/v2/spot/public/symbols`) | Bitget USDT Futures RWA Contracts → Native Yahoo Cash Close | Discloses venue basis gap transparently |
| **Fundamentals** | SEC EDGAR XBRL & Submissions API | SEC Atom 8-K Feed → Degraded caveat disclosure (no fabricated CIK) | Graceful degradation without breaking research stream |
| **Market Structure** | Precomputed RMT Snapshot (`data/market-structure.json`) | On-the-fly Jacobi Eigensolver & Average-Linkage Clustering | Flagged as stale if snapshot > 36 hours old |

---

## 6. Generated Artifacts & Automated Verification

- **Script Document**: `docs/TECHNICAL-DEMO-PLAN.md`
- **Video File**: `docs/demo-video.mp4` (Full 1080p MP4 recording with narrated voiceover track)
- **Test Suite**: `npm test` (60 automated checks across language guard, prompt safety, math, RMT, and security)
