import { blendHeadlines, googleNews, leanHeadline, tagHeadline, yahooRss } from "../providers/news";
import { majorityLean } from "../providers/social";
import { fetchXSentiment } from "../providers/x-sentiment";
import { yahooNews } from "../providers/yahoo";
import { youcomNews } from "../providers/youcom";
import { BITGET_MCP_SOURCE_LABEL, bitgetMarketFearGreed } from "../providers/bitget-data";
import { alphaVantageNews } from "../providers/alpha-vantage";
import { adanosSocialSummary } from "../providers/adanos";
import type { Lean, NewsPillar } from "../types";
import type { NameCard } from "../universe";

// Bitget's Signal MCP news_feed is no longer wired into this pillar. Measured
// 2026-09-24: the call takes ~23s and returns 44 crypto-only feeds (Cointelegraph,
// Decrypt, Bitcoinist, Blockworks ...) with every `items` array empty, even with
// no keyword filter. It cannot serve an equity research memo, and it cost a
// permanent "no matching items" notice plus the longest pole in the fetch window.
// The equity feeds below cover the same ground. See README for the full note.

export async function runNews(name: NameCard): Promise<NewsPillar> {
  try {
    const [yf, rss, gNews, youcom, av, macro, xResult, adanos, fearGreed] = await Promise.all([
      yahooNews(name.native).catch(() => []),
      yahooRss(name.native).catch(() => []),
      googleNews(`${name.name} ${name.native} stock earnings OR guidance`).catch(() => []),
      youcomNews(`${name.name} ${name.native} stock earnings OR guidance`).catch(() => []),
      alphaVantageNews(name.native).catch(() => []),
      googleNews("Federal Reserve OR CPI OR tariffs US stocks").catch(() => []),
      fetchXSentiment({ native: name.native, name: name.name, rToken: name.rToken, bitgetSymbols: name.bitgetSymbols }),
      adanosSocialSummary(name.native).catch(() => null),
      // Market-wide sentiment from Bitget's own MCP data layer. Reported as
      // context only: it is a gauge of broad risk appetite, not a signal about
      // this name, so it never feeds the headline aggregate.
      bitgetMarketFearGreed().catch(() => null),
    ]);

    // Priority order matters: each provider contributes one headline per pass,
    // so the visible set spans feeds instead of the first vendor's whole batch.
    const merged = blendHeadlines([av, youcom, yf, rss, gNews], 10);

    const headlines = merged.map((h) => ({
      ...h,
      tag: tagHeadline(h.title),
      lean: (h as { lean?: "constructive" | "cautious" | "mixed" }).lean ?? leanHeadline(h.title),
    }));

    const availabilityIssues: string[] = [];
    if (xResult.caveat) availabilityIssues.push(xResult.caveat);
    if (!process.env.ALPHAVANTAGE_API_KEY) {
      availabilityIssues.push("Alpha Vantage News/Sentiment unavailable: ALPHAVANTAGE_API_KEY is not configured");
    } else if (!av.length) {
      availabilityIssues.push("Alpha Vantage News/Sentiment returned no usable headlines or reached its rate limit");
    }
    // You.com is the only third-party search-enrichment provider: report the key
    // gap when it is unset, and report a degraded call when it is configured but
    // returned nothing or was unreachable.
    if (!process.env.YDC_API_KEY) {
      availabilityIssues.push(
        "no search-enrichment provider configured: set YDC_API_KEY to enable You.com Web Search",
      );
    } else if (!youcom.length) {
      availabilityIssues.push("You.com search returned no usable headlines or was unreachable");
    }
    if (!process.env.ADANOS_API_KEY) {
      availabilityIssues.push("Adanos social sentiment unavailable: ADANOS_API_KEY is not configured");
    } else if (!adanos) {
      availabilityIssues.push("Adanos social sentiment returned no data or reached its rate limit");
    }

    const activeHeadlineSources = [
      av.length ? "Alpha Vantage" : null,
      youcom.length ? "You.com" : null,
      yf.length || rss.length ? "Yahoo Finance" : null,
      gNews.length ? "Google News" : null,
    ].filter((source): source is string => Boolean(source));
    const caveats = headlines.length > 0 && availabilityIssues.length > 0
      ? [
          `Optional news coverage gaps: ${availabilityIssues.join("; ")}. Core headlines remained available from ${activeHeadlineSources.join(", ") || "other providers"}.`,
        ]
      : availabilityIssues;

    const mergedXPosts = [...(adanos?.xPosts ?? []), ...xResult.posts];
    const seenSocial = new Set<string>();
    const socialX = mergedXPosts.filter((p) => {
      const k = p.text.toLowerCase().slice(0, 60);
      if (seenSocial.has(k)) return false;
      seenSocial.add(k);
      return true;
    }).sort((a, b) => b.engagementScore - a.engagementScore);

    const socialReddit = adanos?.redditPosts ?? [];

    const allLeans: Lean[] = [
      ...headlines.map((h) => h.lean as Lean),
      ...socialX.map((p) => p.lean),
      ...socialReddit.map((p) => p.lean),
    ];
    const aggregateLean = allLeans.length ? majorityLean(allLeans) : "insufficient";

    const xCount = socialX.length;
    const volumeNote = xCount >= 15 ? "X volume elevated vs a quiet baseline for this name." : undefined;

    const notes = [
      `${headlines.length} equity-relevant headlines after de-duplication.`,
      ...(fearGreed
        ? [
            `Bitget market Fear & Greed ${fearGreed.score.toFixed(1)} (${fearGreed.rating.toLowerCase()})${
              fearGreed.previousWeek !== undefined
                ? `, week-ago ${fearGreed.previousWeek.toFixed(1)}`
                : ""
            }${fearGreed.previousMonth !== undefined ? `, month-ago ${fearGreed.previousMonth.toFixed(1)}` : ""}. Broad market context, not a signal about this name.`,
          ]
        : []),
      headlines.some((h) => h.tag === "earnings" || h.tag === "guidance")
        ? "Earnings/guidance language is present in the recent tape of headlines."
        : "No obvious earnings/guidance headline in the recent sample — do not invent one.",
      xCount
        ? `${xCount} X posts retrieved, engagement-ranked (aggregate X lean: ${majorityLean(socialX.map((p) => p.lean))}).`
        : "No X posts retrieved this run.",
      ...(socialReddit.length
        ? [`${socialReddit.length} Reddit discussion posts retrieved from top communities.`]
        : []),
      "Crypto-only sentiment is not used as a substitute for equity news.",
    ];

    if (adanos && adanos.found) {
      if (adanos.buzzScore !== undefined) {
        notes.push(`Adanos BuzzScore: ${adanos.buzzScore.toFixed(1)}/100 across retail discourse.`);
      }
      if (adanos.xMentions !== undefined || adanos.redditMentions !== undefined) {
        const parts: string[] = [];
        if (adanos.xMentions !== undefined) parts.push(`${adanos.xMentions} X mentions`);
        if (adanos.redditMentions !== undefined) parts.push(`${adanos.redditMentions} Reddit mentions`);
        if (adanos.bullishPct !== undefined && adanos.bearishPct !== undefined) {
          parts.push(`${adanos.bullishPct}% bullish / ${adanos.bearishPct}% bearish`);
        }
        notes.push(`Adanos retail volume: ${parts.join(" · ")}.`);
      }
      if (adanos.explanation) {
        notes.push(`Adanos discourse driver: “${adanos.explanation}”`);
      }
    }

    return {
      ok: true,
      headlines,
      macro: macro.slice(0, 4).map((h) => h.title),
      social: { x: socialX, reddit: socialReddit.length ? socialReddit : undefined },
      adanos: adanos
        ? {
            buzzScore: adanos.buzzScore,
            sentimentScore: adanos.sentimentScore,
            redditMentions: adanos.redditMentions,
            xMentions: adanos.xMentions,
            bullishPct: adanos.bullishPct,
            bearishPct: adanos.bearishPct,
            topSubreddits: adanos.topSubreddits,
            explanation: adanos.explanation,
          }
        : undefined,
      aggregateLean,
      volumeNote,
      caveats,
      notes,
      sources: [
        ...(fearGreed ? [{ label: `${BITGET_MCP_SOURCE_LABEL} · market sentiment`, url: "https://agent.bitget.com/mcp" }] : []),
        ...(adanos && adanos.found
          ? [{ label: "Adanos social sentiment & BuzzScore (Reddit + X)", url: "https://adanos.org" }]
          : []),
        ...(av.length ? [{ label: "Alpha Vantage News & Sentiment" }] : []),
        ...(youcom.length
          ? [{ label: "You.com Web Search (web + news sections)", url: "https://you.com/platform" }]
          : []),
        { label: "Yahoo Finance search/news" },
        { label: "Yahoo Finance RSS" },
        { label: "Google News RSS" },
        ...(xResult.posts.length
          ? [{ label: "X discourse" }]
          : xCount
            ? []
            : [{ label: "X discourse (unavailable this run)" }]),
      ],
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "News fetch failed",
      headlines: [],
      macro: [],
      social: { x: [] },
      aggregateLean: "insufficient",
      caveats: ["Sentiment pillar degraded."],
      notes: ["News pillar degraded."],
      sources: [],
    };
  }
}
