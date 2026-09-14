import type { Briefing } from "./types";

const VERDICT = /\b(buy|sell|long|short)\b/gi;
const CONFIDENCE = /\b\d{1,3}\s*%\s*(confidence|probable|probability|sure|conviction)\b/gi;
const VERDICT_LINE =
  /\b(i recommend|you should|strong (buy|sell)|this is a (buy|sell)|open a (long|short)|go long|go short|enter (a )?position)\b/gi;
const SOFT_DIRECTIONAL =
  /\b(upside bias|downside bias|favors higher prices|favors lower prices|constructive setup|cautious setup|lean(?:s|ing)? long|lean(?:s|ing)? short|history is supportive|history is unsupportive|supportive history|bullish setup|bearish setup|positive price bias|negative price bias|upside possible|downside possible|expect a pullback|bullish case|bearish case|upside case|downside case|further upside|further downside|room for upside|room for downside)\b/gi;

function matches(regex: RegExp, text: string): boolean {
  regex.lastIndex = 0;
  const result = regex.test(text);
  regex.lastIndex = 0;
  return result;
}

function demystifyJargon(text: string): string {
  return text
    .replace(/\bmean\s+reversion(?!\s*\([^)]*average\))/gi, "mean reversion (the tendency of prices to return toward their historical average)")
    .replace(/\bRSI\s+stretch(?!\s*\([^)]*extreme\))/gi, "RSI stretch (a condition where the short-term strength indicator reached an extreme)")
    .replace(/\bMACD(?!\s*\([^)]*trend-speed\))/gi, "MACD (a trend-speed indicator)")
    .replace(/\b(?!RSI\s+stretch\b)RSI\b(?!\s*\([^)]*strength\))(?!\s*score)(?!\s*14)/gi, "RSI (a short-term strength score from 0 to 100)")
    .replace(/\boverextended(?!\s*\([^)]*average\))/gi, "overextended (moved unusually far away from its recent average)")
    .replace(/\bconsolidation(?!\s*\([^)]*sideways\))/gi, "consolidation (a period where price moves sideways in a tight range)")
    .replace(/\bresistance\s+(band|zone|level)(?!\s*\([^)]*sellers\))/gi, "resistance $1 (a price level where sellers previously paused advances)")
    .replace(/\bsupport\s+(zone|band|level)(?!\s*\([^)]*buyers\))/gi, "support $1 (a price level where buyers previously slowed price drops)")
    .replace(/\boverbought(?!\s*\([^)]*pause\))/gi, "overbought (where recent gains were unusually fast and prices often pause)")
    .replace(/\boversold(?!\s*\([^)]*pause\))/gi, "oversold (where recent drops were unusually fast and prices often pause)");
}

function banSoftDirectional(text: string): string {
  return text
    .replace(/\b(moderate\s+)?upside\s+possible\b/gi, "prices moved higher in some past sessions")
    .replace(/\b(moderate\s+)?downside\s+possible\b/gi, "prices moved lower in some past sessions")
    .replace(/\bexpect\s+a\s+pullback\s+before\s+further\s+upside\b/gi, "prices often fluctuate in either direction before continuing")
    .replace(/\bexpect\s+a\s+pullback\s+before\s+further\s+downside\b/gi, "prices often fluctuate in either direction before continuing")
    .replace(/\bexpect\s+a\s+pullback\b/gi, "prices may fluctuate")
    .replace(/\bfurther\s+upside\b/gi, "higher prices")
    .replace(/\bfurther\s+downside\b/gi, "lower prices")
    .replace(/\b(moderate\s+)?(upside|downside)\s+potential\b/gi, "potential price movement")
    .replace(/\broom\s+for\s+(upside|downside)\b/gi, "historical range for price movement")
    .replace(/\b(bullish|upside|constructive)\s+case\b/gi, "scenario where prices rise")
    .replace(/\b(bearish|downside|cautious)\s+case\b/gi, "scenario where prices drop")
    .replace(/\b(bullish|bearish)\s+(setup|bias|outlook|view|stance|lean)\b/gi, "mixed market signals")
    .replace(/\b(upside|downside)\s+bias\b/gi, "historical price range")
    .replace(/\bfavors\s+(higher|lower)\s+prices\b/gi, "shows mixed historical results")
    .replace(/\b(constructive|cautious)\s+setup\b/gi, "current chart pattern")
    .replace(/\blean(?:s|ing)?\s+(long|short|higher|lower|bullish|bearish)\b/gi, "shows mixed signals")
    .replace(/\bhistory\s+is\s+supportive\b/gi, "past data provides context")
    .replace(/\bhistory\s+is\s+unsupportive\b/gi, "past data was mixed")
    .replace(/\bsupportive\s+history\b/gi, "past data")
    .replace(/\b(positive|negative)\s+price\s+bias\b/gi, "mixed historical data")
    .replace(/\btilted\s+to\s+the\s+(upside|downside)\b/gi, "mixed across the sample");
}

