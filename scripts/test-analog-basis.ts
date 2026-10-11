import assert from "node:assert/strict";
import { guardBriefing } from "../lib/language-guard";
import { deterministicBriefing } from "../lib/deterministic-briefing";
import { findName } from "../lib/universe";
import type { Briefing } from "../lib/types";

const cases: Array<[string, () => void]> = [];
function test(name: string, fn: () => void) { cases.push([name, fn]); }

function briefingWith(excess: boolean): Briefing {
  return {
    title: `${excess ? "excess" : "raw"} base rate test`,
    whatWeDid: "test",
    setup: "",
    tapeReading: "",
    historicalRhyme: "",
    otherThingsWeChecked: [],
    simpleTakeAways: [],
    whereThingsDoNotAgree: [],
    questionsOnlyYouCanAnswer: [],
    evidence: [],
    tension: [],
    unverified: [],
    styleNote: "",
    model: "test",
    historicalStressTest: {
      summary: "test",
      sampleSize: 12,
      importantNote: "not a forecast",
      results: [
        {
          period: "Next 5 trading days",
          wentUp: excess ? "Beat the baseline 7 of 12" : "Rose 7 of 12",
          typicalMove: "Typical move: usually between -1.0% and +2.0%",
          median: "+0.4%",
        },
      ],
      examples: [],
    },
  } as unknown as Briefing;
}

function guardedWentUp(text: string): string {
  const briefing = briefingWith(true);
  briefing.historicalStressTest.results[0]!.wentUp = text;
  return guardBriefing(briefing).historicalStressTest.results[0]!.wentUp;
}

test("the briefung wording follows the basis flag", () => {
  const name = findName("AAPL")!;
  const excess = deterministicBriefing({
    style: "swing",
    question: "q",
    name,
    regime: "normal",
    pillars: {
      fundamentals: { ok: false } as never,
      technicals: { ok: false } as never,
      news: { ok: false } as never,
      marketStructure: { ok: false, universeSize: 0 } as never,
      analogs: {
        ok: true,
        closest: [],
        ranges: [{ horizon: "5d", n: 12, p10: -2, p50: 0.5, p90: 3, pUp: 0.583, basis: "excess" }],
        overlay: [],
        sample: { n: 12, symbols: 1, sessions: 0 },
        caveats: [],
        sources: [],
      },
    } as never,
    flags: undefined,
  });
  assert.ok(
    excess.historicalStressTest.results[0]!.wentUp.startsWith("Beat the baseline"),
    `excess basis must not say "went up": ${excess.historicalStressTest.results[0]!.wentUp}`,
  );
});

test("a raw basis still uses rose, not went up", () => {
  const name = findName("AAPL")!;
  const raw = deterministicBriefing({
    style: "swing",
    question: "q",
    name,
    regime: "normal",
    pillars: {
      fundamentals: { ok: false } as never,
      technicals: { ok: false } as never,
      news: { ok: false } as never,
      marketStructure: { ok: false, universeSize: 0 } as never,
      analogs: {
        ok: true,
        closest: [],
        ranges: [{ horizon: "5d", n: 12, p10: -2, p50: 0.5, p90: 3, pUp: 0.5, basis: "raw" }],
        overlay: [],
        sample: { n: 12, symbols: 1, sessions: 0 },
        caveats: [],
        sources: [],
      },
    } as never,
    flags: undefined,
  });
  assert.ok(
    raw.historicalStressTest.results[0]!.wentUp.startsWith("Rose"),
    `raw basis should read "Rose": ${raw.historicalStressTest.results[0]!.wentUp}`,
  );
});

test("the guard rewrites stray went-up phrasing", () => {
  assert.match(guardedWentUp("The band went up 7 times out of 12"), /beat the baseline 7 times out of 12/i);
});

test("a raw-basis briefing survives the guard unchanged", () => {
  const raw = briefingWith(false);
  const guardedRaw = guardBriefing(raw);
  assert.match(guardedRaw.historicalStressTest.results[0]!.wentUp, /^Rose /);
});

test("an excess-basis briefing never says went up after the guard", () => {
  const excess = briefingWith(true);
  const guardedExcess = guardBriefing(excess);
  const serialised = JSON.stringify(guardedExcess).toLowerCase();
  assert.ok(!serialised.includes("went up"), `"went up" survived the guard: ${serialised.slice(0, 200)}`);
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`[PASS] ${name}`); }
  catch (err) { failed += 1; console.error(`[FAIL] ${name}`); console.error(err); }
}
if (failed > 0) { console.error(`${failed} of ${cases.length} analog-basis checks failed`); process.exit(1); }
console.log(`${cases.length} analog-basis checks passed`);
