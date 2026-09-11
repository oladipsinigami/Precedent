# Precedent v2 – Product & Engineering Overview

**AI Trading Desk / Decision Stress Testing · Bitget AI Base Camp Hackathon S2**

This document is the single source of truth for the reshaped product. It replaces the original overview and incorporates:

- Full Market Structure (RMT) pillar
- Regime detection that frames every briefing
- Upgraded Historical Analogs (regime- + community-conditioned)
- Quantamental scoring layer (research-only)
- Expanded Sentiment pillar (X + YouTube + existing news)
- Exact TypeScript contracts and pseudo-code for the new Sentiment providers and pillar

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
- Quantamental scores (Fundamental+Sentiment score and Quantitative Structure score) shown as evidence only

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
type Regime = "bullish" | "ranging" | "bearish" | "high-systemic" | "normal" | "low-systemic";
```

The detected regime is attached to the meta event and used to:

- frame the entire memo
- condition the analog search
- surface regime-related tensions

---

## 7. Market Structure pillar (RMT) – NEW

**Purpose**  
Separate random noise, systemic (market) mode, and stable mesoscopic/community structure so the trader can see the cleaned relationships that actually matter.

**Core steps**

1. Build correlation matrix of the target rToken + a peer set (other major rTokens + their cash underlyings).
2. Apply Marcenko-Pastur filtering to remove the random bulk.
3. Isolate the largest eigenvalue (market mode).
4. Identify intermediate eigenvalues that survive filtering → mesoscopic communities.
5. Report:
   - market-mode strength
   - community the target belongs to
   - cleaned pairwise correlations to key peers
   - short stability note across recent windows

**Degradation**  
If correlation data is insufficient → `ok: false` + clear caveat. Synthesis continues with the other four pillars.

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

## 10. Quantamental scoring layer (research-only)

Two internal scores appear in the Evidence section only:

- **Fundamental + Sentiment Score** (0–100)  
  Earnings quality, balance-sheet flags, catalyst density, news + X + YouTube lean.

- **Quantitative Structure Score** (0–100)  
  Regime alignment, RMT community stability, cleaned-correlation rank, analog base-rate quality.

These scores are never turned into a recommendation. Language guard still strips any directional language.

---

## 11. Language guard (unchanged rules, broader surface)

Still forbids:

- BUY / SELL / LONG / SHORT as headline or final recommendation
- Confidence percentages used as a verdict

Now also scans the new social evidence fields and quantamental score descriptions.

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

**Must-have for demo**

1. Regime Detector (simple version)
2. Market Structure pillar on a fixed peer basket
3. X sentiment provider + YouTube provider
4. Condition analog search on regime (community optional if time is tight)
5. Updated synthesis prompt + memo rendering of new fields

**Nice-to-have**

- Full community detection (Louvain on cleaned matrix)
- Quantamental score cards
- Volume-spike detection on X
- Visual eigenvalue / community plots

---

## 15. Non-goals (still strictly enforced)

- Order placement or position management
- Autonomous trading agent
- Bare directional recommendations
- Fabricating missing social posts, RMT communities, or analog dates

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

**This is now the working product definition for Precedent v2.**

Next concrete actions available on request:

- Generate the actual TypeScript files for the new providers and pillar
- Produce the updated synthesis prompt
- Create a sample full briefing JSON that includes the new social + RMT evidence
- Prioritised file-change list for the existing codebase
