import type { Briefing } from "./types";

const VERDICT = /\b(buy|sell|long|short)(?![- ]?(?:term|dated|horizon|duration|period|interest|squeeze|fall|run))\b/gi;
const CONFIDENCE =
  /\b(?:\d{1,3}(?:\.\d+)?\s*%\s*(?:confidence|probable|probability|sure|conviction|chance|odds|likelihood|certainty)|(?:confidence|probability|chance|odds|likelihood|certainty)\s*(?:of|is|at)?\s*\d{1,3}(?:\.\d+)?\s*%)\b/gi;
const FINAL_RECOMMENDATION =
  /\b(?:final\s+|overall\s+|desk\s+|our\s+)?(?:recommendation|verdict|rating|call|action|stance|conclusion)\s*(?:is\s+to\s+|is\s+|:\s*|\s*—\s*|\s*–\s*)(?:to\s+)?(?:strong\s+)?(?:buy|sell|long|short)\b/gi;
const VERDICT_LINE =
  /\b(?:i\s+recommend|we\s+recommend|you\s+should(?:\s+(?:enter(?:\s+here|\s+now|\s+at\s+[^,.;\n]+)?|buy|sell|short|go\s+long|go\s+short|exit|take\s+profits?|trade))?|(?:strong\s+)?(?:buy|sell)\s+signal|strong\s+(?:buy|sell)|this\s+is\s+a\s+(?:buy|sell)|open\s+a\s+(?:long|short)(?:\s+position)?|take\s+a\s+(?:long|short)(?:\s+position)?|go\s+(?:long|short)|enter\s+(?:here|now|at\s+[^,.;\n]+|(?:a\s+)?position))\b/gi;
// "bullish/bearish sentiment" is allowed ONLY when explicitly attributed to
// reported discourse (e.g. "X sentiment was bearish") — that is the news
// pillar describing its data, not the desk taking a stance. The SENTIMENT_ATTR
// pattern below detects un-attributed uses; banSoftDirectional rewrites those.
const SOFT_DIRECTIONAL =
  /\b(upside bias|downside bias|favors higher prices|favors lower prices|constructive setup|cautious setup|lean(?:s|ing)? long|lean(?:s|ing)? short|lean(?:s|ing)? constructive|lean(?:s|ing)? cautious|history is supportive|history is unsupportive|supportive history|bullish setup|bearish setup|positive price bias|negative price bias|upside possible|downside possible|expect a pullback|bullish case|bearish case|upside case|downside case|further upside|further downside|room for upside|room for downside|tempts? traders|expect the same direction|moderate upside|moderate downside|tilted to the upside|tilted to the downside|on the upside|on the downside|struggles to go higher|may need a pause|tailwinds?|headwinds?|slight edge|small edge|modest edge|marginal edge|favoring patience|overnight speculation|news sentiment|bullish sentiment|bearish sentiment|remain(?:s|ed|ing)? constructive|remain(?:s|ed|ing)? cautious|is constructive|looks constructive|appears constructive|constructive (?:tone|stance|view|outlook|lean|bias|posture)|cautious (?:tone|stance|view|outlook|lean|bias|posture)|poised (?:to|for)|room to run)\b/gi;
const SENTIMENT_ATTR =
  /(?:headline|news|x|twitter|social|reddit|retail|discourse|media|press|aggregate|reported|coverage)[^.\n]{0,40}\b(?:bullish|bearish) sentiment\b|\b(?:bullish|bearish) sentiment\b[^.\n]{0,40}(?:in|across|among|from|on)\s+(?:headlines|news|x|twitter|social|reddit|retail|discourse|media|coverage|posts)/i;

let lastRewriteCount = 0;
let lastRewriteOccurred = false;

export function didLastGuardRewrite(): boolean {
  return lastRewriteOccurred;
}

export function getLastRewriteCount(): number {
  return lastRewriteCount;
}

function matches(regex: RegExp, text: string): boolean {
  regex.lastIndex = 0;
  const result = regex.test(text);
  regex.lastIndex = 0;
  return result;
}

