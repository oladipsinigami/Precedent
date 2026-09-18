import { googleNews, leanHeadline, tagHeadline, yahooRss } from "../providers/news";
import { majorityLean } from "../providers/social";
import { fetchXSentiment } from "../providers/x-sentiment";
import { yahooNews } from "../providers/yahoo";
import { serperNews } from "../providers/serper";
import { alphaVantageNews } from "../providers/alpha-vantage";
import { adanosSocialSummary } from "../providers/adanos";
import type { Lean, NewsPillar } from "../types";
import type { NameCard } from "../universe";

export async function runNews(name: NameCard): Promise<NewsPillar> {
  try {
    const [yf, rss, gNews, serper, av, macro, xResult, adanos] = await Promise.all([
      yahooNews(name.native).catch(() => []),
      yahooRss(name.native).catch(() => []),
      googleNews(`${name.name} ${name.native} stock earnings OR guidance`).catch(() => []),
      serperNews(`${name.name} ${name.native} stock earnings OR guidance`).catch(() => []),
      alphaVantageNews(name.native).catch(() => []),
      googleNews("Federal Reserve OR CPI OR tariffs US stocks").catch(() => []),
      fetchXSentiment({ native: name.native, name: name.name, rToken: name.rToken, bitgetSymbols: name.bitgetSymbols }),
      adanosSocialSummary(name.native).catch(() => null),
    ]);

    const seen = new Set<string>();
    const merged = [...av, ...serper, ...yf, ...rss, ...gNews].filter((h) => {
      const key = h.title.toLowerCase().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const headlines = merged.slice(0, 10).map((h) => ({
      ...h,
      tag: tagHeadline(h.title),
      lean: (h as { lean?: "constructive" | "cautious" | "mixed" }).lean ?? leanHeadline(h.title),
    }));

    const caveats: string[] = [];
    if (xResult.caveat) caveats.push(xResult.caveat);
    if (!process.env.ALPHAVANTAGE_API_KEY) {
      caveats.push("Alpha Vantage News/Sentiment unavailable: ALPHAVANTAGE_API_KEY is not configured.");
    } else if (!av.length) {
      caveats.push("Alpha Vantage News/Sentiment returned no usable headlines or reached rate limit this run.");
    }
    if (!process.env.SERPER_API_KEY) {
      caveats.push("Serper news unavailable: SERPER_API_KEY is not configured.");
    } else if (!serper.length) {
      caveats.push("Serper news returned no usable headlines or was unreachable this run.");
    }
    if (!process.env.ADANOS_API_KEY) {
      caveats.push("Adanos social sentiment unavailable: ADANOS_API_KEY is not configured.");
    } else if (!adanos) {
      caveats.push("Adanos social sentiment returned no data or reached rate limit this run.");
    }

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
        ...(adanos && adanos.found
          ? [{ label: "Adanos social sentiment & BuzzScore (Reddit + X)", url: "https://adanos.org" }]
          : []),
        ...(av.length ? [{ label: "Alpha Vantage News & Sentiment" }] : []),
        ...(serper.length ? [{ label: "Serper Google News" }] : []),
        { label: "Yahoo Finance search/news" },
        { label: "Yahoo Finance RSS" },
        { label: "Google News RSS" },
        ...(xCount
          ? [{ label: process.env.SORSA_API_KEY && !xResult.caveat?.startsWith("Sorsa unavailable") ? "Sorsa X discourse" : "X discourse" }]
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
