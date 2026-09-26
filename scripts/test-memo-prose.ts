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

console.log(`\n${passed} memo-prose checks passed.`);