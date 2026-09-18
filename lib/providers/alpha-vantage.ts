import { fetchJson } from "../http";
import type { Headline } from "./news";

export type AlphaVantageArticle = {
  title?: string;
  url?: string;
  time_published?: string;
  authors?: string[];
  summary?: string;
  banner_image?: string;
  source?: string;
  category_within_source?: string;
  source_domain?: string;
  overall_sentiment_score?: number;
  overall_sentiment_label?: string;
  ticker_sentiment?: Array<{
    ticker: string;
    relevance_score: string;
    ticker_sentiment_score: string;
    ticker_sentiment_label: string;
  }>;
};

export type AlphaVantageNewsResponse = {
  items?: string;
  sentiment_score_definition?: string;
  relevance_score_definition?: string;
  feed?: AlphaVantageArticle[];
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

export type AlphaVantageHeadline = Headline & {
  summary?: string;
  sentimentScore?: number;
  sentimentLabel?: string;
  lean?: "constructive" | "cautious" | "mixed";
};

export type AlphaVantageOverview = {
  Symbol?: string;
  AssetType?: string;
  Name?: string;
  Description?: string;
  CIK?: string;
  Exchange?: string;
  Currency?: string;
  Country?: string;
  Sector?: string;
  Industry?: string;
  MarketCapitalization?: string;
  PERatio?: string;
  PEGRatio?: string;
  BookValue?: string;
  DividendYield?: string;
  EPS?: string;
  RevenueTTM?: string;
  GrossProfitTTM?: string;
  QuarterlyEarningsGrowthYOY?: string;
  QuarterlyRevenueGrowthYOY?: string;
  AnalystTargetPrice?: string;
  TrailingPE?: string;
  ForwardPE?: string;
  PriceToSalesRatioTTM?: string;
  PriceToBookRatio?: string;
  EVToRevenue?: string;
  EVToEBITDA?: string;
  Beta?: string;
  "52WeekHigh"?: string;
  "52WeekLow"?: string;
  [key: string]: unknown;
};

/**
 * Normalizes input tickers or tokenized stock symbols (e.g. "rAAPL", "AAPLUSDT", "RAAPLUSDT")
 * to the underlying US equity ticker (e.g. "AAPL").
 */
export function normalizeTicker(symbol: string): string {
  let clean = symbol.trim().toUpperCase();
  // Strip common crypto quote currencies if passed (e.g. AAPLUSDT -> AAPL)
  clean = clean.replace(/USDT$/, "");
  // Strip leading 'R' for rTokens if length is between 2 and 6 (e.g. RAAPL -> AAPL, RTSLA -> TSLA)
  if (/^R[A-Z]{1,5}$/.test(clean)) {
    return clean.slice(1);
  }
  return clean;
}

/**
 * Maps Alpha Vantage sentiment labels to institutional lean descriptors.
 * Preserves Precedent neutrality rule (never outputs bare BUY/SELL).
 */
export function mapSentimentToLean(
  sentimentLabel?: string,
): "constructive" | "cautious" | "mixed" | undefined {
  if (!sentimentLabel) return undefined;
  const s = sentimentLabel.toLowerCase();
  if (s.includes("bullish")) return "constructive";
  if (s.includes("bearish")) return "cautious";
  if (s.includes("neutral")) return "mixed";
  return undefined;
}

/**
 * Formats Alpha Vantage compact timestamps (e.g. "20240315T123000")
 * into a human-readable ISO-like date string ("2024-03-15 12:30 UTC").
 */
function formatAvDate(timeStr?: string): string | undefined {
  if (!timeStr || timeStr.length < 8) return undefined;
  const y = timeStr.slice(0, 4);
  const m = timeStr.slice(4, 6);
  const d = timeStr.slice(6, 8);
  if (timeStr.length >= 13) {
    const hh = timeStr.slice(9, 11);
    const mm = timeStr.slice(11, 13);
    return `${y}-${m}-${d} ${hh}:${mm} UTC`;
  }
  return `${y}-${m}-${d}`;
}

/**
 * Fetches market news and AI sentiment from Alpha Vantage NEWS_SENTIMENT endpoint.
 * Includes graceful fallback on rate limits (25 req/day free tier) or missing keys.
 */
export async function alphaVantageNews(
  symbol: string,
  opts: { limit?: number } = {},
): Promise<AlphaVantageHeadline[]> {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey) return [];

  const ticker = normalizeTicker(symbol);
  if (!ticker) return [];

  const limit = Math.min(20, Math.max(1, opts.limit ?? 10));

  try {
    const params = new URLSearchParams({
      function: "NEWS_SENTIMENT",
      tickers: ticker,
      apikey: apiKey,
      limit: String(limit),
      sort: "LATEST",
    });

    const response = await fetchJson<AlphaVantageNewsResponse>(
      `https://www.alphavantage.co/query?${params.toString()}`,
      { timeoutMs: 8_000, cacheTtlMs: 300_000 }, // 5-minute memory cache protects the free 25 req/day quota
    );

    if (response["Error Message"]) {
      console.warn("[alpha-vantage] NEWS_SENTIMENT error:", response["Error Message"]);
      return [];
    }
    if (response.Note || response.Information) {
      console.warn(
        "[alpha-vantage] NEWS_SENTIMENT notice/rate-limit:",
        response.Note || response.Information,
      );
      return [];
    }

    if (!Array.isArray(response.feed)) {
      return [];
    }

    return response.feed
      .map((article) => {
        const title = article.title?.trim() ?? "";
        const url = article.url?.trim() ?? "";
        const publisher =
          article.source?.trim() ||
          article.source_domain?.trim() ||
          "Alpha Vantage";
        const published = formatAvDate(article.time_published);

        // Check if there is ticker-specific sentiment for our symbol
        const tickerMatch = article.ticker_sentiment?.find(
          (t) => normalizeTicker(t.ticker) === ticker,
        );
        const sentimentLabel =
          tickerMatch?.ticker_sentiment_label ||
          article.overall_sentiment_label;
        const rawScore = tickerMatch
          ? parseFloat(tickerMatch.ticker_sentiment_score)
          : article.overall_sentiment_score;
        const sentimentScore =
          typeof rawScore === "number" && Number.isFinite(rawScore)
            ? rawScore
            : undefined;

        const lean = mapSentimentToLean(sentimentLabel);

        return {
          title,
          publisher,
          url,
          published,
          summary: article.summary?.trim(),
          sentimentScore,
          sentimentLabel,
          lean,
        };
      })
      .filter((item) => item.title.length > 0 && item.url.length > 0);
  } catch (err) {
    console.warn(
      "[alpha-vantage] NEWS_SENTIMENT fetch failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Fetches company fundamentals overview from Alpha Vantage OVERVIEW endpoint.
 */
export async function alphaVantageOverview(
  symbol: string,
): Promise<AlphaVantageOverview | null> {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey) return null;

  const ticker = normalizeTicker(symbol);
  if (!ticker) return null;

  try {
    const params = new URLSearchParams({
      function: "OVERVIEW",
      symbol: ticker,
      apikey: apiKey,
    });

    const response = await fetchJson<
      AlphaVantageOverview & {
        Note?: string;
        Information?: string;
        "Error Message"?: string;
      }
    >(`https://www.alphavantage.co/query?${params.toString()}`, {
      timeoutMs: 8_000,
      cacheTtlMs: 300_000,
    });

    if (
      response["Error Message"] ||
      response.Note ||
      response.Information ||
      !response.Symbol
    ) {
      return null;
    }

    return response;
  } catch {
    return null;
  }
}
