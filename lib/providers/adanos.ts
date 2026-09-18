import { fetchJson } from "../http";
import type { Lean, SocialPost } from "../types";
import { classifyLean, scoreEngagement } from "./social";

export type AdanosTopMention = {
  text_snippet: string;
  sentiment_score?: number;
  sentiment_label?: string;
  upvotes?: number;
  subreddit?: string;
  created_utc?: string;
};

export type AdanosRedditSentiment = {
  ticker: string;
  company_name?: string;
  found: boolean;
  buzz_score?: number;
  mentions?: number;
  sentiment_score?: number;
  positive_count?: number;
  negative_count?: number;
  neutral_count?: number;
  total_upvotes?: number;
  unique_posts?: number;
  subreddit_count?: number;
  trend?: string;
  bullish_pct?: number;
  bearish_pct?: number;
  period_days?: number;
  top_subreddits?: { subreddit?: string; name?: string; count?: number; mentions?: number; sentiment_score?: number; buzz_score?: number }[];
  top_mentions?: AdanosTopMention[];
};

export type AdanosTopTweet = {
  text_snippet: string;
  sentiment_score?: number;
  sentiment_label?: string;
  likes?: number;
  retweets?: number;
  views?: number;
  author?: string;
  created_at?: string;
};

export type AdanosXSentiment = {
  ticker: string;
  company_name?: string;
  found: boolean;
  buzz_score?: number;
  mentions?: number;
  sentiment_score?: number;
  positive_count?: number;
  negative_count?: number;
  neutral_count?: number;
  total_upvotes?: number;
  unique_tweets?: number;
  trend?: string;
  bullish_pct?: number;
  bearish_pct?: number;
  period_days?: number;
  top_tweets?: AdanosTopTweet[];
  top_authors?: { author: string; mentions: number }[];
};

export type AdanosPolymarketSentiment = {
  ticker: string;
  found: boolean;
  sentiment?: "bullish" | "bearish" | "neutral" | "mixed";
  confidence?: number;
  why?: string[];
  warnings?: string[];
};

export type AdanosTrendingStock = {
  ticker: string;
  company_name?: string;
  buzz_score?: number;
  trend?: string;
  mentions?: number;
  unique_posts?: number;
  sentiment_score?: number;
  bullish_pct?: number;
  bearish_pct?: number;
  total_upvotes?: number;
  trend_history?: number[];
};

export type AdanosExplanationResponse = {
  ticker: string;
  company_name?: string;
  explanation: string;
  cached?: boolean;
  generated_at?: string;
};

export type AdanosSocialSummary = {
  ticker: string;
  found: boolean;
  buzzScore?: number;
  sentimentScore?: number;
  redditMentions?: number;
  xMentions?: number;
  bullishPct?: number;
  bearishPct?: number;
  topSubreddits?: string[];
  explanation?: string;
  xPosts: SocialPost[];
  redditPosts: SocialPost[];
  rawReddit?: AdanosRedditSentiment;
  rawX?: AdanosXSentiment;
};

/**
 * Normalizes input tickers or tokenized stock symbols (e.g. "rAAPL", "AAPLUSDT", "RAAPLUSDT")
 * to the underlying US equity ticker (e.g. "AAPL").
 */
export function normalizeTicker(symbol: string): string {
  let clean = symbol.trim().toUpperCase();
  clean = clean.replace(/USDT$/, "");
  if (/^R[A-Z]{1,5}$/.test(clean)) {
    return clean.slice(1);
  }
  return clean;
}

/**
 * Internal helper to query Adanos API endpoints.
 * Automatically respects 10-minute memory cache to protect free-tier monthly quotas.
 */
