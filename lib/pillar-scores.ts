import type { FundamentalsPillar, NewsPillar, TechnicalsPillar } from "./types";

export type PillarScore = {
  value: number | null;
  label: "constructive" | "mixed" | "cautious" | "insufficient";
  basis: string;
};

function labelFor(value: number | null): PillarScore["label"] {
  if (value === null) return "insufficient";
  if (value >= 65) return "constructive";
  if (value <= 40) return "cautious";
  return "mixed";
}

function score(value: number, basis: string): PillarScore {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return { value: bounded, label: labelFor(bounded), basis };
}

export function sentimentScore(news?: NewsPillar): PillarScore {
  if (!news || (!news.headlines.length && !news.social.x.length)) {
    return { value: null, label: "insufficient", basis: "No usable news or discourse observations were returned." };
  }
  const base = news.aggregateLean === "constructive" ? 72 : news.aggregateLean === "cautious" ? 32 : 50;
  const headlineAdjustment = news.headlines.length ? Math.min(8, news.headlines.filter((item) => item.lean === news.aggregateLean).length * 2) : 0;
  const caveatPenalty = Math.min(12, news.caveats.length * 4);
  return score(
    base + headlineAdjustment - caveatPenalty,
    `${news.aggregateLean} aggregate lean across ${news.headlines.length} headlines and ${news.social.x.length} social items${news.caveats.length ? `; ${news.caveats.length} caveat${news.caveats.length === 1 ? "" : "s"}` : ""}.`,
  );
}

export function fundamentalsScore(fundamentals?: FundamentalsPillar): PillarScore {
  if (!fundamentals || (!fundamentals.eps && !fundamentals.revenue && !fundamentals.latestFilings.length)) {
    return { value: null, label: "insufficient", basis: "No current EPS, revenue, or filing facts were returned." };
  }
  let value = 35;
  if (fundamentals.eps) value += 20;
  if (fundamentals.revenue) value += 20;
  if (fundamentals.latestFilings.length) value += 15;
  if (fundamentals.catalysts.length) value += 5;
  if (fundamentals.eps?.prior !== undefined) value += fundamentals.eps.value >= fundamentals.eps.prior ? 5 : -5;
  return score(value, `${fundamentals.eps ? "EPS" : "No EPS"}${fundamentals.revenue ? ", revenue" : ""}${fundamentals.latestFilings.length ? `, and ${fundamentals.latestFilings.length} recent filing${fundamentals.latestFilings.length === 1 ? "" : "s"}` : ""} were available; this is a completeness and recency description, not a forecast.`);
}

export function technicalsScore(technicals?: TechnicalsPillar): PillarScore {
  if (!technicals?.ok) {
    return { value: null, label: "insufficient", basis: "Technical tape data was unavailable or degraded." };
  }
  let value = 50;
  const { last } = technicals.native;
  const averages = [technicals.indicators.sma20, technicals.indicators.sma50, technicals.indicators.sma200].filter(
    (item): item is number => item !== undefined && Number.isFinite(item),
  );
  if (averages.length) value += averages.filter((average) => last >= average).length * 8 - (averages.length - averages.filter((average) => last >= average).length) * 4;
  if (technicals.indicators.rsi14 !== undefined && technicals.indicators.rsi14 >= 40 && technicals.indicators.rsi14 <= 60) value += 8;
  if (technicals.rToken?.premiumPct !== undefined && technicals.rToken.premiumPct !== null) value += Math.abs(technicals.rToken.premiumPct) <= 2 ? 5 : -5;
  if (technicals.indicators.realizedVol20 !== undefined && technicals.indicators.realizedVol20 > 40) value -= 8;
  return score(value, `${averages.length ? `${averages.length} moving-average comparisons` : "No moving-average comparisons"}${technicals.indicators.rsi14 !== undefined ? `; RSI ${technicals.indicators.rsi14.toFixed(1)}` : ""}${technicals.rToken?.premiumPct !== undefined && technicals.rToken.premiumPct !== null ? `; rToken basis ${technicals.rToken.premiumPct.toFixed(2)}%` : ""}.`);
}

export function aggregatePillarScore(scores: PillarScore[]) {
  const available = scores.filter((item): item is PillarScore & { value: number } => item.value !== null);
  if (!available.length) return { value: null, label: "insufficient" as const, basis: "No pillar scores were available." };
  const value = Math.round(available.reduce((sum, item) => sum + item.value, 0) / available.length);
  return {
    value,
    label: labelFor(value),
    basis: `${available.length} of ${scores.length} pillar scores available; equal-weight average of descriptive evidence strength.`,
  };
}
