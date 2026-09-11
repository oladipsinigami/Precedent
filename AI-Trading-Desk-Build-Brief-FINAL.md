# AI Trading Desk — Build Brief (FINAL)
**Bitget AI Base Camp Hackathon S2 · Track 3 (AI Trading Desk / AI Research Workbench)**  
Deadline: September 21, 2026 (UTC+8) — 12 days from brief date (Sep 9)

---

## 1. What This Is

A natural-language research workbench for tokenized US stocks (rToken) and related contracts. The AI gathers and synthesizes fundamental data, technical signals, news/sentiment, and historically similar chart patterns — then hands the trader a reasoned briefing. **The human makes the trade decision. The AI never executes and never outputs a bare BUY/SELL.**

This is being built for Track 3 of the Bitget AI Base Camp Hackathon S2. Track 3's positioning, verbatim from the handbook:  
> "A natural-language-driven AI research workbench. AI processes information, invokes tools, and presents analysis; human traders make final decisions."

## 2. Target User (required — do not leave generic)

**Self-directed retail traders trading tokenized US stocks (rToken) who lack institutional research access** (no Bloomberg terminal, no dedicated analyst desk). They already know how to execute trades but cannot run multi-factor research quickly enough for the 7×24 rToken window.

**Product mechanism that serves this segment**  
At the start of every session the workbench asks the trader what style they are operating in (day trader / swing trader / event-driven-macro / position). Depth, time horizon, language, and framing of every subsequent output are adjusted to match. This intake step is a feature, not a substitute for naming the segment clearly on the submission form.

## 3. The Four Pillars + Synthesis Layer

Do **not** build four separate parallel dashboards. Build one pipeline in which each pillar feeds a single synthesis step.

1. **Fundamental Analysis** — earnings surprises, guidance changes, balance-sheet red flags, upcoming catalysts for the underlying company behind the rToken.
2. **Technical Analysis** — trend, momentum, volatility, key support/resistance on both the rToken and the native stock.
3. **News / Sentiment** — recent equity-relevant headlines + macro events that can move the name (supplement pure crypto sentiment with equity news).
4. **Historical Pattern Matching** (Decision Stress Testing sub-theme) — locate the 3–5 most similar historical chart setups (same ticker or cross-ticker) and show what happened next. This is the least-crowded, highest-differentiation pillar — treat it as the **anchor**.
5. **Synthesis Layer** — combines all four into one narrative: evidence, tension (where signals disagree), historical base rates, and open considerations for the trader. Ends with questions the trader should weigh, never a verdict.

## 4. Output / UX Rule (non-negotiable)

Every response **must** follow this structure:

- **Evidence** — what fundamentals / technicals / news / history actually show (cited)
- **Tension** — where the signals disagree
- **Historical analog** — 3–5 most similar past setups and their outcomes (framed as base rates, not predictions)
- **Considerations for the trader** — implications for the stated trading style + what would invalidate the thesis

**Hard constraint (add to system prompt / post-processor)**  
Never use the words BUY, SELL, LONG, SHORT, or any confidence percentage as a headline or final recommendation. If the model generates them, strip or rewrite before display. This single rule is what separates a research workbench from an undercooked agent.

## 5. What NOT to Build (non-goals)

- No order placement, no execution, no autonomous position management → Track 2
- No paper-trading log requirement → Track 3 does not need one
- No win-rate or backtested Sharpe as a selling point → Track 1 territory
- Never write “all traders” anywhere in the submission form

## 6. Suggested Build Order (12-day window)

**Days 1–2 — Feasibility spike (not feature build)**  
Goal: know which pillars are plug-and-play vs which need real engineering.

| Pillar                  | Risk Level   | Action |
|-------------------------|--------------|--------|
| Technical + News/Sentiment | Near-zero | Use Bitget `bitget-signal` skills immediately |
| Fundamentals            | Medium       | Spike SEC/earnings pull first. Have a lightweight fallback ready (earnings headlines + guidance language only) if full 10-K/10-Q parsing proves too brittle |
| Pattern Matching        | Medium–High  | Prefer Chart Library API (or equivalent) over building DTW/correlation from scratch. Only need 3–5 good analogs for a compelling demo |

**Days 3–9 — Core build**  
Anchor everything on the historical pattern-matching pillar. The other three pillars exist only to feed the synthesis layer.

**Days 10–11 — Demo & polish**  
Script and record **one** complete research task (see Section 8). Make the demo accessible (no heavy login walls preferred; recorded walkthrough + lightweight hosted version is safest).