async function fetchAdanos<T>(
  path: string,
  extraParams: Record<string, string | number | undefined> = {},
): Promise<T | null> {
  const apiKey = process.env.ADANOS_API_KEY;
  if (!apiKey) return null;

  const queryParams = new URLSearchParams();
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined) queryParams.set(k, String(v));
  }
  const qs = queryParams.toString();
  const url = `https://api.adanos.org/${path.replace(/^\//, "")}${qs ? `?${qs}` : ""}`;

  try {
    const data = await fetchJson<T>(url, {
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      timeoutMs: 8_000,
      cacheTtlMs: 600_000, // 10 minutes cache to conserve monthly quota
    });
    if (data && typeof data === "object" && "detail" in (data as Record<string, unknown>)) {
      const detail = (data as Record<string, unknown>).detail;
      if (typeof detail === "string" && (detail.includes("API key") || detail.includes("rate limit"))) {
        console.warn("[adanos] API detail message:", detail);
        return null;
      }
    }
    return data;
  } catch (err) {
    console.warn(`[adanos] ${path} fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetches Reddit sentiment data and top mentions for a ticker.
 */
export async function adanosRedditSentiment(symbol: string): Promise<AdanosRedditSentiment | null> {
  const ticker = normalizeTicker(symbol);
  if (!ticker) return null;

  return fetchAdanos<AdanosRedditSentiment>(`reddit/stocks/v1/stock/${encodeURIComponent(ticker)}`);
}

/**
 * Fetches X (Twitter) sentiment data and top tweets for a ticker.
 */
export async function adanosXSentiment(symbol: string): Promise<AdanosXSentiment | null> {
  const ticker = normalizeTicker(symbol);
  if (!ticker) return null;

  return fetchAdanos<AdanosXSentiment>(`x/stocks/v1/stock/${encodeURIComponent(ticker)}`);
}

/**
 * Fetches Polymarket prediction market sentiment for a ticker.
 */
export async function adanosPolymarketSentiment(symbol: string): Promise<AdanosPolymarketSentiment | null> {
  const ticker = normalizeTicker(symbol);
  if (!ticker) return null;

  return fetchAdanos<AdanosPolymarketSentiment>(`polymarket/stocks/v1/stock/${encodeURIComponent(ticker)}`);
}

/**
 * Fetches AI explanation of why a stock is trending on social channels.
 */
export async function adanosExplain(
  symbol: string,
  platform: "reddit" | "x" = "reddit",
): Promise<string | null> {
  const ticker = normalizeTicker(symbol);
  if (!ticker) return null;

  const res = await fetchAdanos<AdanosExplanationResponse>(
    `${platform}/stocks/v1/stock/${encodeURIComponent(ticker)}/explain`,
  );
  return res?.explanation ?? null;
}

/**
 * Fetches trending stocks on Reddit or X.
 */
export async function adanosTrendingStocks(
  platform: "reddit" | "x" = "reddit",
  limit = 10,
): Promise<AdanosTrendingStock[]> {
  const data = await fetchAdanos<AdanosTrendingStock[]>(
    `${platform}/stocks/v1/trending`,
    { limit },
  );
  return Array.isArray(data) ? data : [];
}

/**
 * High-level helper for the News/Sentiment pillar: concurrently retrieves
 * Reddit sentiment, X sentiment, and AI trend explanation, then maps them into typed SocialPosts.
 */
export async function adanosSocialSummary(symbol: string): Promise<AdanosSocialSummary | null> {
  const apiKey = process.env.ADANOS_API_KEY;
  if (!apiKey) return null;

  const ticker = normalizeTicker(symbol);
  if (!ticker) return null;

  try {
    const [reddit, x, explain] = await Promise.all([
      adanosRedditSentiment(ticker).catch(() => null),
      adanosXSentiment(ticker).catch(() => null),
      adanosExplain(ticker, "reddit").catch(() => null),
    ]);

    if (!reddit && !x) {
      return null;
    }

    const xPosts: SocialPost[] = (x?.top_tweets ?? []).map((tw, idx) => {
      let lean: Lean = "neutral";
      if (tw.sentiment_score !== undefined) {
        if (tw.sentiment_score >= 0.15) lean = "constructive";
        else if (tw.sentiment_score <= -0.15) lean = "cautious";
        else {
          lean =
            tw.sentiment_label === "positive"
              ? "constructive"
              : tw.sentiment_label === "negative"
                ? "cautious"
                : classifyLean(tw.text_snippet);
        }
      } else if (tw.sentiment_label) {
        lean =
          tw.sentiment_label === "positive"
            ? "constructive"
            : tw.sentiment_label === "negative"
              ? "cautious"
              : classifyLean(tw.text_snippet);
      } else {
        lean = classifyLean(tw.text_snippet);
      }

      const author = tw.author || "market_voice";
      return {
        id: `adanos-x-${ticker}-${idx}`,
        platform: "x",
        text: tw.text_snippet,
        author,
        url: `https://x.com/${author}`,
        createdAt: tw.created_at || new Date().toISOString(),
        metrics: {
          likes: tw.likes,
          reposts: tw.retweets,
          views: tw.views,
        },
        lean,
        engagementScore: scoreEngagement({
          likes: tw.likes,
          reposts: tw.retweets,
          views: tw.views,
        }),
      };
    });

    const redditPosts: SocialPost[] = (reddit?.top_mentions ?? []).map((m, idx) => {
      let lean: Lean = "neutral";
      if (m.sentiment_score !== undefined) {
        if (m.sentiment_score >= 0.15) lean = "constructive";
        else if (m.sentiment_score <= -0.15) lean = "cautious";
        else {
          lean =
            m.sentiment_label === "positive"
              ? "constructive"
              : m.sentiment_label === "negative"
                ? "cautious"
                : classifyLean(m.text_snippet);
        }
      } else if (m.sentiment_label) {
        lean =
          m.sentiment_label === "positive"
            ? "constructive"
            : m.sentiment_label === "negative"
              ? "cautious"
              : classifyLean(m.text_snippet);
      } else {
        lean = classifyLean(m.text_snippet);
      }

      const sub = m.subreddit ? `r/${m.subreddit}` : "reddit";
      return {
        id: `adanos-reddit-${ticker}-${idx}`,
        platform: "reddit",
        text: m.text_snippet,
        author: sub,
        url: m.subreddit ? `https://reddit.com/r/${m.subreddit}` : "https://reddit.com",
        createdAt: m.created_utc || new Date().toISOString(),
        metrics: {
          likes: m.upvotes,
        },
        lean,
        engagementScore: (m.upvotes ?? 0) * 2,
      };
    });

    const buzzScores = [reddit?.buzz_score, x?.buzz_score].filter(
      (b): b is number => b !== undefined && b !== null,
    );
    const buzzScore = buzzScores.length
      ? buzzScores.reduce((a, b) => a + b, 0) / buzzScores.length
      : undefined;

    const sentimentScores = [reddit?.sentiment_score, x?.sentiment_score].filter(
      (s): s is number => s !== undefined && s !== null,
    );
    const sentimentScore = sentimentScores.length
      ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
      : undefined;

    const bullishPcts = [reddit?.bullish_pct, x?.bullish_pct].filter(
      (p): p is number => p !== undefined && p !== null,
    );
    const bullishPct = bullishPcts.length
      ? Math.round(bullishPcts.reduce((a, b) => a + b, 0) / bullishPcts.length)
      : undefined;

    const bearishPcts = [reddit?.bearish_pct, x?.bearish_pct].filter(
      (p): p is number => p !== undefined && p !== null,
    );
    const bearishPct = bearishPcts.length
      ? Math.round(bearishPcts.reduce((a, b) => a + b, 0) / bearishPcts.length)
      : undefined;

    const topSubreddits = (reddit?.top_subreddits ?? [])
      .map((s) => s.subreddit || s.name || "")
      .filter(Boolean);

    return {
      ticker,
      found: (reddit?.found ?? false) || (x?.found ?? false),
      buzzScore,
      sentimentScore,
      redditMentions: reddit?.mentions,
      xMentions: x?.mentions,
      bullishPct,
      bearishPct,
      topSubreddits: topSubreddits.length ? topSubreddits : undefined,
      explanation: explain ?? undefined,
      xPosts,
      redditPosts,
      rawReddit: reddit ?? undefined,
      rawX: x ?? undefined,
    };
  } catch (err) {
    console.warn(`[adanos] adanosSocialSummary error for ${ticker}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
