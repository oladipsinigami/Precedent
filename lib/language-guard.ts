import type { Briefing } from "./types";

const VERDICT = /\b(buy|sell|long|short)(?![- ]?(?:term|dated|horizon|duration|period|interest|squeeze|fall|run))\b/gi;
const CONFIDENCE = /\b\d{1,3}\s*%\s*(confidence|probable|probability|sure|conviction)\b/gi;
const VERDICT_LINE =
  /\b(i recommend|you should|strong (buy|sell)|this is a (buy|sell)|open a (long|short)|go long|go short|enter (a )?position)\b/gi;
const SOFT_DIRECTIONAL =
  /\b(upside bias|downside bias|favors higher prices|favors lower prices|constructive setup|cautious setup|lean(?:s|ing)? long|lean(?:s|ing)? short|lean(?:s|ing)? constructive|lean(?:s|ing)? cautious|history is supportive|history is unsupportive|supportive history|bullish setup|bearish setup|positive price bias|negative price bias|upside possible|downside possible|expect a pullback|bullish case|bearish case|upside case|downside case|further upside|further downside|room for upside|room for downside|tempts? traders|expect the same direction|moderate upside|moderate downside|tilted to the upside|tilted to the downside|on the upside|on the downside|struggles to go higher|may need a pause|tailwinds?|headwinds?|slight edge|small edge|modest edge|marginal edge|favoring patience|overnight speculation|news sentiment|bullish sentiment|bearish sentiment|remain(?:s|ed|ing)? constructive|remain(?:s|ed|ing)? cautious|is constructive|looks constructive|appears constructive|constructive (?:tone|stance|view|outlook|lean|bias|posture)|cautious (?:tone|stance|view|outlook|lean|bias|posture)|poised (?:to|for)|room to run)\b/gi;

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
    .replace(/\bresistance\s+(band|zone|level)(?!\s*\([^)]*selling\))/gi, "resistance $1 (a price level where historical selling activity previously concentrated)")
    .replace(/\bsupport\s+(zone|band|level)(?!\s*\([^)]*buying\))/gi, "support $1 (a price level where historical buying activity previously concentrated)")
    .replace(/\boverbought(?!\s*\([^)]*fast\))/gi, "overbought (where recent gains were unusually fast relative to the baseline)")
    .replace(/\boversold(?!\s*\([^)]*fast\))/gi, "oversold (where recent drops were unusually fast relative to the baseline)");
}

