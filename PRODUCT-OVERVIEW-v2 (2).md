# Precedent v2 – Product & Engineering Overview

**AI Trading Desk / Decision Stress Testing · Bitget AI Base Camp Hackathon S2**

This document is the single source of truth for the reshaped product. It replaces the original overview and incorporates:

- Full Market Structure (RMT) pillar
- Regime detection that frames every briefing
- Upgraded Historical Analogs (regime- + community-conditioned)
- Structure & Fundamentals flags (research-only, evidence-only — no blended scores)
- Expanded Sentiment pillar (X + YouTube + existing news)
- Exact TypeScript contracts and pseudo-code for the new Sentiment providers and pillar

> **Change log vs. the previous draft:** dropped the two blended 0–100 "Quantamental" scores in favor of separate labeled flags (see §10) — a single composite number collapses disagreeing evidence into one figure, which contradicts Principle 3.2 below. Regime labels were renamed from bullish/bearish to neutral structural terms (see §6) so the framing never reads as directional. Implementation priority (§14) now puts the Market Structure pillar and regime-conditioned analogs ahead of the social providers, since that's the differentiated core, not the social layer.

---

## 1. Product summary

Precedent is a natural-language research workbench for tokenized US stocks (rTokens) traded on Bitget.

A trader supplies:

- operating style (day / swing / event / position)
- an rToken or underlying symbol
- a concrete research question

The system gathers five evidence streams in parallel, detects the current market regime, and produces one reasoned briefing that deliberately contains **no trading signal**. The human trader remains responsible for the final decision.

Central idea (unchanged):

> Research first. Decide yourself.

---

## 2. Target user

Self-directed retail traders trading Bitget rTokens who lack institutional research access and need to stress-test setups across the 7×24 rToken window versus the underlying cash session.

---

## 3. Product principles

1. Evidence before impulse
2. One pipeline, one memo
3. Historical analogs + market structure are the dual anchors
4. The human retains the decision
5. No bare directional signal (BUY / SELL / LONG / SHORT forbidden)
6. Graceful degradation — missing data is labelled, never invented

---

## 4. Required briefing structure

Every completed research response follows this exact structure:

### 01. Evidence

- Fundamentals (SEC, EPS, revenue, 8-K catalysts)
- Technicals + rToken vs cash venue print
- News headlines + lean
- **X discourse** (recent posts + engagement-weighted lean)
- **YouTube discourse** (recent video titles + top comments)
- **Market Structure (RMT)** snapshot: market-mode strength, community membership, cleaned vs raw correlations
- **Structure & Fundamentals flags** (see §10) — separate labeled flags, never a blended score

### 02. Tension

- Classic disagreements (momentum vs news, analog dispersion, missing rToken print)
- News lean vs X lean
- High X volume with mixed lean
- Raw technical signal vs cleaned RMT community structure
- Regime mismatch with recent history
- Community concentration risk

### 03. Historical Analog (stress-test core)

- Current Chart Library state
- Closest analogs that also share similar RMT community **or** similar regime label
- Forward excess-return bands (1 / 5 / 10 cash sessions)
- Sample size, p10 / median / p90, share of positive outcomes
- Explicit caveats: historical sample under comparable structure/regime conditions — not a forecast

### 04. Considerations for the trader

- Style-adapted implications
- Regime-aware notes
- Community concentration warnings
- Invalidation conditions
- Ends with questions only

---

## 5. High-level architecture

```text
Browser UI
  │
  │ POST /api/research
  ▼
Research API route
  │
  ▼
Research pipeline
  │
  ├── Regime Detector (runs once)
  │
  ├── Fundamentals pillar
  ├── Technicals + Venue pillar
  ├── News & Sentiment pillar          ← X + YouTube + Yahoo/Google
  ├── Market Structure pillar (RMT)    ← NEW
  └── Historical Analogs pillar        ← upgraded (regime + community)
  │
  ▼
Synthesis layer (LLM or deterministic fallback)
  │
  ▼
Language guard
  │
  ▼
Server-sent events → Unified frontend memo
```

---

## 6. Regime Detector

Lightweight classifier that runs once at the start of every research run.

**Inputs**

- Recent returns and realized volatility of the target + peers
- Market-mode eigenvalue intensity (from RMT pillar)
- Optional aggregate news/X lean

**Output**

```ts
type Regime = "trending-up" | "range-bound" | "trending-down" | "high-systemic" | "normal" | "low-systemic";
```