function demystifyTerm(
  text: string,
  key: string,
  matcher: RegExp,
  gloss: string | ((match: string, ...args: string[]) => string),
  shortName: string | ((match: string, ...args: string[]) => string),
  seen: Set<string>,
): string {
  if (seen.has(key)) {
    if (typeof shortName === "function") {
      return text.replace(matcher, (m, ...a) => shortName(m, ...a));
    }
    return text.replace(matcher, shortName);
  }
  let firstFound = false;
  return text.replace(matcher, (match, ...args) => {
    if (!firstFound) {
      firstFound = true;
      seen.add(key);
      return typeof gloss === "function" ? (gloss as Function)(match, ...args) : gloss;
    }
    return typeof shortName === "function" ? (shortName as Function)(match, ...args) : shortName;
  });
}

function demystifyJargon(text: string, seen: Set<string> = new Set()): string {
  let out = text;

  if (/\bshort-term\s+strength\s+(score|indicator)\s*\([^)]*RSI[^)]*\)/i.test(out)) {
    seen.add("RSI");
  }
  if (/\btrend-speed\s+indicator\s*\([^)]*MACD[^)]*\)/i.test(out)) {
    seen.add("MACD");
  }

  out = demystifyTerm(
    out,
    "RSI_stretch",
    /(?<!\()\bRSI\s+stretch(?:\s*\([^)]*\))?(?!\))/gi,
    "RSI stretch (a condition where the short-term strength indicator reached an extreme)",
    "RSI stretch",
    seen,
  );

  out = demystifyTerm(
    out,
    "RSI",
    /(?<!\()\b(?!RSI\s+stretch\b)RSI(?:\s*\([^)]*\))?(?!\))/gi,
    "RSI (a short-term strength score from 0 to 100)",
    "RSI",
    seen,
  );

  out = demystifyTerm(
    out,
    "MACD",
    /(?<!\()\bMACD(?:\s*\([^)]*\))?(?!\))/gi,
    "MACD (a trend-speed indicator)",
    "MACD",
    seen,
  );

  out = demystifyTerm(
    out,
    "overbought",
    /\boverbought(?:\s*\([^)]*\))?/gi,
    "overbought (where recent gains were unusually fast relative to the baseline)",
    "overbought",
    seen,
  );

  out = demystifyTerm(
    out,
    "oversold",
    /\boversold(?:\s*\([^)]*\))?/gi,
    "oversold (where recent drops were unusually fast relative to the baseline)",
    "oversold",
    seen,
  );

  out = demystifyTerm(
    out,
    "mean_reversion",
    /\bmean\s+reversion(?:\s*\([^)]*\))?/gi,
    "mean reversion (the tendency of prices to return toward their historical average)",
    "mean reversion",
    seen,
  );

  out = demystifyTerm(
    out,
    "overextended",
    /\boverextended(?:\s*\([^)]*\))?/gi,
    "overextended (moved unusually far away from its recent average)",
    "overextended",
    seen,
  );

  out = demystifyTerm(
    out,
    "consolidation",
    /\bconsolidation(?:\s*\([^)]*\))?/gi,
    "consolidation (a period where price moves sideways in a tight range)",
    "consolidation",
    seen,
  );

  out = demystifyTerm(
    out,
    "resistance",
    /\bresistance\s+(band|zone|level)(?:\s*\([^)]*\))?/gi,
    (_m, type) => `resistance ${type} (a price level where historical selling activity previously concentrated)`,
    (_m, type) => `resistance ${type}`,
    seen,
  );

  out = demystifyTerm(
    out,
    "support",
    /\bsupport\s+(zone|band|level)(?:\s*\([^)]*\))?/gi,
    (_m, type) => `support ${type} (a price level where historical buying activity previously concentrated)`,
    (_m, type) => `support ${type}`,
    seen,
  );

  return out;
}