function banSoftDirectional(text: string): string {
  return text
    .replace(/\b(a\s+)?(slight|small|modest|marginal)\s+edge\s+to\s+(the\s+)?(upward|downward)(\s+movement)?\b/gi, "a split historical distribution")
    .replace(/\b(a\s+)?(slight|small|modest|marginal)\s+edge\s+(to|toward|for)\s+(the\s+)?(upside|downside|higher|lower)\b/gi, "a split historical distribution")
    .replace(/\b(slight|small|modest|marginal)\s+edge\b/gi, "split outcome")
    .replace(/\bhas\s+an\s+edge\b/gi, "shows mixed outcomes")
    .replace(/\bgives\s+an\s+edge\b/gi, "shows historical variation")
    .replace(/\bfavoring\s+patience\s+over\s+(overnight\s+)?speculation\b/gi, "noting differences between 24-hour token trading and cash market sessions")
    .replace(/\bfavor(?:s|ing)?\s+patience\b/gi, "comparing session liquidity")
    .replace(/\bpatience\s+over\s+(overnight\s+)?speculation\b/gi, "differences between 24-hour token trading and cash sessions")
    .replace(/\bovernight\s+speculation\b/gi, "overnight token trading")
    .replace(/\b(bullish|bearish|positive|negative|constructive|cautious)\s+news\s+sentiment\b/gi, "recent news coverage")
    .replace(/\bnews\s+sentiment\s+is\s+(bullish|bearish|positive|negative|constructive|cautious)\b/gi, "news headlines reflect recent developments")
    .replace(/\bnews\s+sentiment\b/gi, "news coverage")
    .replace(/\b(bullish|bearish)\s+sentiment\b/gi, "sentiment readings")
    .replace(/\bremain(?:s|ed|ing)?\s+constructive\b/gi, "recorded recent gains")
    .replace(/\bremain(?:s|ed|ing)?\s+cautious\b/gi, "recorded recent declines")
    .replace(/\b(is|looks|appears)\s+constructive\b/gi, "reflects recent price levels")
    .replace(/\bconstructive\s+(tone|stance|view|outlook|lean|bias|posture)\b/gi, "historical price data")
    .replace(/\bcautious\s+(tone|stance|view|outlook|lean|bias|posture)\b/gi, "historical price data")
    .replace(/\blean(?:s|ing)?\s+constructive\b/gi, "shows positive recent sessions")
    .replace(/\blean(?:s|ing)?\s+cautious\b/gi, "shows negative recent sessions")
    .replace(/\btempts?\s+traders\s+to\s+expect\s+the\s+same\s+direction(\s+to\s+continue)?\b/gi, "produced a split distribution rather than a uniform move")
    .replace(/\btempts?\s+traders\s+to\s+expect\b/gi, "shows past outcomes were split")
    .replace(/\btempts?\s+traders\b/gi, "shows mixed historical results")
    .replace(/\bexpect\s+the\s+same\s+direction(\s+to\s+continue)?\b/gi, "historical outcomes were split")
    .replace(/\b(moderate\s+)?upside\s+possible\b/gi, "past sessions showed positive follow-through")
    .replace(/\b(moderate\s+)?downside\s+possible\b/gi, "past sessions showed negative follow-through")
    .replace(/\bexpect\s+a\s+pullback\s+before\s+further\s+upside\b/gi, "prices fluctuated across past sessions")
    .replace(/\bexpect\s+a\s+pullback\s+before\s+further\s+downside\b/gi, "prices fluctuated across past sessions")
    .replace(/\bexpect\s+a\s+pullback\s+before\s+[^.\n]+/gi, "prices fluctuated across past sessions")
    .replace(/\bexpect\s+a\s+pullback\b/gi, "prices may fluctuate")
    .replace(/\bfurther\s+upside\b/gi, "higher price points")
    .replace(/\bfurther\s+downside\b/gi, "lower price points")
    .replace(/\bon\s+the\s+downside\s+to\s+([^.\n]+?)\s+on\s+the\s+upside\b/gi, "to $1")
    .replace(/\bon\s+the\s+upside\b/gi, "")
    .replace(/\bon\s+the\s+downside\b/gi, "")
    .replace(/\b(moderate\s+)?(upside|downside)\s+potential\b/gi, "historical range")
    .replace(/\broom\s+for\s+(upside|downside)\b/gi, "historical range")
    .replace(/\b(bullish|upside|constructive)\s+case\b/gi, "historical upward sample")
    .replace(/\b(bearish|downside|cautious)\s+case\b/gi, "historical downward sample")
    .replace(/\b(bullish|bearish)\s+(setup|bias|outlook|view|stance|lean)\b/gi, "mixed market signals")
    .replace(/\b(upside|downside)\s+bias\b/gi, "historical price range")
    .replace(/\bfavors\s+(higher|lower)\s+prices\b/gi, "shows mixed historical results")
    .replace(/\b(constructive|cautious)\s+setup\b/gi, "current chart pattern")
    .replace(/\blean(?:s|ing)?\s+(long|short|higher|lower|bullish|bearish)\b/gi, "shows mixed signals")
    .replace(/\bhistory\s+is\s+supportive\b/gi, "past data provides context")
    .replace(/\bhistory\s+is\s+unsupportive\b/gi, "past data was mixed")
    .replace(/\bsupportive\s+history\b/gi, "past data")
    .replace(/\b(positive|negative)\s+price\s+bias\b/gi, "mixed historical data")
    .replace(/\btilted\s+to\s+the\s+(upside|downside)\b/gi, "mixed across the sample")
    .replace(/\bstruggles\s+to\s+go\s+higher\b/gi, "is trading near recent levels")
    .replace(/\bmay\s+need\s+a\s+pause\b/gi, "has recorded recent gains")
    .replace(/\bpoised\s+(to|for)\b/gi, "positioned around")
    .replace(/\broom\s+to\s+run\b/gi, "historical price spread")
    .replace(/\b(moderate\s+)?upside\b/gi, "upward movement")
    .replace(/\b(moderate\s+)?downside\b/gi, "downward movement");
}

export function cleanHistoricalSummary(text: string | undefined | null): string {
  if (!text || typeof text !== "string") return "";
  let s = rewrite(text);
  s = s.replace(/^(moderate\s+)?(upside|downside)(\s+possible)?[:\s—–-]*/i, "");
  s = s.replace(/^(bullish|bearish|constructive|cautious)(\s+(case|setup|lean|outlook|bias))?[:\s—–-]*/i, "");
  s = s.replace(/^(the\s+)?(upside|downside)\s+case[:\s—–-]*/i, "");
  s = s.replace(/^the\s+evidence\s+remains\s+mixed[:\s—–-]*/i, "");
  s = s.replace(/^prices\s+moved\s+(higher|lower)\s+in\s+some\s+past\s+sessions[:\s—–-]*/i, "");
  s = s.replace(/^(with\s+a\s+)?(slight|small|modest)\s+edge\s+to\s+[^,.:—–-]+[,.:—–-]*/i, "");
  s = s.replace(/^(showing\s+a\s+|a\s+)?split\s+historical\s+distribution[:\s—–-]*/i, "");
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
            !/\b(n\/?a|null|undefined|moved\s+n\/?a)\b/i.test(example.whatHappened) &&
            !/\b(n\/?a|null|undefined)\b/i.test(example.when) &&
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
