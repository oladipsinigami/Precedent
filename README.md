# Precedent — AI Research Workbench for Tokenized US Equities

**Precedent is a natural-language research workbench that turns a trader's question about a tokenized US stock (an rToken trading 24/7 on Bitget) into one cited research memo — evidence, tensions, historical analogs, and open questions — while the final decision stays entirely with the human.**

> Research first. Decide yourself.

- **Live site:** https://precedent-liard-eight.vercel.app
- **Hackathon:** Bitget AI Base Camp S2 · Track 3 — AI Trading Desk / AI Research Workbench · Sub-theme: Decision Stress Testing
- **In-depth docs:** [PRODUCT-OVERVIEW.md](PRODUCT-OVERVIEW.md) · [AI-Trading-Desk-Build-Brief-FINAL.md](AI-Trading-Desk-Build-Brief-FINAL.md) · [Research-Workbench-Design.md](Research-Workbench-Design.md)

## What it does

- **Adaptive intake** — the trader states their operating style (day, swing, event-driven, or position), picks a live Bitget rToken, and asks a concrete research question. The selected style genuinely re-weights horizons, analog windows, pillar emphasis, and memo framing.
- **Four evidence pillars, in parallel** — SEC fundamentals and filing catalysts; technicals comparing the 24/7 rToken tape with the underlying cash session; equity and macro news with attributed sentiment; and historically similar chart setups reported as "went up X times out of Y" forward-outcome distributions, not predictions.
- **One constrained synthesis** — an LLM merges the pillars into a beginner-readable memo (What we did → Historical stress test → Other things we checked → Where things do not agree → Simple takeaways → Questions only you can answer), protected by a deterministic fallback and a language guard that removes directional or advisory phrasing.
- **Human Decision Record** — a private, non-execution deliberation journal at the end of every memo, auto-saved to the browser's localStorage.
- **Reliability** — streamed progress over server-sent events, per-pillar graceful degradation with disclosed caveats, API input validation, per-IP rate limiting, and a cached one-click demo path.

Precedent does **not** place orders, manage positions, backtest, or emit buy/sell signals. It is intentionally research-only.

## Architecture overview

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS · OpenAI-compatible LLM client · Node.js research API streaming server-sent events.

```text
Browser UI (dark research desk + paper memo)
  |  POST /api/research  (SSE stream)
  v
Research pipeline (lib/pipeline.ts)
  +--> Fundamentals pillar      (SEC submissions, XBRL companyconcept, 8-K Atom)
  +--> Technicals pillar        (Yahoo chart data + Bitget rToken ticker + local indicators)
  +--> News / sentiment pillar  (Yahoo Finance + Google News RSS, tagged headlines)
  +--> Historical analog pillar (Chart Library state packet + Yahoo forward returns)
  v
Synthesis layer (lib/synthesis.ts)
  LLM providers in order: OpenRouter -> OpenAI / TokenHarbor -> xAI Grok -> Bitget Qwen
  Deterministic fallback if no model is reachable
  v
Language guard (lib/language-guard.ts) — rewrites prohibited directional phrasing
  v
Unified memo + Human Decision Record
```

| Path | Responsibility |
|---|---|
| `app/page.tsx` | Intake state, streaming, view orchestration |
| `app/components/` | Intake form, results view, paper memo, Decision Record |
| `app/api/research/route.ts` | Request validation, cached demo fast path, SSE streaming |
| `app/api/universe/route.ts` | Live Bitget rToken universe |
| `lib/pipeline.ts` | Orchestrates the four pillars and synthesis |
| `lib/synthesis.ts` | LLM synthesis, deterministic fallback, normalization |
| `lib/language-guard.ts` | Prohibited-language rewriting and verdict detection |
| `lib/pillars/` | fundamentals · technicals · sentiment · analogs |
| `lib/providers/` | bitget · chart-library · yahoo · sec · news |

## Run locally

Prerequisites: Node.js 18.18+ and npm.

```bash
npm install
cp .env.example .env.local   # add keys as desired — see below
npm run dev                  # http://localhost:3000
```

No API key is required to try the app: public market data works unauthenticated, and without an LLM key the synthesis layer falls back to the deterministic engine. To enable LLM synthesis, set any **one** of the following (tried in this order):

| Variable | Provider |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter (free-tier models supported) |
| `OPENAI_API_KEY` | OpenAI, or TokenHarbor (`thk_…` keys) |
| `XAI_API_KEY` | xAI Grok |
| `BITGET_QWEN_API_KEY` | Bitget hackathon Qwen gateway |

Optional news, social, and fundamentals provider keys are documented in [`.env.example`](.env.example). Never commit `.env` files or API keys.

Production-style run:

```bash
npm run build
npm start                  # http://localhost:3000
```

Validate changes with `npm test` (language-guard suite) and `npm run build`.

## Demo script

Fastest path: click **"Load recommended demo"** in the header — it fills style = Swing, instrument = AAPL, and the recommended stress-test question, then runs immediately against a cached fast path.

Manual flow:

1. Select **Swing trader**.
2. Select **AAPL** (rAAPL on Bitget) from the live universe.
3. Ask: *"I'm a swing trader. Stress-test the current AAPL rToken setup into next week — especially the 7×24 window versus the cash session. What did historically similar charts do next, and where do the pillars disagree?"*
4. Watch the four pillar cards move from retrieval to inclusion in the synthesis.
5. Scroll the memo: cited facts, native-versus-rToken context, the five closest analogs with p10 / median / p90 ranges, disagreements, caveats, invalidation conditions, and open questions.
6. Record your own decision in the **Trader Decision Record** — it never leaves your browser.

The demo makes clear that Precedent informs the decision but does not make or execute it.
