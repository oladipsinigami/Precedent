# Bitget AI Base Camp Hackathon S2 - Submission Pack

> Copy-paste source for the Google Form: https://forms.gle/GyWZCMCPocgJdJon6
> **Deadline: 27 September 2026 (UTC+8).** Every figure below was measured while building this;
> nothing is aspirational unless explicitly labelled as a plan.

**Track:** Track 3 - AI Trading Desk (AI Research Workbench)
**Sub-theme:** **Decision Stress Testing** - "Before opening a position, how does AI retrieve historically similar scenarios?"
**Demo:** https://precedent-liard-eight.vercel.app/

---

## 1 - Project Description (one form field, six parts)

### Part 1 - Thesis (highest weight)

A trader holding a tokenized US equity (rToken) on Bitget has a structural blind spot. The cash
session they want to reason about closes after five and a half hours, but their position moves for
24. The weekend gap, the post-close macro release and the rToken basis are exactly the moments
where a decision is made with the least information - and there is no research workbench built for
that asymmetry. Existing tools fail in three specific ways: retail brokerages show the cash session
only, so the 7x24 tape is invisible; crypto-native analytics tools cover the venue but carry no
SEC filings, no fundamentals and no historical precedent for the *equity*; and general LLM chat
produces confident directional opinions with no data provenance, which is worse than no answer for
someone risking capital.

Precedent's hypothesis is that the useful artifact is not an opinion but a **bounded distribution
of what happened in structurally similar situations**, assembled from verifiable sources, with
disagreement between sources preserved rather than smoothed away. The LLM acts as a **Clerk of
Evidence**—it structures and cross-examines evidence; it never decides, never recommends, and never
invents a number we could not attribute.

### Part 2 - Target user and product value

A concrete segment, not "all traders": **retail and semi-professional swing traders holding rToken
positions in US equities (single names and ETFs), holding period 1-30 days, position size roughly
$5k-$100k, trading primarily from a mobile or browser outside US market hours, with no access to a
sell-side research desk.** They already hold the exposure; what they lack is a way to stress-test
it against history before adding or cutting, especially when the market they care about is closed
and their position is not. For this segment the product removes one specific uncertainty - "what
happened last time the tape looked like this?" - with an audit trail: every claim carries its
source, and anything that could not be verified is stated plainly instead of being smoothed over.

### Part 3 - Validation data and key metrics

*Tool entry, so these are build-quality and coverage figures, labelled accordingly.*

| Metric | Value | Status |
|---|---|---|
| End-to-end research request (question to memo, warm caches) | **5.8 s** (was ~50 s) | **Observed** |
| Evidence streams per memo | 5 (fundamentals, technicals, news/sentiment, historical analogs, market structure) | **Observed** |
| Market-structure universe / shared sample | 494 assets, 250 shared daily sessions | **Observed** |
| Peer communities produced | 103, largest holding 17.4% of the universe | **Observed** |
| Sector separation check (banks, oil, gold-miners, semis cluster correctly) | 4 / 4 pass | **Observed** |
| Cross-source price agreement (Bitget MCP vs Yahoo, live) | -0.02% apart on AAPL | **Observed** |
| Automated checks in CI (`npm test`) | 50+ passing across 6 suites (language guard, prompt safety, math & RMT, security/data integrity, headline blending, news providers) | **Observed** |
| Active compliance & guard rules | 21 rules banning directional calls, influencer hype, unearned certainty, and coaching | **Observed** |
| Data sources wired and live | Bitget `bitget-mcp-server` (quote, market sentiment), SEC EDGAR XBRL, Yahoo Finance, Alpha Vantage, You.com Web Search, Google News RSS, X API v2, Adanos | **Observed** |
| Distinct users / task completion / retention | - | **Not yet measured** (no external users yet) |
| Judge-visible demo completion | one full research task, question to actionable memo | **Observed** |

What proves effective usage: for a tool entry the honest next step is a public demo plus a small
user cohort during the judging window, measuring how many traders run a full stress test per
session and whether they return. If we reach users before 27 September we replace "not yet
measured" with observed figures rather than estimates.
### Part 4 - Progress

**Built and running:** five-pillar research pipeline over live data; one-click demo walkthrough;
SSE progress streaming; precomputed RMT market-structure snapshot with a scheduled daily refresh
(GitHub Actions, 05:15 UTC); per-provider caching and a single aggregated availability notice; a
language guard with 21 active rules that strips directional, hype, and verdict language from model output; 50+ automated checks across 6 suites;
security headers, bounded request bodies, URL-secret redaction in upstream errors.

**Deliberately removed, with the measurement recorded:** a third-party `bitget-signal` news feed -
measured at ~23 s per call returning 44 crypto-only feeds with every item array empty. It cost a
permanent false alarm in the memo and the slowest leg of the fetch window. A single-linkage
clustering implementation was also replaced after it collapsed 490 of 494 assets into one
meaningless "community".