Labels describe market *structure* (trend direction of the tape, systemic-risk intensity), not a call on what happens next — this keeps the regime label from reading as directional guidance even though it isn't one of the forbidden words in §11.

The detected regime is attached to the meta event and used to:

- frame the entire memo
- condition the analog search
- surface regime-related tensions

---

## 7. Market Structure pillar (RMT) – NEW

**Purpose**  
Separate random noise, systemic (market) mode, and stable mesoscopic/community structure so the trader can see the cleaned relationships that actually matter.

**Peer-set size matters.** RMT filtering only reliably separates signal from noise once the peer universe is large enough — published tests found it gave little or no benefit (and sometimes made things worse) on portfolios of 15–39 assets, but worked well at S&P-500 scale (400+ assets). Bitget currently lists 500+ rTokens, which is comfortably in the range where this technique holds up — so the pillar should **not** run on a small ad-hoc basket per query.

**Core steps**

1. **Precompute, on a schedule (not per-query):** build the correlation matrix across the full rToken universe (or its underlying cash equities, using the same Yahoo historical-bars source as the Technicals pillar), apply Marcenko-Pastur filtering, and run community detection once (e.g. nightly). Store each asset's community membership and noise/signal split.
2. Isolate the largest eigenvalue (market mode) from that precomputed run.
3. Identify intermediate eigenvalues that survive filtering → mesoscopic communities.
4. **At query time:** look up the target rToken's precomputed community and cleaned correlations — this is a fast lookup, not a live decomposition.
5. Report:
   - market-mode strength
   - community the target belongs to
   - cleaned pairwise correlations to key peers
   - the percentage of the target's local correlation structure that survived noise-filtering (e.g. "≈15% of this rToken's eigenstructure carries information beyond noise") — a concrete, judge-checkable number
   - short stability note across recent windows

**Degradation**  
If the precomputed universe is too small (e.g. a new rToken with limited history) or correlation data is otherwise insufficient → `ok: false` + a caveat naming the peer-count shortfall. Synthesis continues with the other four pillars.

---

## 8. Historical Analogs pillar – UPGRADED

Still powered by Chart Library + Yahoo forward returns, but now conditioned:

- Prefer analogs that share the same (or nearest) RMT community **or** the same regime label.
- If community/regime data is missing, fall back to pure chart-shape analogs and state the caveat.

This is the primary Decision Stress Testing mechanism.

---

## 9. Sentiment pillar – EXPANDED (X + YouTube)

### 9.1 TypeScript contracts

```ts
// lib/types.ts (relevant additions)

export type Lean = "constructive" | "cautious" | "mixed" | "neutral";

export interface SocialPost {
  id: string;
  platform: "x";
  text: string;
  author: string;
  url: string;
  createdAt: string;          // ISO
  metrics: {
    likes?: number;
    reposts?: number;
    replies?: number;
    views?: number;
  };
  lean: Lean;
  engagementScore: number;    // simple weighted score for ranking
}

export interface YouTubeItem {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
  publishedAt: string;
  viewCount?: number;
  topComments: {
    text: string;
    lean: Lean;
    likeCount?: number;
  }[];
  overallLean: Lean;
}

export interface SentimentResult {
  ok: boolean;
  headlines: Headline[];               // existing Yahoo/Google
  social: {
    x: SocialPost[];
    youtube: YouTubeItem[];
  };
  aggregateLean: Lean | "insufficient";
  volumeNote?: string;                 // e.g. "X volume elevated vs recent baseline"
  caveats: string[];
  sources: string[];                   // ["x", "youtube", "yahoo", "google-news"]
}
```

### 9.2 Provider pseudo-code

```ts
// lib/providers/x-sentiment.ts
export async function fetchXSentiment(
  query: string,           // ticker + company + rToken variants
  options: { maxPosts?: number; hours?: number } = {}
): Promise<{ posts: SocialPost[]; caveat?: string }> {
  const max = options.maxPosts ?? 20;
  const hours = options.hours ?? 48;

  try {
    // Prefer environment X tools (x_keyword_search / x_semantic_search)
    // Fallback to official X API only if configured
    const raw = await searchXPosts({
      query: `(${query}) lang:en -is:retweet`,
      maxResults: max,
      sinceHours: hours,
      sort: "engagement"
    });

    const posts = raw.map(p => ({
      id: p.id,
      platform: "x" as const,
      text: p.text,
      author: p.author,
      url: p.url,
      createdAt: p.createdAt,
      metrics: p.metrics,
      lean: classifyLean(p.text),          // keyword + simple heuristic
      engagementScore: scoreEngagement(p.metrics)
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, max);

    return { posts };
  } catch (err) {
    return { posts: [], caveat: "X discourse unavailable" };
  }
}
```

