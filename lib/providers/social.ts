import type { Lean } from "../types";

const CONSTRUCTIVE =
  /\b(beat|beats|surge|surges|rally|record|raise|raises|upgrade|strong|bullish|breakout|growth|profit|moon|buy the dip|undervalued)\b/i;
const CAUTIOUS =
  /\b(miss|misses|cut|cuts|delay|probe|lawsuit|weak|drop|warning|slow|bearish|crash|dump|overvalued|selloff|sell-off|downgrade|layoff)\b/i;

// Lightweight keyword heuristic. Labels are evidence tags, not conclusions.
export function classifyLean(text: string): Lean {
  const constructive = CONSTRUCTIVE.test(text);
  const cautious = CAUTIOUS.test(text);
  if (constructive && cautious) return "mixed";
  if (constructive) return "constructive";
  if (cautious) return "cautious";
  return "neutral";
}

export function majorityLean(leans: Lean[]): Lean {
  const counts = new Map<Lean, number>();
  for (const lean of leans) counts.set(lean, (counts.get(lean) ?? 0) + 1);
  let best: Lean = "neutral";
  let bestCount = -1;
  for (const [lean, count] of counts) {
    if (count > bestCount) {
      best = lean;
      bestCount = count;
    }
  }
  return best;
}

export function scoreEngagement(metrics: {
  likes?: number;
  reposts?: number;
  replies?: number;
  views?: number;
  likeCount?: number;
}): number {
  return (
    (metrics.likes ?? metrics.likeCount ?? 0) * 3 +
    (metrics.reposts ?? 0) * 5 +
    (metrics.replies ?? 0) * 2 +
    (metrics.views ?? 0) * 0.01
  );
}

export function buildSearchQuery(parts: { native: string; name: string; rToken: string; bitgetSymbols?: string[] }): string {
  return [parts.native, parts.name, parts.rToken, ...(parts.bitgetSymbols ?? [])]
    .filter(Boolean)
    .map((value) => `"${value}"`)
    .join(" OR ");
}