export function cleanHistoricalSummary(text: string | undefined | null): string {
  if (!text || typeof text !== "string") return "";
  let s = rewrite(text);
  s = s.replace(/^(moderate\s+)?(upside|downside)(\s+possible)?[:\s—–-]*/i, "");
  s = s.replace(/^(bullish|bearish|constructive|cautious)(\s+(case|setup|lean|outlook|bias))?[:\s—–-]*/i, "");
  s = s.replace(/^(the\s+)?(upside|downside)\s+case[:\s—–-]*/i, "");
  s = s.replace(/^the\s+evidence\s+remains\s+mixed[:\s—–-]*/i, "");
  s = s.replace(/^prices\s+moved\s+(higher|lower)\s+in\s+some\s+past\s+sessions[:\s—–-]*/i, "");
  s = s.trim();
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

function rewrite(text: string | undefined | null): string {
  if (!text || typeof text !== "string") return "";
  let out = text
    .replace(CONFIDENCE, "an unstated conviction (removed)")
    .replace(VERDICT_LINE, "this desk does not take a side");
  out = banSoftDirectional(out);
  out = demystifyJargon(out);
  out = out.replace(VERDICT, (m) => {
    const lower = m.toLowerCase();
    if (lower === "buy") return "purchasing";
    if (lower === "sell") return "selling";
    if (lower === "long") return "an upward position";
    if (lower === "short") return "a downward position";
    return m;
  });
  return out;
}

function scrubList(items: string[] | undefined | null): string[] {
  return (items ?? []).map(rewrite).filter((line) => !/this desk does not take a side/i.test(line) || line.length > 40);
}

export function guardBriefing(briefing: Briefing): Briefing {
  return {
    ...briefing,
    title: rewrite(briefing.title).replace(/the (constructive|cautious) case/gi, "setup").trim() || "Research Memo",
    whatWeDid: rewrite(briefing.whatWeDid),
    historicalStressTest: {
      ...briefing.historicalStressTest,
      summary: cleanHistoricalSummary(briefing.historicalStressTest?.summary) || "Historical cases show a range of past outcomes for context.",
      results: (briefing.historicalStressTest?.results ?? []).map((result) => ({
        ...result,
        wentUp: rewrite(result?.wentUp),
        typicalMove: rewrite(result?.typicalMove),
        median: rewrite(result?.median),
      })),
      examples: (briefing.historicalStressTest?.examples ?? [])
        .filter(
          (example) =>
            example?.when &&
            example?.whatHappened &&
            !/\b(n\/?a|null|undefined)\b/i.test(example.whatHappened) &&
            /\d/.test(example.whatHappened),
        )
        .map((example) => ({
          ...example,
          when: rewrite(example?.when),
          whatHappened: rewrite(example?.whatHappened),
        })),
      importantNote: rewrite(briefing.historicalStressTest?.importantNote),
    },
    otherThingsWeChecked: scrubList(briefing.otherThingsWeChecked),
    whereThingsDoNotAgree: (briefing.whereThingsDoNotAgree ?? []).map((item) => ({
      conflict: rewrite(item?.conflict),
      whyItMatters: rewrite(item?.whyItMatters),
    })),
    simpleTakeAways: scrubList(briefing.simpleTakeAways),
    questionsOnlyYouCanAnswer: scrubList(briefing.questionsOnlyYouCanAnswer),
    styleNote: rewrite(briefing.styleNote),
    flags: briefing.flags
      ? {
          ...briefing.flags,
          balanceSheet: scrubList(briefing.flags.balanceSheet),
          analogQuality: briefing.flags.analogQuality,
        }
      : undefined,
    evidence: (briefing.evidence ?? []).map((e) => ({ ...e, claim: rewrite(e?.claim) })),
    tension: (briefing.tension ?? []).map((t) => ({
      left: rewrite(t?.left),
      right: rewrite(t?.right),
      whyItMatters: rewrite(t?.whyItMatters),
    })),
    historicalAnalog: {
      ...briefing.historicalAnalog,
      setup: rewrite(briefing.historicalAnalog?.setup),
      analogs: (briefing.historicalAnalog?.analogs ?? []).map((a) => ({
        ...a,
        followed: rewrite(a?.followed),
        similarity: rewrite(a?.similarity),
      })),
      baseRates: (briefing.historicalAnalog?.baseRates ?? []).map((b) => ({ ...b, note: rewrite(b?.note), range: rewrite(b?.range) })),
      caveat: rewrite(briefing.historicalAnalog?.caveat),
    },
    considerations: {
      forStyle: scrubList(briefing.considerations?.forStyle),
      invalidation: scrubList(briefing.considerations?.invalidation),
      questions: scrubList(briefing.considerations?.questions),
    },
  };
}

export function looksLikeVerdict(text: string): boolean {
  return matches(VERDICT, text) || matches(CONFIDENCE, text) || matches(VERDICT_LINE, text) || matches(SOFT_DIRECTIONAL, text);
}