```ts
// lib/providers/youtube-sentiment.ts
export async function fetchYouTubeSentiment(
  query: string,
  options: { maxVideos?: number } = {}
): Promise<{ items: YouTubeItem[]; caveat?: string }> {
  const max = options.maxVideos ?? 6;

  try {
    // Official YouTube Data API v3
    // 1. search.list (title + description) – watch daily quota
    // 2. commentThreads.list for top comments (cheap)
    const videos = await searchYouTubeVideos(query, max);
    const items: YouTubeItem[] = [];

    for (const v of videos) {
      const comments = await fetchTopComments(v.videoId, 4);
      const commentLeans = comments.map(c => ({
        text: c.text,
        lean: classifyLean(c.text),
        likeCount: c.likeCount
      }));

      items.push({
        videoId: v.id,
        title: v.title,
        channelTitle: v.channelTitle,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        publishedAt: v.publishedAt,
        viewCount: v.viewCount,
        topComments: commentLeans,
        overallLean: majorityLean([classifyLean(v.title), ...commentLeans.map(c => c.lean)])
      });
    }

    return { items };
  } catch (err) {
    return { items: [], caveat: "YouTube discourse unavailable (quota or API error)" };
  }
}
```

### 9.3 Pillar orchestration (pseudo-code)

```ts
// lib/pillars/sentiment.ts
export async function runSentimentPillar(
  asset: NameCard,
  question: string
): Promise<SentimentResult> {
  const query = buildSearchQuery(asset);   // "AAPL OR Apple OR rAAPL OR RAAPLUSDT"

  const [newsResult, xResult, ytResult] = await Promise.all([
    fetchNewsHeadlines(asset),             // existing Yahoo + Google
    fetchXSentiment(query),
    fetchYouTubeSentiment(query)
  ]);

  const caveats: string[] = [];
  if (xResult.caveat) caveats.push(xResult.caveat);
  if (ytResult.caveat) caveats.push(ytResult.caveat);

  const allLeans = [
    ...newsResult.headlines.map(h => h.lean),
    ...xResult.posts.map(p => p.lean),
    ...ytResult.items.map(i => i.overallLean)
  ].filter(Boolean);

  const aggregateLean = allLeans.length
    ? majorityLean(allLeans)
    : "insufficient";

  const volumeNote = detectVolumeSpike(xResult.posts);  // optional simple check

  return {
    ok: newsResult.ok || xResult.posts.length > 0 || ytResult.items.length > 0,
    headlines: newsResult.headlines,
    social: {
      x: xResult.posts,
      youtube: ytResult.items
    },
    aggregateLean,
    volumeNote,
    caveats,
    sources: [
      ...(newsResult.sources || []),
      ...(xResult.posts.length ? ["x"] : []),
      ...(ytResult.items.length ? ["youtube"] : [])
    ]
  };
}
```

### 9.4 Future work (explicitly out of scope for MVP)

- Instagram Graph API / hashtag search
- Facebook public post search

Both require Meta business verification and carry high rate-limit / permission risk. They remain documented future extensions only.

---

## 10. Structure & Fundamentals flags (research-only)

**Deliberately not a blended score.** An earlier draft of this section combined multiple disagreeing evidence streams into two composite 0–100 numbers. That contradicts Principle 3.2 ("don't hide disagreement or collapse it into one score — expose what the trader has to weigh") almost exactly: a single number that's high or low functions as an implicit confidence signal in the trader's head regardless of how it's labeled, even in an "evidence only, never a recommendation" section. It also invites the same collapsing-of-tension that the Tension section exists to prevent.

Instead, each underlying signal is shown as its own labeled flag, left unresolved against the others:

- Catalyst density: `high` / `moderate` / `low` (from 8-K frequency + earnings proximity)
- Balance-sheet flags: plain-language list (e.g. "rising leverage", "improving margins") — no rollup
- Regime alignment: `aligned` / `misaligned` (does recent price action match the detected regime?)
- RMT community stability: `stable` / `unstable` across recent windows
- Cleaned-correlation rank: the target's percentile position within its community (a number, but a descriptive one — not a score of the asset itself)
- Analog base-rate quality: sample size + whether outcomes cluster or scatter

