import assert from "node:assert/strict";
import {
  atr,
  describeTrend,
  emaSeries,
  macd,
  pctChange,
  realizedVol,
  rsi,
  sma,
  swingLevels,
  type Bar,
} from "../lib/indicators";
import {
  assignCommunitiesByAverageLinkage,
  correlationMatrix,
  jacobiEigenvalues,
  logReturns,
  marcenkoPasturEdges,
  removeMarketMode,
  splitSpectrum,
} from "../lib/rmt";
import { reweightBriefing } from "../lib/reweight";
import { STYLES } from "../lib/style-profiles";
import type { Briefing } from "../lib/types";

function approx(actual: number | undefined, expected: number, eps = 1e-9, label = "value") {
  assert.ok(actual !== undefined, `${label} is undefined`);
  assert.ok(Math.abs(actual - expected) <= eps, `${label}: expected ${expected}, got ${actual}`);
}

function flatBars(count: number, c = 10, spread = 1): Bar[] {
  return Array.from({ length: count }, (_, i) => ({ t: i, o: c, h: c + spread, l: c - spread, c, v: 1000 }));
}

function baseBriefing(): Briefing {
  return {
    title: "AAPL — Swing trader stress test",
    whatWeDid: "Test memo.",
    historicalStressTest: { summary: "Test summary.", sampleSize: 0, results: [], examples: [], importantNote: "Test note." },
    otherThingsWeChecked: [],
    whereThingsDoNotAgree: [],
    simpleTakeAways: [],
    questionsOnlyYouCanAnswer: [],
    styleNote: "",
    model: "test",
    evidence: [],
    tension: [],
    historicalAnalog: { setup: "", analogs: [], baseRates: [], caveat: "" },
    considerations: { forStyle: [], invalidation: [], questions: [] },
    sources: [],
  };
}