**Problems hit and fixed:** a 69-session correlation sample (one recently-listed name collapsed the
whole window, so we added a minimum-history admission rule - now 250 sessions); near-duplicate
headlines across publishers (content and URL fingerprinting); a build/dev shared-output-directory
conflict that returned 500s; optional-provider quota exhaustion (caching plus honest disclosure).

**Next steps:** wire the remaining `bitget-mcp-server` catalog entries (historical OHLCV for the
structure precompute, analyst estimates, institutional and insider ownership, ETF holdings);
financial news search once its label taxonomy is documented; a user cohort to replace the
unmeasured usage metrics.

### Part 5 - Deliverables (what goes in "Submission Materials Link")

1. Live demo: https://precedent-liard-eight.vercel.app/ (recommended-walkthrough button on load).
2. Screen recording of one complete research task, question to memo.
3. Public source repository with README.md (architecture, method, measurements) and the scheduled
   precompute workflow.
4. This document.

### Part 6 - Our take on AI Trading (optional)

The division of labour we converged on: models are good at *structure* - reading filings,
normalising heterogeneous feeds, explaining a distribution, catching that two sources disagree -
and bad at *restraint*. Our most valuable engineering was not adding intelligence but adding
refusals: no blended conviction score, no fabricated field, no silent averaging of conflicting
sources, and a hard rule that the LLM may never produce a trade instruction. For a research tool
whose users make their own decisions, that is the product.

---

## 2 - "Role of the LLM in Your Project" (separate form field)

The LLM is a **constrained synthesis and explanation layer, never a decision-maker.**

- **What it does:** merges the five structured evidence pillars into one memo; rewrites headlines
  into plain language; generates the reflection questions; flags tension between sources.
- **What it is forbidden to do:** emit BUY/SELL/hold language, verdicts, success probabilities, or
  any number that is not already present in retrieved evidence. A deterministic language guard
  scrubs prohibited patterns, and a deterministic fallback memo runs if the model fails or exceeds
  its budget - the pipeline never returns an unverified memo.
- **Models:** **Qwen (`qwen3.8-27b`) via the Bitget hackathon gateway** is the primary synthesis
  model, with OpenRouter / OpenAI / xAI in the waterfall and a deterministic synthesizer as the
  floor. Free models are attempted first when no paid key is configured.
- **Qwen usage:** the primary memo writer, carrying the full five-pillar prompt. Observed
  constraint: it is a reasoning model, so long prompts are latency-sensitive - we cap reasoning
  effort to keep a full memo inside the deadline, and the deterministic fallback exists precisely
  because free-model timeouts are normal.
- **Determinism where it matters:** every quantitative result (correlations, distributions,
  coverage, staleness) is computed in TypeScript. The model never computes a statistic.
---

## 3 - X Promotional Post (required - must quote the official post)

**Compliance checklist:** must include `#BitgetHackathon` and `@Bitget_AI`, must **quote**
https://x.com/Bitget_AI/status/2100519318824055159 , and must be an interactive product intro
rather than a bare link. *No X post = incomplete submission.*

> **Draft**
>
> US equities close at 4pm. Your rToken does not.
>
> So what actually happened last time the tape looked like this - and where do the sources
> disagree?
>
> **Precedent** is a research workbench for tokenized US stocks. You ask a real question; it pulls
> five evidence streams - SEC filings, the 24/7 venue tape versus the cash session, news and
> sentiment, 10 years of historical analogs, and precomputed market structure - and returns a memo
> showing the *distribution*, not an opinion.
>
> Built on Bitget's own `bitget-mcp-server` for first-party US equity data. No BUY. No SELL. No
> fabricated numbers. Every claim carries its source, and anything we could not verify is printed
> as a caveat instead of being quietly smoothed over.
>
> Live demo: https://precedent-liard-eight.vercel.app/
>
> What would you stress-test first?
> #BitgetHackathon @Bitget_AI

---

## 4 - Pre-submit checklist

- [ ] X post published, **quoting** the official post, with `#BitgetHackathon` + `@Bitget_AI`
- [ ] Google Form submitted (deadline 27 Sep, UTC+8): https://forms.gle/GyWZCMCPocgJdJon6
- [ ] Track: **AI Trading Desk** -> sub-theme **Decision Stress Testing**
- [ ] Project Description = section 1 (parts 1-5; part 6 optional)
- [ ] Role of the LLM = section 2
- [ ] Submission Materials Link contains an **accessible demo** (a GitHub repo or X post alone is
      explicitly not accepted) plus a screen recording
- [ ] Optional: University Name (separate prize pool), Apply for Demo Day, Apply for K3 Token Subsidy
- [ ] Optional: a second entry in another theme (separate form, independent materials)