Each flag is independently falsifiable and stays in the trader's hands to weigh. None are combined. Language guard still strips any directional language from the surrounding prose.

---

## 11. Language guard (unchanged rules, broader surface)

Still forbids:

- BUY / SELL / LONG / SHORT as headline or final recommendation
- Confidence percentages used as a verdict

Now also scans the new social evidence fields and the Structure & Fundamentals flag descriptions (§10).

---

## 12. Session flow (updated)

1. Trader chooses style
2. Selects rToken
3. Asks concrete question
4. Frontend POSTs to `/api/research`
5. Pipeline resolves asset
6. Regime Detector runs once
7. Five pillars execute in parallel
8. Streaming status events
9. Synthesis + language guard
10. Unified memo rendered
11. Trader records own decision note (client-side only)

---

## 13. Demo script (recommended)

> “I am a swing trader. Stress-test the current rAAPL setup into next week, especially the 7×24 window versus the cash session. What did historically similar charts do under comparable market-structure and regime conditions, and where do the pillars disagree — including social discourse on X and YouTube?”

Show:

- Style selection
- Live pillar statuses (including Market Structure and Social)
- Evidence that cites X posts and YouTube titles
- Tension that surfaces news-vs-X disagreement and RMT community notes
- Regime-conditioned historical analogs
- Considerations that end in questions
- Human decision note

---

## 14. Implementation priority (hackathon-realistic)

Ordered by what actually differentiates the product — the Market Structure pillar and regime-conditioned analogs are the demo's spine and should survive any time crunch; the social providers are table-stakes and are the first things to cut if the clock runs out.

**Must-have for demo**

1. Market Structure pillar, precomputed across the real rToken universe (not a small live-computed basket — see §7)
2. Regime Detector (simple version, neutral labels)
3. Condition analog search on regime and/or community
4. Structure & Fundamentals flags (§10) — cheap to compute, reinforces the no-blended-score principle
5. Updated synthesis prompt + memo rendering of new fields
6. X sentiment provider (single social source, if time allows)

**Nice-to-have**

- YouTube sentiment provider
- Full Louvain community detection (vs. a simplified clustering pass on the precomputed matrix)
- Volume-spike detection on X
- Visual eigenvalue / community plots

---

## 15. Non-goals (still strictly enforced)

- Order placement or position management
- Autonomous trading agent
- Bare directional recommendations
- Fabricating missing social posts, RMT communities, or analog dates
- Blended composite scores that collapse disagreeing evidence into a single confidence-like number (see §10)

---

## 16. Quick start reminder

```bash
npm install
npm run dev
# → http://localhost:3000
```

Useful endpoints remain:

- `GET /api/universe`
- `POST /api/research`

---

## 17. Team decisions still needed

1. What peer-set size / universe will the precomputed Market Structure job actually run on for the demo (full 500+ rTokens vs. a documented smaller sample), and who owns that data pipeline?
2. How often does the precompute job re-run before the demo (nightly vs. once, frozen)?
3. Which LLM provider powers the synthesis layer for the recorded demo?
4. Is X access available at demo time (API tier / rate limits), or should the demo assume the "unavailable" caveat path for that provider?
5. Final hosted URL and submission materials link — who owns the demo recording and hackathon form?

---

## 18. Recommended validation metrics

In addition to the metrics from the v1 doc (task-completion time, pillar-availability rate, analog retrieval count, output-safety rate), add one from the Market Structure pillar directly:

- **Percentage of eigenstructure surviving noise-filtering**, reported per rToken and averaged across the demo universe (e.g. "≈11% of the eigenvalues in our rToken correlation matrix carry information beyond noise, consistent with published findings on comparable-scale equity markets") — a concrete, independently checkable number that doubles as a validation claim and a differentiator in the submission write-up.
- **Community stability across rolling windows** — how often a given rToken's community assignment changes week-to-week; more stability is a reliability signal for the analog-conditioning logic.

These are for judging and product learning, not for marketing a win rate or backtested performance claim.

---

**This is now the working product definition for Precedent v2.**

Next concrete actions available on request:

- Generate the actual TypeScript files for the new providers and pillar
- Produce the updated synthesis prompt
- Create a sample full briefing JSON that includes the new social + RMT evidence
- Prioritised file-change list for the existing codebase