const cases: [string, () => void][] = [
  // ---------- indicators ----------
  ["sma averages the last n values", () => {
    approx(sma([1, 2, 3, 4, 5], 3), 4);
    assert.equal(sma([1, 2], 3), undefined);
  }],
  ["emaSeries seeds with the first value and is flat for constant input", () => {
    assert.deepEqual(emaSeries([], 5), []);
    const out = emaSeries([10, 10, 10, 10], 5);
    assert.equal(out.length, 4);
    out.forEach((v) => approx(v, 10));
  }],
  ["rsi is 100 for only gains, 0 for only losses, 50 for balanced moves", () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    const down = Array.from({ length: 20 }, (_, i) => 100 - i);
    const balanced = Array.from({ length: 15 }, (_, i) => 100 + (i % 2));
    approx(rsi(up), 100);
    approx(rsi(down), 0);
    approx(rsi(balanced), 50);
    assert.equal(rsi([1, 2, 3], 14), undefined);
  }],
  ["macd needs 35 values and is zero for a constant series", () => {
    assert.equal(macd(Array(34).fill(1)), undefined);
    const out = macd(Array(40).fill(50));
    assert.ok(out);
    approx(out.macd, 0);
    approx(out.signal, 0);
  }],
  ["atr equals the constant true range", () => {
    approx(atr(flatBars(15, 10, 1)), 2);
    assert.equal(atr(flatBars(14)), undefined);
  }],
  ["realizedVol is zero for a flat series", () => {
    approx(realizedVol(Array(21).fill(100)), 0);
    assert.equal(realizedVol(Array(20).fill(100)), undefined);
  }],
  ["swingLevels uses extreme highs and lows, and needs 10 bars", () => {
    assert.deepEqual(swingLevels(flatBars(9)), { support: [], resistance: [] });
    const bars = Array.from({ length: 30 }, (_, i) => ({ t: i, o: 100 + i, h: 101 + i, l: 99 + i, c: 100 + i, v: 1 }));
    const levels = swingLevels(bars);
    assert.equal(levels.resistance[0], 130);
    assert.equal(levels.support[0], 99);
  }],
  ["pctChange computes percent change", () => {
    approx(pctChange(100, 110), 10);
    approx(pctChange(200, 150), -25);
  }],
  ["describeTrend recognizes stacked averages", () => {
    assert.match(describeTrend(110, 105, 100, 90), /above its 20-, 50-, and 200-day/);
    assert.match(describeTrend(80, 90, 95, 100), /below its 50- and 200-day/);
  }],

  // ---------- RMT ----------
  ["logReturns computes log returns and skips non-positive prices", () => {
    const out = logReturns([100, 110, 0, 121]);
    assert.equal(out.length, 1);
    approx(out[0], Math.log(1.1));
  }],
  ["correlationMatrix is symmetric with unit diagonal and detects ±1", () => {
    const a = [0.01, -0.02, 0.03, -0.01, 0.02];
    const b = a.map((x) => x * 2);
    const c = a.map((x) => -x);
    const m = correlationMatrix([a, b, c]);
    for (let i = 0; i < 3; i++) approx(m[i][i], 1);
    approx(m[0][1], 1, 1e-12, "corr(a, 2a)");
    approx(m[0][2], -1, 1e-12, "corr(a, -a)");
    approx(m[1][2], m[2][1]);
  }],
  ["Marcenko-Pastur edges match closed form", () => {
    const square = marcenkoPasturEdges(100, 100);
    approx(square.plus, 4);
    approx(square.minus, 0);
    const quarter = marcenkoPasturEdges(25, 100);
    approx(quarter.plus, 2.25);
    approx(quarter.minus, 0.25);
  }],
  ["jacobiEigenvalues returns known eigenvalues in descending order", () => {
    const vals = jacobiEigenvalues([[2, 1], [1, 2]]);
    approx(vals[0], 3, 1e-9);
    approx(vals[1], 1, 1e-9);
    jacobiEigenvalues([[1, 0, 0], [0, 1, 0], [0, 0, 1]]).forEach((v) => approx(v, 1));
  }],
  ["jacobiEigenvalues preserves the trace", () => {
    const m = [
      [1, 0.6, 0.3, 0.1],
      [0.6, 1, 0.5, 0.2],
      [0.3, 0.5, 1, 0.4],
      [0.1, 0.2, 0.4, 1],
    ];
    const vals = jacobiEigenvalues(m);
    approx(vals.reduce((s, v) => s + v, 0), 4, 1e-9, "trace");
    for (let i = 1; i < vals.length; i++) assert.ok(vals[i - 1] >= vals[i], "not descending");
  }],
  ["splitSpectrum finds no signal in an identity matrix", () => {
    const split = splitSpectrum([[1, 0, 0], [0, 1, 0], [0, 0, 1]], 1000);
    assert.equal(split.signalCount, 0);
    approx(split.marketModeStrength, 1 / 3, 1e-9);
    approx(split.infoBeyondNoisePct, 0);
  }],
  ["splitSpectrum flags a strong common factor as signal", () => {
    const n = 5;
    const rho = 0.8;
    const m = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : rho)));
    const split = splitSpectrum(m, 500);
    approx(split.values[0], 1 + (n - 1) * rho, 1e-9, "market mode");
    assert.equal(split.signalCount, 1);
  }],
  ["removeMarketMode deflates a planted common factor", () => {
    // Every series loads on the same planted factor with a small idiosyncratic
    // wobble, so raw correlations are all ~0.98 and no structure is visible.
    // Once the common factor is regressed out, the apparent similarity goes away.
    const t = 60;
    const factor = Array.from({ length: t }, (_, k) => Math.sin(k / 4) + 0.5 * Math.cos(k / 7));
    const returns = Array.from({ length: 8 }, (_, i) =>
      Array.from({ length: t }, (_, k) => factor[k] + 0.15 * Math.sin(k / 3 + i * 1.7)),
    );
    const meanAbs = (m: number[][]) => {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < m.length; i++) {
        for (let j = i + 1; j < m.length; j++) {
          sum += Math.abs(m[i][j]);
          count++;
        }
      }
      return sum / count;
    };
    const before = correlationMatrix(returns);
    const after = correlationMatrix(removeMarketMode(returns));
    assert.ok(meanAbs(before) > 0.9, `raw pairs should be dominated by the factor, got ${meanAbs(before)}`);
    assert.ok(meanAbs(after) < 0.6, `residual pairs should be much weaker, got ${meanAbs(after)}`);
    assert.equal(after[0][0], 1, "diagonal must stay 1");
    assert.ok(Math.abs(after[0][1] - after[1][0]) < 1e-12, "residual matrix must stay symmetric");
  }],
  ["assignCommunitiesByAverageLinkage groups blocks and refuses to chain", () => {
    const blocks = [
      [1, 0.8, 0.8, 0.05, 0.05],
      [0.8, 1, 0.8, 0.05, 0.05],
      [0.8, 0.8, 1, 0.05, 0.05],
      [0.05, 0.05, 0.05, 1, 0.7],
      [0.05, 0.05, 0.05, 0.7, 1],
    ];
    const labels = assignCommunitiesByAverageLinkage(blocks, 0.3);
    assert.equal(labels[0], labels[1]);
    assert.equal(labels[0], labels[2]);
    assert.equal(labels[3], labels[4]);
    assert.notEqual(labels[0], labels[3]);
    // Bridge chain: single linkage would fuse all four through 0.75 hops, but the
    // average across the growing cluster falls to 0.25 and must stop the merge.
    const chain = [
      [1, 0.75, 0, 0],
      [0.75, 1, 0.75, 0],
      [0, 0.75, 1, 0.75],
      [0, 0, 0.75, 1],
    ];
    const chained = assignCommunitiesByAverageLinkage(chain, 0.3);
    assert.ok(new Set(chained).size > 1, "average linkage must not chain a bridge into one cluster");
    assert.notEqual(chained[0], chained[3], "the far end of the chain must stay separate");
  }],

  // ---------- reweight ----------
  ["reweightBriefing rebuilds the title for the new style", () => {
    const out = reweightBriefing(baseBriefing(), "day", null);
    assert.ok(out.title.includes(STYLES.day.label), `title missing style label: ${out.title}`);
    assert.ok(out.title.startsWith("AAPL"), `title lost ticker: ${out.title}`);
  }],
  ["reweightBriefing never stacks style suffixes across switches", () => {
    const direct = reweightBriefing(baseBriefing(), "day", null).title;
    const viaOthers = reweightBriefing(
      reweightBriefing(reweightBriefing(baseBriefing(), "position", null), "event", null),
      "day",
      null,
    ).title;
    assert.equal(viaOthers, direct);
    assert.ok(!viaOthers.includes("["), `unexpected suffix: ${viaOthers}`);
  }],
  ["reweightBriefing keeps existing examples when no analog data is provided", () => {
    const briefing = baseBriefing();
    briefing.historicalStressTest.examples = [{ when: "AAPL (2023-11-14)", whatHappened: "rose about 2.5% over the next 5 days" }];
    const out = reweightBriefing(briefing, "position", null);
    assert.deepEqual(out.historicalStressTest.examples, briefing.historicalStressTest.examples);
  }],
];

let failed = 0;
for (const [name, run] of cases) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(err);
  }
}

if (failed > 0) {
  console.error(`${failed} of ${cases.length} math checks failed`);
  process.exit(1);
}
console.log(`${cases.length} math checks passed`);
