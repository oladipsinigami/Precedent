import { deterministicBriefing } from "../lib/deterministic-briefing";
import type { Briefing, PillarBundle, Regime, TradingStyle } from "../lib/types";
import type { NameCard } from "../lib/universe";

let passed = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`[PASS] ${label}`);
    passed++;
  } else {
    console.log(`[FAIL] ${label}`);
    process.exitCode = 1;
  }
}

const name: NameCard = {
  native: "AAPL",
  rToken: "rAAPL",
  name: "Apple Inc.",
  sector: "Technology",
  bitgetSymbols: ["RAAPLUSDT"],
  aliases: ["apple"],
};

const pillars = {
  technicals: {
    ok: true,
    rTokenGap:
      "Bitget rToken tape RAAPLUSDT last 341.1 vs native 341.07 (+0.01% vs cash last). Treat as a venue print, not NAV.",
    native: { last: 341.07, changePct: 0.4, high52: 260, low52: 124, volume: 1, asOf: "2026-09-26" },
    trend: "up", momentum: "neutral", volatility: "moderate",
    levels: { support: [], resistance: [] }, indicators: { rsi14: 55 }, spark: [], notes: [], sources: [],
  },
  analogs: {
    ok: true,
    ranges: [
      { horizon: "5d", n: 300, p10: -4.13, p50: 0.09, p90: 4.92, pUp: 0.51 },
    ],
    closest: [], overlay: [], sample: { n: 300, symbols: 203, sessions: 241 }, caveats: [], sources: [],
  },
} as unknown as PillarBundle;

const briefing: Briefing = deterministicBriefing({
  style: "swing" as TradingStyle,
  question: "Where do the pillars disagree?",
  name,
  regime: "trending-up" as Regime,
  pillars,
  flags: undefined,
});

const allText = [
  ...briefing.otherThingsWeChecked,
  ...briefing.simpleTakeAways,
  ...briefing.whereThingsDoNotAgree.map((t) => `${t.conflict} ${t.whyItMatters}`),
  briefing.whatWeDid,
].join("\n");

check("no doubled sentence period anywhere in the memo", !/\.\.(?!\.)/.test(allText));
check("the 'not NAV' clause renders with a single period", /not NAV\.(?!\.)/.test(allText));
check("no raw EDGAR MMDD fiscal code leaks into the memo", !/Fiscal year end on file: \d{4}\b/.test(allText));
check("no empty sentence fragments are emitted", !/\.\s*\./.test(allText));
check("memo still reports the analog sample size", briefing.historicalStressTest.sampleSize === 300);

// Punctuation in this file is authored as real Unicode. It once reached the live
// site as cp1252 mojibake - the memo title rendered as "rAAPL <U+00E2><U+20AC><U+201D>
// Swing trader stress test" because each character's UTF-8 bytes had been decoded
// through a legacy codepage and written back. Nothing else in the suite notices,
// so the corruption is pinned here directly.
const MOJIBAKE = /[\u00c2\u00c3\u00e2][\u0080-\u00ff\u2014\u201c\u201d\u20ac\u2030\u02c6]/;
const wholeMemo = JSON.stringify(briefing);

check("no cp1252 mojibake anywhere in the memo", !MOJIBAKE.test(wholeMemo));
check("the title uses a real em dash", briefing.title.includes("\u2014"));
check(
  "the analog band line uses real middle dots",
  briefing.historicalAnalog.baseRates.every((r) => r.range.includes("\u00b7")),
);

// The overnight matcher keys off the multiplication sign in "7x24". Mojibake
// turned that character class into [<U+00C3><U+2014>x], which could never match
// the real glyph, so the typographic spelling silently fell out of the branch.
const overnight = deterministicBriefing({
  style: "swing" as TradingStyle,
  question: "Stress-test the AAPL setup over the 7\u00d724 window versus the cash session.",
  name,
  regime: "trending-up" as Regime,
  pillars,
  flags: undefined,
});
const overnightAscii = deterministicBriefing({
  style: "swing" as TradingStyle,
  question: "Stress-test the AAPL setup over the 7x24 window versus the cash session.",
  name,
  regime: "trending-up" as Regime,
  pillars,
  flags: undefined,
});

check(
  "'7\u00d724' and '7x24' are treated as the same overnight question",
  overnight.whatWeDid === overnightAscii.whatWeDid,
);

// Pillar sentences are authored as complete sentences, so they can legitimately
// end in any terminal mark. inline() only needs to strip the mark that an outer
// template is about to supply; if it handled "." alone, a pillar ending in "!"
// or "?" would render "basis!- gap" style double punctuation in the memo.
const endings = [".", "!", "?", ":", ";", ". ", "…", "?!", ""];
const rendered = endings.map((mark) => {
  const marked = { ...pillars, technicals: { ...pillars.technicals, rTokenGap: `Venue basis is open${mark}` } };
  const b = deterministicBriefing({
    style: "swing" as TradingStyle,
    question: "Where do the pillars disagree?",
    name,
    regime: "trending-up" as Regime,
    pillars: marked as PillarBundle,
    flags: undefined,
  });
  return [
    ...b.otherThingsWeChecked,
    ...b.whereThingsDoNotAgree.map((t) => t.conflict),
    ...b.simpleTakeAways,
  ].join(" ");
});

check("no doubled terminal punctuation for any pillar ending", !rendered.some((t) => /[.!?:;…]{2,}/.test(t)));
check("no orphaned punctuation before whitespace (e.g. '! .')", !rendered.some((t) => /[.!?:;]\s+[.!?:;]/.test(t)));
check("the sentence still ends in a single period", rendered.every((t) => /[.!?:;…]\s*$/.test(t.trim()) || t.trim() === ""));

console.log(`\n${passed} memo-prose checks passed.`);