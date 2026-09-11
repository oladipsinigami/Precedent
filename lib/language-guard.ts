import type { Briefing } from "./types";

const VERDICT = /\b(buy|sell|long|short)\b/gi;
const CONFIDENCE = /\b\d{1,3}\s*%\s*(confidence|probable|probability|sure|conviction)\b/gi;
const VERDICT_LINE =
  /\b(i recommend|you should|strong (buy|sell)|this is a (buy|sell)|open a (long|short)|go long|go short|enter (a )?position)\b/gi;

function rewrite(text: string): string {
  return text
    .replace(CONFIDENCE, "an unstated conviction (removed)")
    .replace(VERDICT_LINE, "this desk does not take a side")
    .replace(VERDICT, (m) => {
      const lower = m.toLowerCase();
      if (lower === "buy") return "add exposure";
      if (lower === "sell") return "reduce exposure";
      if (lower === "long") return "upside case";
      if (lower === "short") return "downside case";
      return m;
    })
    .replace(/\badd exposure\b/gi, "the constructive case")
    .replace(/\breduce exposure\b/gi, "the cautious case");
}

function scrubList(items: string[]): string[] {
  return items.map(rewrite).filter((line) => !/this desk does not take a side/i.test(line) || line.length > 40);
}

export function guardBriefing(briefing: Briefing): Briefing {
  return {
    ...briefing,
    title: rewrite(briefing.title).replace(/the (constructive|cautious) case/gi, "setup").trim(),
    styleNote: rewrite(briefing.styleNote),
    flags: briefing.flags
      ? {
          ...briefing.flags,
          balanceSheet: scrubList(briefing.flags.balanceSheet),
          analogQuality: briefing.flags.analogQuality,
        }
      : undefined,
    evidence: briefing.evidence.map((e) => ({ ...e, claim: rewrite(e.claim) })),
    tension: briefing.tension.map((t) => ({
      left: rewrite(t.left),
      right: rewrite(t.right),
      whyItMatters: rewrite(t.whyItMatters),
    })),
    historicalAnalog: {
      ...briefing.historicalAnalog,
      setup: rewrite(briefing.historicalAnalog.setup),
      analogs: briefing.historicalAnalog.analogs.map((a) => ({
        ...a,
        followed: rewrite(a.followed),
        similarity: rewrite(a.similarity),
      })),
      baseRates: briefing.historicalAnalog.baseRates.map((b) => ({ ...b, note: rewrite(b.note), range: rewrite(b.range) })),
      caveat: rewrite(briefing.historicalAnalog.caveat),
    },
    considerations: {
      forStyle: scrubList(briefing.considerations.forStyle),
      invalidation: scrubList(briefing.considerations.invalidation),
      questions: scrubList(briefing.considerations.questions),
    },
  };
}

export function looksLikeVerdict(text: string): boolean {
  return VERDICT.test(text) || CONFIDENCE.test(text) || VERDICT_LINE.test(text);
}