function banSoftDirectional(text: string): string {
  // Protect discourse-attributed sentiment reports ("aggregate X sentiment was
  // bearish across posts") before the blanket "(bullish|bearish) sentiment"
  // rewrite below — the news pillar is describing its data, not taking a side.
  const PLACEHOLDER_BULL = "PRECDISCOURSESENTBULL";
  const PLACEHOLDER_BEAR = "PRECDISCOURSESENTBEAR";
  let protectedText = "";
  let working = text;
  if (SENTIMENT_ATTR.test(text)) {
    working = text.replace(/\bbullish sentiment\b/gi, (m) => {
      protectedText += m + "";
      return PLACEHOLDER_BULL;
    });
    working = working.replace(/\bbearish sentiment\b/gi, (m) => {
      protectedText += m;
      return PLACEHOLDER_BEAR;
    });
  }
  return finishBanSoftDirectional(working)
    .replace(new RegExp(PLACEHOLDER_BULL, "g"), "bullish sentiment")
    .replace(new RegExp(PLACEHOLDER_BEAR, "g"), "bearish sentiment");
}

function finishBanSoftDirectional(text: string): string {
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

export function cleanHistoricalSummary(
  text: string | undefined | null,
  seen: Set<string> = new Set(),
  onRewrite?: (orig: string, repl: string) => void,
): string {
  if (!text || typeof text !== "string") return "";
  const original = text;
  let s = rewrite(text, seen, onRewrite);
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
  if (s !== original && onRewrite) {
    onRewrite(original, s);
  }
  return s;
}

export function sanitizeTitle(
  title: string | undefined | null,
  seen: Set<string> = new Set(),
  onRewrite?: (orig: string, repl: string) => void,
): string {
  if (!title || typeof title !== "string") return "Research Memo";
  const original = title;
  let t = title.trim();

  // Strip prefix recommendation / verdict markers
  t = t.replace(
    /^(?:final\s+|overall\s+|desk\s+|our\s+)?(?:recommendation|verdict|rating|call|action|stance|conclusion|headline)\s*[:—–-]\s*(?:strong\s+)?(?:buy|sell|long|short)\b[:\s—–-]*/gi,
    "",
  );
  t = t.replace(/^(?:strong\s+)?(?:buy|sell|long|short)\b[:\s—–-]*/gi, "");

  if (
    !t.trim() ||
    /^(?:buy|sell|long|short|strong\s+buy|strong\s+sell|purchasing|selling|an\s+upward\s+position|a\s+downward\s+position|this\s+desk\s+does\s+not\s+take\s+a\s+side|this\s+desk\s+does\s+not\s+issue\s+directional\s+recommendations)$/i.test(
      t.trim(),
    )
  ) {
    t = "Research Memo";
  } else {
    t = rewrite(t, seen, onRewrite);
    t = t.replace(/the (constructive|cautious) case/gi, "setup").trim();
  }

  if (
    !t.trim() ||
    /^(?:buy|sell|long|short|strong\s+buy|strong\s+sell|purchasing|selling|an\s+upward\s+position|a\s+downward\s+position|this\s+desk\s+does\s+not\s+take\s+a\s+side|this\s+desk\s+does\s+not\s+issue\s+directional\s+recommendations)$/i.test(
      t.trim(),
    )
  ) {
    t = "Research Memo";
  }

  if (t !== original && onRewrite) {
    onRewrite(original, t);
  }
  return t;
}

function rewrite(
  text: string | undefined | null,
  seen: Set<string> = new Set(),
  onRewrite?: (orig: string, repl: string) => void,
): string {
  if (!text || typeof text !== "string") return "";
  const original = text;
  let out = text
    .replace(CONFIDENCE, "an unstated conviction (removed)")
    .replace(FINAL_RECOMMENDATION, "this desk does not take a side")
    .replace(VERDICT_LINE, "this desk does not take a side");
  out = banSoftDirectional(out);
  out = demystifyJargon(out, seen);
  out = out.replace(VERDICT, (m) => {
    const lower = m.toLowerCase();
    if (lower === "buy") return "purchasing";
    if (lower === "sell") return "selling";
    if (lower === "long") return "an upward position";
    if (lower === "short") return "a downward position";
    return m;
  });

  if (out !== original && onRewrite) {
    onRewrite(original, out);
  }
  return out;
}

function scrubList(
  items: string[] | undefined | null,
  seen: Set<string> = new Set(),
  onRewrite?: (orig: string, repl: string) => void,
): string[] {
  return (items ?? [])
    .map((t) => rewrite(t, seen, onRewrite))
    .filter(
      (line) =>
        (!/this desk does not take a side/i.test(line) &&
          !/this desk does not issue directional recommendations/i.test(line)) ||
        line.length > 40,
    );
}

export function guardBriefing(briefing: Briefing): Briefing {
  const seenGlossary = new Set<string>();
  let localRewriteCount = 0;

  const onRewrite = (original: string, rewritten: string) => {
    if (original !== rewritten) {
      localRewriteCount++;
      console.info(
        `[LanguageGuard] Neutralized prohibited language: "${original.trim().slice(0, 75)}" -> "${rewritten.trim().slice(0, 75)}"`,
      );
    }
  };

  const title = sanitizeTitle(briefing.title, seenGlossary, onRewrite);
  const whatWeDid = rewrite(briefing.whatWeDid, seenGlossary, onRewrite);
  const historicalSummary =
    cleanHistoricalSummary(briefing.historicalStressTest?.summary, seenGlossary, onRewrite) ||
    "Historical cases show a range of past outcomes for context.";

  const results = (briefing.historicalStressTest?.results ?? []).map((result) => ({
    ...result,
    wentUp: rewrite(result?.wentUp, seenGlossary, onRewrite),
    typicalMove: rewrite(result?.typicalMove, seenGlossary, onRewrite),
    median: rewrite(result?.median, seenGlossary, onRewrite),
  }));

  const examples = (briefing.historicalStressTest?.examples ?? [])
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
      when: rewrite(example?.when, seenGlossary, onRewrite),
      whatHappened: rewrite(example?.whatHappened, seenGlossary, onRewrite),
    }));

  const importantNote = rewrite(briefing.historicalStressTest?.importantNote, seenGlossary, onRewrite);
  const otherThingsWeChecked = scrubList(briefing.otherThingsWeChecked, seenGlossary, onRewrite);
  const whereThingsDoNotAgree = (briefing.whereThingsDoNotAgree ?? []).map((item) => ({
    conflict: rewrite(item?.conflict, seenGlossary, onRewrite),
    whyItMatters: rewrite(item?.whyItMatters, seenGlossary, onRewrite),
  }));
  const simpleTakeAways = scrubList(briefing.simpleTakeAways, seenGlossary, onRewrite);
  const questionsOnlyYouCanAnswer = scrubList(briefing.questionsOnlyYouCanAnswer, seenGlossary, onRewrite);
  const unverified = briefing.unverified ? scrubList(briefing.unverified, seenGlossary, onRewrite) : undefined;
  const styleNote = rewrite(briefing.styleNote, seenGlossary, onRewrite);
  const flags = briefing.flags
    ? {
        ...briefing.flags,
        balanceSheet: scrubList(briefing.flags.balanceSheet, seenGlossary, onRewrite),
        analogQuality: briefing.flags.analogQuality,
      }
    : undefined;
  const evidence = (briefing.evidence ?? []).map((e) => ({ ...e, claim: rewrite(e?.claim, seenGlossary, onRewrite) }));
  const tension = (briefing.tension ?? []).map((t) => ({
    left: rewrite(t?.left, seenGlossary, onRewrite),
    right: rewrite(t?.right, seenGlossary, onRewrite),
    whyItMatters: rewrite(t?.whyItMatters, seenGlossary, onRewrite),
  }));
  const historicalAnalog = {
    ...briefing.historicalAnalog,
    setup: rewrite(briefing.historicalAnalog?.setup, seenGlossary, onRewrite),
    analogs: (briefing.historicalAnalog?.analogs ?? []).map((a) => ({
      ...a,
      followed: rewrite(a?.followed, seenGlossary, onRewrite),
      similarity: rewrite(a?.similarity, seenGlossary, onRewrite),
    })),
    baseRates: (briefing.historicalAnalog?.baseRates ?? []).map((b) => ({
      ...b,
      note: rewrite(b?.note, seenGlossary, onRewrite),
      range: rewrite(b?.range, seenGlossary, onRewrite),
    })),
    caveat: rewrite(briefing.historicalAnalog?.caveat, seenGlossary, onRewrite),
  };
  const considerations = {
    forStyle: scrubList(briefing.considerations?.forStyle, seenGlossary, onRewrite),
    invalidation: scrubList(briefing.considerations?.invalidation, seenGlossary, onRewrite),
    questions: scrubList(briefing.considerations?.questions, seenGlossary, onRewrite),
  };

  lastRewriteCount = localRewriteCount;
  lastRewriteOccurred = localRewriteCount > 0;

  if (localRewriteCount > 0) {
    console.info(
      `[LanguageGuard] Sanitized research memo: ${localRewriteCount} prohibited directional or verdict pattern(s) rewritten.`,
    );
  }

  return {
    ...briefing,
    title,
    whatWeDid,
    historicalStressTest: {
      ...briefing.historicalStressTest,
      summary: historicalSummary,
      results,
      examples,
      importantNote,
    },
    otherThingsWeChecked,
    whereThingsDoNotAgree,
    simpleTakeAways,
    questionsOnlyYouCanAnswer,
    unverified,
    styleNote,
    flags,
    evidence,
    tension,
    historicalAnalog,
    considerations,
  };
}

