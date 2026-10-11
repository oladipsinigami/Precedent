import assert from "node:assert/strict";
import {
  ANALOG_TIER_MIN_EFFECTIVE_N,
  effectiveSampleCount,
  quantileValue,
  tierForEffectiveN,
  computeEmpiricalRangesForTest as computeEmpiricalRanges,
} from "../lib/pillars/analogs";
import type { Bar } from "../lib/indicators";

const cases: Array<[string, () => void]> = [];
function test(name: string, fn: () => void) { cases.push([name, fn]); }

test("insufficient below 10 independent windows", () => {
  for (const n of [0, 1, 5, 9]) {
    assert.equal(tierForEffectiveN(n), "insufficient", `n=${n}`);
  }
});

test("weak from 10 to 29", () => {
  assert.equal(tierForEffectiveN(10), "weak");
  assert.equal(tierForEffectiveN(29), "weak");
});

test("moderate from 30 to 99", () => {
  assert.equal(tierForEffectiveN(30), "moderate");
  assert.equal(tierForEffectiveN(99), "moderate");
});

test("strong from 100", () => {
  assert.equal(tierForEffectiveN(100), "strong");
  assert.equal(tierForEffectiveN(500), "strong");
});

test("the documented boundaries behave as declared", () => {
  const { insufficientBelow, weakBelow, moderateBelow } = ANALOG_TIER_MIN_EFFECTIVE_N;
  assert.equal(insufficientBelow, 10);
  assert.equal(weakBelow, 30);
  assert.equal(moderateBelow, 100);
  assert.equal(tierForEffectiveN(insufficientBelow - 1), "insufficient");
  assert.equal(tierForEffectiveN(insufficientBelow), "weak");
  assert.equal(tierForEffectiveN(weakBelow - 1), "weak");
  assert.equal(tierForEffectiveN(weakBelow), "moderate");
  assert.equal(tierForEffectiveN(moderateBelow - 1), "moderate");
  assert.equal(tierForEffectiveN(moderateBelow), "strong");
});

test("overlapping windows count once", () => {
  // Twenty indices all within one 20-bar window are one independent episode.
  const dense = Array.from({ length: 20 }, (_, i) => 100 + i);
  assert.equal(effectiveSampleCount(dense, 20), 1, "a contiguous run must collapse to one");
});

test("spaced windows each count", () => {
  const spaced = Array.from({ length: 30 }, (_, i) => 100 + i * 20);
  assert.equal(effectiveSampleCount(spaced, 20), 30);
});

test("effectiveN is never above raw n", () => {
  const mixed = [100, 105, 110, 190, 300, 305, 480, 660, 700];
  const effective = effectiveSampleCount(mixed, 20);
  assert.ok(effective <= mixed.length, "effectiveN must not exceed the raw count");
  assert.ok(effective < mixed.length, `expected duplicates to collapse: ${mixed.length} -> ${effective}`);
});

test("a window exactly one window apart counts", () => {
  assert.equal(effectiveSampleCount([100, 120], 20), 2);
  assert.equal(effectiveSampleCount([100, 119], 20), 1);
});

function syntheticBars(count: number, seed = 7): Bar[] {
  let x = seed;
  const rand = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price *= 1 + (rand() - 0.5) * 0.06;
    bars.push({ t: Math.floor(Date.UTC(2020, 0, 1) / 1000) + i * 86_400, o: price, h: price, l: price, c: price, v: 1000 });
  }
  return bars;
}

test("a short series yields insufficient and no bands", () => {
  const result = computeEmpiricalRanges(syntheticBars(40));
  assert.equal(result.tier, "insufficient");
  assert.deepEqual(result.ranges, []);
});

test("a long series produces bands with a tier", () => {
  const result = computeEmpiricalRanges(syntheticBars(1400));
  assert.ok(result.tier === "weak" || result.tier === "moderate" || result.tier === "strong", `got ${result.tier}`);
  assert.ok(result.ranges.length === 0 || result.effectiveN >= 10);
});

test("effectiveN is below raw n on overlapping history", () => {
  const result = computeEmpiricalRanges(syntheticBars(1400));
  if (result.sampleN > 0) {
    assert.ok(result.effectiveN <= result.sampleN, "effectiveN cannot exceed the raw sample");
    assert.ok(result.tier !== "insufficient" || result.ranges.length === 0, "insufficient must carry no bands");
  }
});

test("quantileValue interpolates between ordered values", () => {
  const sorted = [1, 2, 3, 4, 5];
  assert.ok(Math.abs(quantileValue(sorted, 0.5) - 3) < 1e-9);
  assert.ok(Math.abs(quantileValue(sorted, 0) - 1) < 1e-9);
  assert.ok(Math.abs(quantileValue(sorted, 1) - 5) < 1e-9);
  assert.ok(quantileValue([], 0.5) === 0);
});

let failed = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`[PASS] ${name}`); }
  catch (err) { failed += 1; console.error(`[FAIL] ${name}`); console.error(err); }
}
if (failed > 0) { console.error(`${failed} of ${cases.length} analog-tier checks failed`); process.exit(1); }
console.log(`${cases.length} analog-tier checks passed`);
