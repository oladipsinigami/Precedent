import { googleNews, leanHeadline, tagHeadline, yahooRss } from "../providers/news";
import { buildSearchQuery, majorityLean } from "../providers/social";
import { fetchXSentiment } from "../providers/x-sentiment";
import { yahooNews } from "../providers/yahoo";
import { fetchYouTubeSentiment } from "../providers/youtube-sentiment";
import { serpNews } from "../providers/serpapi";
import { serperNews } from "../providers/serper";
import type { Lean, NewsPillar } from "../types";
import type { NameCard } from "../universe";

export async function runNews(name: NameCard): Promise<NewsPillar> {
  try {
    const [yf, rss, gNews, serp, serper, macro, xResult, ytResult] = await Promise.all([
      yahooNews(name.native).catch(() => []),
      yahooRss(name.native).catch(() => []),
      googleNews(`${name.name} ${name.native} stock earnings OR guidance`).catch(() => []),
      serpNews(`${name.name} ${name.native} stock earnings OR guidance`).catch(() => []),
      serperNews(`${name.name} ${name.native} stock earnings OR guidance`).catch(() => []),
      googleNews("Federal Reserve OR CPI OR tariffs US stocks").catch(() => []),
      fetchXSentiment({ native: name.native, name: name.name, rToken: name.rToken, bitgetSymbols: name.bitgetSymbols }),
      fetchYouTubeSentiment(
        buildSearchQuery({
          native: `${name.native} stock`,
          name: name.name,
          rToken: name.rToken,
          bitgetSymbols: name.bitgetSymbols,
        }),
      ),
    ]);

    const seen = new Set<string>();
    const merged = [...serper, ...serp, ...yf, ...rss, ...gNews].filter((h) => {
      const key = h.title.toLowerCase().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const headlines = merged.slice(0, 10).map((h) => ({
      ...h,
      tag: tagHeadline(h.title),
      lean: leanHeadline(h.title),
    }));

    const caveats: string[] = [];
    if (xResult.caveat) caveats.push(xResult.caveat);
    if (ytResult.caveat) caveats.push(ytResult.caveat);
    if (!process.env.SERPAPI_API_KEY) {
      caveats.push("SerpAPI Google News unavailable: SERPAPI_API_KEY is not configured.");
    } else if (!serp.length) {
      caveats.push("SerpAPI Google News returned no usable headlines or was unreachable this run.");
    }
    if (!process.env.SERPER_API_KEY) {
      caveats.push("Serper news unavailable: SERPER_API_KEY is not configured.");
    } else if (!serper.length) {
      caveats.push("Serper news returned no usable headlines or was unreachable this run.");
    }

    const allLeans: Lean[] = [
      ...headlines.map((h) => h.lean as Lean),
      ...xResult.posts.map((p) => p.lean),
      ...ytResult.items.map((i) => i.overallLean),
    ];
    const aggregateLean = allLeans.length ? majorityLean(allLeans) : "insufficient";

    const xCount = xResult.posts.length;
    const volumeNote = xCount >= 15 ? "X volume elevated vs a quiet baseline for this name." : undefined;

    const notes = [
      `${headlines.length} equity-relevant headlines after de-duplication.`,
      headlines.some((h) => h.tag === "earnings" || h.tag === "guidance")
        ? "Earnings/guidance language is present in the recent tape of headlines."
        : "No obvious earnings/guidance headline in the recent sample — do not invent one.",
      xCount
        ? `${xCount} X posts retrieved, engagement-ranked (aggregate X lean: ${majorityLean(xResult.posts.map((p) => p.lean))}).`
        : "No X posts retrieved this run.",
      ytResult.items.length
        ? `${ytResult.items.length} YouTube videos with top comments retrieved.`
        : "No YouTube items retrieved this run.",
      "Crypto-only sentiment is not used as a substitute for equity news.",
    ];

    return {
      ok: true,
      headlines,
      macro: macro.slice(0, 4).map((h) => h.title),
      social: { x: xResult.posts, youtube: ytResult.items },
      aggregateLean,
      volumeNote,
      caveats,
      notes,
      sources: [
        ...(serper.length ? [{ label: "Serper Google News" }] : []),
        ...(serp.length ? [{ label: "SerpAPI Google News" }] : []),
        { label: "Yahoo Finance search/news" },
        { label: "Yahoo Finance RSS" },
        { label: "Google News RSS" },
        ...(xCount
          ? [{ label: process.env.SORSA_API_KEY && !xResult.caveat?.startsWith("Sorsa unavailable") ? "Sorsa X discourse" : "X discourse" }]
          : [{ label: "X discourse (unavailable this run)" }]),
        ...(ytResult.items.length ? [{ label: "YouTube discourse" }] : [{ label: "YouTube discourse (unavailable this run)" }]),
      ],
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "News fetch failed",
      headlines: [],
      macro: [],
      social: { x: [], youtube: [] },
      aggregateLean: "insufficient",
      caveats: ["Sentiment pillar degraded."],
      notes: ["News pillar degraded."],
      sources: [],
    };
  }
}