export function looksLikeVerdict(text: string): boolean {
  return (
    matches(VERDICT, text) ||
    matches(CONFIDENCE, text) ||
    matches(FINAL_RECOMMENDATION, text) ||
    matches(VERDICT_LINE, text) ||
    matches(SOFT_DIRECTIONAL, text)
  );
}

/**
 * Edge case test cases documenting prohibited vs allowed language:
 *
 * PROHIBITED (must be blocked or rewritten):
 * - BUY / SELL / LONG / SHORT used as headlines or final recommendations (e.g. "BUY AAPL", "Final Recommendation: BUY")
 * - Confidence percentages used as a verdict ("78% chance of higher prices", "90% probability of rally")
 * - Imperative trading language ("You should enter here", "Strong sell signal", "Enter a position now")
 *
 * ALLOWED (must be preserved without alteration):
 * - "Went up X times out of Y"
 * - "Typical move was usually between …"
 * - "The tape and the filings currently disagree"
 * - "Questions only you can answer"
 * - "Historical results are past occurrences only, not predictions."
 */
export const LANGUAGE_GUARD_EDGE_CASES = [
  // Prohibited edge cases
  { label: "Headline BUY", text: "BUY AAPL", isProhibited: true },
  { label: "Headline STRONG BUY", text: "STRONG BUY", isProhibited: true },
  { label: "Final Recommendation BUY", text: "Final Recommendation: BUY", isProhibited: true },
  { label: "Verdict SHORT", text: "Verdict: SHORT", isProhibited: true },
  { label: "78% chance", text: "78% chance of higher prices", isProhibited: true },
  { label: "90% probability", text: "90% probability of rally", isProhibited: true },
  { label: "You should enter here", text: "You should enter here", isProhibited: true },
  { label: "Strong sell signal", text: "Strong sell signal", isProhibited: true },

  // Allowed base-rate edge cases
  { label: "Went up X times out of Y", text: "Went up 14 times out of 20", isProhibited: false },
  { label: "Typical move", text: "Typical move was usually between -1.5% and +2.1%", isProhibited: false },
  { label: "Tape and filings disagree", text: "The tape and the filings currently disagree", isProhibited: false },
  { label: "Questions only you can answer", text: "Questions only you can answer", isProhibited: false },
  { label: "Mandatory disclaimer", text: "Historical results are past occurrences only, not predictions.", isProhibited: false },
  { label: "Attributed discourse sentiment", text: "Aggregate X discourse sentiment was bearish across 18 posts this run.", isProhibited: false },
] as const;

export function runLanguageGuardSelfTest(): {
  passed: boolean;
  results: { label: string; passed: boolean; input: string; output: string }[];
} {
  const results = LANGUAGE_GUARD_EDGE_CASES.map((tc) => {
    let output = "";
    if (tc.label.startsWith("Headline")) {
      output = sanitizeTitle(tc.text);
    } else {
      output = rewrite(tc.text);
    }

    let passed = false;
    if (tc.isProhibited) {
      passed = output !== tc.text && !looksLikeVerdict(output);
    } else {
      passed = output === tc.text;
    }

    return { label: tc.label, passed, input: tc.text, output };
  });

  const allPassed = results.every((r) => r.passed);
  return { passed: allPassed, results };
}
