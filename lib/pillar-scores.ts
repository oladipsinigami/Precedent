import type { FundamentalsPillar, NewsPillar, TechnicalsPillar } from "./types";

/**
 * Pillar descriptors state how much evidence a stream returned, never which way
 * it points. The old labels ("constructive" / "cautious") read as a judgement:
 * scoring a company higher purely for *having* EPS made a complete filing read
 * as a bullish one. Completeness is now named directly.
 */
export type EvidenceLevel = "complete" | "partial" | "sparse" | "insufficient";

export type PillarScore = {
  /** How many of the pillar's own checks resolved. Null when the stream failed. */
  value: number | null;
  label: EvidenceLevel;
  basis: string;
};

// Tunable: share of checks that must resolve before a stream reads as complete.
// Chosen at 3 of 4 because a single missing optional field should not demote a
// stream that otherwise returned everything it asked for.
export const COMPLETE_SHARE = 0.75;

function levelFor(resolved: number, total: number): EvidenceLevel {
  if (total <= 0) return "insufficient";
  if (resolved >= total * COMPLETE_SHARE) return "complete";
  if (resolved >= 2) return "partial";
  if (resolved >= 1) return "sparse";
  return "insufficient";
}

function score(resolved: number, total: number, basis: string): PillarScore {
  return { value: resolved, label: levelFor(resolved, total), basis };
}

export function sentimentScore(news?: NewsPillar): PillarScore {
  if (!news || (!news.headlines.length && !news.social.x.length)) {
    return { value: null, label: "insufficient", basis: "No usable news or discourse observations were returned." };
  }
  const resolved = (news.headlines.length ? 1 : 0) + (news.social.x.length ? 1 : 0);
  return score(
    resolved,
    2,
    `${news.headlines.length} headline${news.headlines.length === 1 ? "" : "s"} and ` +
      `${news.social.x.length} social item${news.social.x.length === 1 ? "" : "s"} returned` +
      `${news.caveats.length ? `, with ${news.caveats.length} coverage caveat${news.caveats.length === 1 ? "" : "s"}` : ""}. ` +
      `Reported lean is "${news.aggregateLean}"; it is not scored into a view.`,
  );
}

export function fundamentalsScore(fundamentals?: FundamentalsPillar): PillarScore {
  if (!fundamentals || (!fundamentals.eps && !fundamentals.revenue && !fundamentals.latestFilings.length)) {
    return { value: null, label: "insufficient", basis: "No current EPS, revenue, or filing facts were returned." };
  }
  const resolved =
    (fundamentals.eps ? 1 : 0) +
    (fundamentals.revenue ? 1 : 0) +
    (fundamentals.latestFilings.length ? 1 : 0) +
    (fundamentals.catalysts.length ? 1 : 0);

  const parts = [
    fundamentals.eps ? `EPS ${fundamentals.eps.value}` : "no EPS",
    fundamentals.revenue ? "revenue" : "",
    fundamentals.latestFilings.length ? `${fundamentals.latestFilings.length} recent filing${fundamentals.latestFilings.length === 1 ? "" : "s"}` : "",
    fundamentals.catalysts.length ? `${fundamentals.catalysts.length} catalyst${fundamentals.catalysts.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return score(
    resolved,
    4,
    `${resolved} of 4 disclosure checks returned: ${parts.join(", ")}. This counts what was filed, not whether it is favourable.`,
  );
}

export function technicalsScore(technicals?: TechnicalsPillar): PillarScore {
  if (!technicals?.ok) {
    return { value: null, label: "insufficient", basis: "Technical tape data was unavailable or degraded." };
  }
  const { last } = technicals.native;
  const averages = [technicals.indicators.sma20, technicals.indicators.sma50, technicals.indicators.sma200].filter(
    (item): item is number => item !== undefined && Number.isFinite(item),
  );
  const above = averages.filter((average) => last >= average);

  const resolved =
    (averages.length ? 1 : 0) +
    (technicals.indicators.rsi14 !== undefined ? 1 : 0) +
    (technicals.indicators.realizedVol20 !== undefined ? 1 : 0) +
    (technicals.rToken?.premiumPct !== undefined && technicals.rToken?.premiumPct !== null ? 1 : 0);

  const averageClause = averages.length
    ? `above ${above.length} of ${averages.length} moving averages`
    : "no moving-average comparison available";

  return score(
    resolved,
    4,
    `${averageClause}${technicals.indicators.rsi14 !== undefined ? `; RSI ${technicals.indicators.rsi14.toFixed(1)}` : ""}` +
      `${technicals.indicators.realizedVol20 !== undefined ? `; realized vol ${technicals.indicators.realizedVol20.toFixed(1)}%` : ""}` +
      `${technicals.rToken?.premiumPct !== undefined && technicals.rToken?.premiumPct !== null ? `; rToken basis ${technicals.rToken.premiumPct.toFixed(2)}%` : ""}.`,
  );
}

export type PillarCoverage = {
  available: number;
  total: number;
  label: EvidenceLevel;
  basis: string;
};

export function summarizePillarCoverage(availability: boolean[]): PillarCoverage {
  const available = availability.filter(Boolean).length;
  const total = availability.length;
  return {
    available,
    total,
    label: levelFor(available, total),
    basis: `${available} of ${total} evidence streams returned usable data. This is a source-coverage check, not a blended investment score, and says nothing about direction.`,
  };
}