**Day 12 (Sep 21) — Submit**  
Full buffer day for X post, form fields, link checks, and final QA.

## 7. Data Sources & Tools Per Pillar

### Fundamental Analysis
- Bitget Agent Hub (MCP + CLI + Skills) — https://github.com/BitgetLimited/agent_hub
- XVARY Stock Research (Claude Code skill, SEC EDGAR) — https://github.com/xvary-research/claude-code-stock-analysis-skill
- edgartools (SEC EDGAR MCP, no API key) — https://github.com/dgunning/edgartools
- sec-edgar-mcp — https://github.com/stefanoamorelli/sec-edgar-mcp
- Financial Modeling Prep MCP — https://github.com/imbenrabi/Financial-Modeling-Prep-MCP-Server
- FRED MCP (macro context) — https://github.com/stefanoamorelli/fred-mcp-server  
**Fallback rule**: If full filings are slow or unstable, degrade gracefully to recent earnings headlines + guidance language.

### Technical Analysis
- Bitget `bitget-signal` → `technical-analysis` (23 indicators, no key required)
- TradingView MCP — https://github.com/atilaahmettaner/tradingview-mcp
- Alpha Vantage MCP — https://github.com/alphavantage/alpha_vantage_mcp

### News / Sentiment
- Bitget `bitget-signal` → `news-briefing`
- Bitget `bitget-signal` → `sentiment-analyst` (crypto-leaning; always supplement with equity news)

### Historical Pattern Matching (anchor)
- **Preferred**: Chart Library (visual pattern search + REST/MCP, 24M+ embeddings) — https://chartlibrary.io  
  Use this to bootstrap the demo instead of building a similarity engine from scratch.
- In-house fallback (only if API unavailable): rolling-window correlation or DTW on OHLC — spike for one day max.

### Architecture / Prior Art (study, do not copy wholesale)
- OpenBB — https://github.com/OpenBB-finance/OpenBB
- TradingAgents — https://github.com/TauricResearch/TradingAgents
- FinRobot — https://github.com/AI4Finance-Foundation/FinRobot
- QuantLink (commercial reference) — https://www.quantlink.ai

## 8. What the Demo Must Show

Track 3 requires an **accessible demo** + **one complete research task**.

Script this exact flow:

1. Trader states style (e.g. “I’m a swing trader”).
2. Trader asks a concrete research question about a specific rToken.
3. Workbench pulls fundamentals + technicals + news + historical analogs.
4. Workbench returns the four-part synthesis (Evidence → Tension → Historical analog → Considerations) — never a signal.
5. Trader is shown making their own decision based on that briefing.

This single airtight example is the first thing judges will examine. Build everything else around it.

## 9. Submission Requirements Checklist

- [ ] Project Description (six parts: Thesis, Target user, Validation data/metrics, Progress, Deliverables, optional AI-trading take)
- [ ] “Role of the LLM in Your Project” — name models and what each does
- [ ] Submission Materials Link (demo + code + video/docs in one place)
- [ ] X Promotional Post Link — must contain `#BitgetHackathon` + `@Bitget_AI` and actually introduce the product
- [ ] Track → Sub-theme: **Decision Stress Testing** (recommended) or Open Theme
- [ ] University Name (only if applicable)
- [ ] Apply for Demo Day (check it — no downside)

**Validation metrics note (Track 3)**  
Even though scoring is pure judge subjective, still write concrete numbers or plans in the form (e.g. task completion time, number of pillars successfully retrieved, qualitative feedback from 3–5 test users). Do not leave the section empty.

## 10. Key Links

| Purpose | Link |
|---------|------|
| Submission form | https://forms.gle/GyWZCMCPocgJdJon6 |
| Official handbook (source of truth) | https://bitget-ai.gitbook.io/bitgetai_hackathons2/ |
| Bitget Agent Hub | https://github.com/BitgetLimited/agent_hub |
| Official Telegram | https://t.me/+o1tYqQ_lXxllYjgy |
| Qwen Token credits (first 300 teams) | https://forms.gle/2QeJpvGB5VpipqQ68 |
| Agentic account setup | https://www.bitget.careers/support/articles/12560603894122 |
| Official X | https://x.com/Bitget_AI |

---

**Final instruction to the coding agent**  
Treat the output-structure rule and the “no BUY/SELL language” constraint as hard product requirements, not suggestions. Prefer the Chart Library API for the pattern-matching pillar. Spike fundamentals early and keep a lightweight fallback ready. The single demo research task must be airtight before any extra features are added.

This document is the single source of truth for the build.
