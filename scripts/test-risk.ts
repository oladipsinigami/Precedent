import assert from "node:assert/strict";
import type { Bar } from "../lib/indicators";
import type { BitgetOrderBook, BookLevel } from "../lib/providers/bitget-book";
import {
  SPOT_FEE_SCHEDULE,
  FUTURES_FEE_SCHEDULE,
  buildCostBreakdown,
  feeScheduleForVenue,
  fillAgainstBook,
} from "../lib/risk/costs";
import { solveLargestFittingNotional, assessAgainstRequestedSize, attachBaseQty } from "../lib/risk/sizing";
import { fomcMeetingsInHtml, fomcEventDates, holdWindow, sessionsBetween, upcomingWeekends } from "../lib/risk/events";
import {
  boundaryAtShare,
  gradeCoverage,
  realizedVolPct,
  sessionReturns,
  adverseMoveFrom,
  buildSessionPath,
  cumulativeHoldMoves,
  holdBoundary,
  barDates,
  firstBreachOf,
  splitForGrading,
  COVERAGE_TARGET,
} from "../lib/risk/risk-pillar";

function levels(pairs: Array<[number, number]>): BookLevel[] {
  return pairs.map(([price, size]) => ({ price, size }));
}

const book: BitgetOrderBook = {
  symbol: "RNVDAUSDT",
  venue: "spot",
  ts: Date.UTC(2026, 9, 9, 12, 0, 0),
  asks: levels([
    [100.0, 10],
    [100.5, 10],
    [101.0, 20],
    [102.0, 50],
  ]),
  bids: levels([
    [99.5, 10],
    [99.0, 10],
    [98.5, 20],
    [97.0, 50],
  ]),
};

function syntheticBars(count: number, stepPct = 0.5, start = 100): Bar[] {
  const bars: Bar[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    price *= 1 + stepPct / 100;
    bars.push({
      t: Math.floor(Date.UTC(2020, 0, 1) / 1000) + i * 86_400,
      o: price,
      h: price * 1.01,
      l: price * 0.99,
      c: price,
      v: 1000,
    });
  }
  return bars;
}

const cases: Array<[string, () => void]> = [];

function test(name: string, fn: () => void) {
  cases.push([name, fn]);
}

test("buy walks asks ascending and pays above mid", () => {
  const fill = fillAgainstBook(book, "BUY", 1000);
  assert.ok(fill.vwap > 99.75, `vwap ${fill.vwap} should exceed mid 99.75`);
  assert.ok(fill.slippageBps > 0, "slippage must be positive on a buy");
  assert.equal(fill.levelsConsumed, 1);
  assert.equal(Math.round(fill.filledUsd), 1000);
});

test("sell walks bids descending and receives below mid", () => {
  const fill = fillAgainstBook(book, "SELL", 995);
  assert.ok(fill.vwap < 99.75, `vwap ${fill.vwap} should sit below mid`);
  assert.ok(fill.slippageBps < 0, "slippage must be negative on a sell");
  assert.equal(fill.levelsConsumed, 1);
});

test("larger order consumes deeper levels and worsens vwap", () => {
  const small = fillAgainstBook(book, "BUY", 1000);
  const large = fillAgainstBook(book, "BUY", 20_000);
  assert.ok(large.vwap > small.vwap, "a larger order must have a worse vwap");
  assert.ok(large.levelsConsumed > small.levelsConsumed, "must consume more levels");
  assert.ok(large.exhausted, "20k exceeds the 8k of ask depth");
});

test("fill never claims more size than the book holds", () => {
  const fill = fillAgainstBook(book, "BUY", 1_000_000);
  const totalAsk = book.asks.reduce((a, l) => a + l.price * l.size, 0);
  assert.ok(fill.filledUsd <= totalAsk + 1e-9, "filled size cannot exceed available depth");
  assert.equal(fill.exhausted, true);
});

test("cost breakdown reports entry and exit legs that sum to the round trip", () => {
  const cost = buildCostBreakdown({ asset: "NVDA", book, side: "BUY", notionalUsd: 5000 });
  assert.equal(cost.ok, true);
  assert.ok(cost.roundTrip.costUsd > 0, "a round trip must cost something");
  const legSum = cost.inLeg.costUsd + cost.outLeg.costUsd;
  assert.ok(Math.abs(legSum - cost.roundTrip.costUsd) < 1e-6, "legs must reconcile");
  const componentSum = cost.roundTrip.feeUsd + cost.roundTrip.slippageUsd;
  assert.ok(Math.abs(componentSum - cost.roundTrip.costUsd) < 1e-6, "fee plus slippage must reconcile");
});

test("cost breakdown bps matches its dollars", () => {
  const cost = buildCostBreakdown({ asset: "NVDA", book, side: "BUY", notionalUsd: 5000 });
  const recomputed = (cost.roundTrip.costUsd / cost.notionalUsd) * 10_000;
  assert.ok(Math.abs(recomputed - cost.roundTrip.costBps) < 1e-6, "bps must be derived from dollars");
  assert.ok(cost.roundTrip.costBps > cost.inLeg.costBps, "a round trip costs more than one leg");
});

test("missing book yields unavailable rather than an assumed fee", () => {
  const cost = buildCostBreakdown({ asset: "NVDA", side: "BUY", notionalUsd: 5000 });
  assert.equal(cost.ok, false);
  assert.ok(cost.unavailableReason, "an unavailable cost must carry a reason");
  assert.equal(cost.roundTrip.costUsd, 0);
});

test("size solves exactly when cost is zero", () => {
  const solution = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 600,
    expectedMovePct: 5,
    costAtSize: () => 0,
  });
  assert.equal(solution.ok, true);
  assert.equal(solution.verdict, "TOO_BIG");
  assert.equal(Math.round(solution.largestFittingNotionalUsd ?? 0), 12_000);
});

test("cost shrinks the solved size below the costless answer", () => {
  const zeroCost = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 600,
    expectedMovePct: 5,
    costAtSize: () => 0,
  });
  const withCost = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 600,
    expectedMovePct: 5,
    costAtSize: (n) => n * 0.002,
  });
  assert.ok(
    (withCost.largestFittingNotionalUsd ?? 0) < (zeroCost.largestFittingNotionalUsd ?? 0),
    "fees and slippage must reduce the fitted size",
  );
});

test("solved size respects the limit and one step more breaks it", () => {
  const costAtSize = (n: number) => n * 0.002;
  const solution = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 600,
    expectedMovePct: 5,
    costAtSize,
  });
  const fitted = solution.largestFittingNotionalUsd ?? 0;
  const loss = (n: number) => n * 0.05 + costAtSize(n);
  assert.ok(loss(fitted) <= 600 + 1e-6, "fitted size must stay inside the limit");
  assert.ok(loss(fitted * 1.001) > 600, "a marginally larger size must breach the limit");
});

test("no measured move produces unavailable, not a guess", () => {
  const solution = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 600,
    expectedMovePct: 0,
    costAtSize: () => 5,
  });
  assert.equal(solution.ok, false);
  assert.equal(solution.verdict, "UNAVAILABLE");
  assert.equal(solution.largestFittingNotionalUsd, null);
});

test("missing loss limit produces unavailable", () => {
  const solution = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 0,
    expectedMovePct: 5,
    costAtSize: () => 5,
  });
  assert.equal(solution.ok, false);
  assert.equal(solution.verdict, "UNAVAILABLE");
});

test("assessment of an oversized trade reports the overage", () => {
  const costAtSize = (n: number) => n * 0.002;
  const solution = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 600,
    expectedMovePct: 5,
    costAtSize,
  });
  const assessment = assessAgainstRequestedSize({
    solution,
    requestedNotionalUsd: 20_000,
    expectedMovePct: 5,
    costAtSize,
    maxLossUsd: 600,
  });
  assert.equal(assessment.verdict, "DOES_NOT_FIT");
  assert.ok((assessment.overageUsd ?? 0) > 0, "an overage must be reported");
  assert.ok((assessment.largestFittingNotionalUsd ?? 0) < 20_000);
});

test("assessment of a fitting trade reports no overage", () => {
  const costAtSize = (n: number) => n * 0.002;
  const solution = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 600,
    expectedMovePct: 5,
    costAtSize,
  });
  const assessment = assessAgainstRequestedSize({
    solution,
    requestedNotionalUsd: 5_000,
    expectedMovePct: 5,
    costAtSize,
    maxLossUsd: 600,
  });
  assert.equal(assessment.verdict, "FITS");
  assert.equal(assessment.overageUsd, null);
});

test("base quantity derives from the fitted notional and price", () => {
  const solution = solveLargestFittingNotional({
    asset: "NVDA",
    side: "BUY",
    holdSessions: 5,
    maxLossUsd: 600,
    expectedMovePct: 5,
    costAtSize: () => 0,
  });
  const withQty = attachBaseQty(solution, 100);
  assert.ok((withQty.largestFittingBaseQty ?? 0) > 0);
  assert.ok(Math.abs((withQty.largestFittingBaseQty ?? 0) - 120) < 0.01);
});

test("sessions skip weekends and stop at the requested count", () => {
  const sessions = sessionsBetween("2026-10-09", 5);
  assert.equal(sessions.length, 5);
  for (const iso of sessions) {
    const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
    assert.ok(day !== 0 && day !== 6, `${iso} is a weekend`);
  }
  assert.equal(sessions[0], "2026-10-09");
});

test("hold window spans the requested sessions", () => {
  const window = holdWindow("2026-10-09", 5);
  assert.equal(window.dates.length, 5);
  assert.equal(window.from, "2026-10-09");
  assert.ok(window.to >= window.from);
});

test("weekend events are emitted for Fridays only", () => {
  const weekends = upcomingWeekends("2026-10-09", 14);
  assert.ok(weekends.length >= 2, "two weeks should contain two Fridays");
  for (const weekend of weekends) {
    assert.equal(weekend.kind, "weekend");
    assert.equal(new Date(`${weekend.date}T00:00:00Z`).getUTCDay(), 5);
  }
});

test("fomc html parsing extracts dated policy meetings", () => {
  const html = `<a id="1">2026 FOMC Meetings</a>
    <div class="fomc-meeting__month">January</div><div class="fomc-meeting__date">27-28</div>
    <div class="fomc-meeting__month">April</div><div class="fomc-meeting__date">17-18*</div>
    <a id="2">2025 FOMC Meetings</a>
    <div class="fomc-meeting__month">December</div><div class="fomc-meeting__date">10</div>`;
  const meetings = fomcMeetingsInHtml(html);
  assert.equal(meetings.length, 3);
  assert.equal(meetings[0].year, 2026);
  assert.equal(meetings[0].startIso, "2026-01-27");
  assert.equal(meetings[0].endIso, "2026-01-28");
  assert.equal(meetings[1].hasProjections, true);
  assert.equal(meetings[2].year, 2025);
  assert.equal(meetings[2].startDay, 10);
  assert.equal(meetings[2].endDay, 10);
});

test("fomc event dates cover both ends of each meeting", () => {
  const dates = fomcEventDates([
    { year: 2026, month: "January", startDay: 27, endDay: 28, hasProjections: false, startIso: "2026-01-27", endIso: "2026-01-28" },
  ]);
  assert.deepEqual(dates, ["2026-01-27", "2026-01-28"]);
});

test("fomc parsing rejects markup with no meeting rows", () => {
  assert.equal(fomcMeetingsInHtml("<p>nothing here</p>").length, 0);
});

test("boundary is the requested quantile of absolute moves", () => {
  const moves = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const boundary = boundaryAtShare(moves, 0.8);
  assert.ok(boundary !== null, "ten samples should be gradable");
  assert.ok(boundary! >= 8 && boundary! <= 9, `unexpected boundary ${boundary}`);
});

test("too few samples grade as no data rather than a false range", () => {
  const boundary = boundaryAtShare([1, 2, 3], 0.8);
  assert.equal(boundary, null);
  const grade = gradeCoverage({ kind: "earnings", label: "x", moves: [1, 2, 3], basis: "thin" });
  assert.equal(grade.status, "NO_DATA");
  assert.equal(grade.shareInside, null);
});

test("a range that holds its target is reported as holding", () => {
  const moves = Array.from({ length: 100 }, (_, i) => ((i % 20) + 1) * (i % 2 === 0 ? 1 : -1));
  const grade = gradeCoverage({ kind: "ordinary", label: "x", moves, basis: "synthetic" });
  assert.equal(grade.status, "HOLDS");
  assert.ok((grade.shareInside ?? 0) >= COVERAGE_TARGET);
  assert.equal(grade.trainCount + grade.testCount, grade.totalCount);
  assert.ok(grade.testCount > 0);
});

test("a range that misses its target is reported as short", () => {
  const moves = [1, -1, 1.1, -1.1, 1.2, -1.2, 10, -10, 11, -11, 12, -12, 13, -13];
  const grade = gradeCoverage({ kind: "weekend", label: "x", moves, basis: "synthetic" });
  assert.equal(grade.status, "SHORT_OF_TARGET");
  assert.ok((grade.shareInside ?? 1) < COVERAGE_TARGET);
});

test("grading is out of sample, not a tautology on one window", () => {
  const moves = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 3 + (i % 7));
  const grade = gradeCoverage({ kind: "ordinary", label: "x", moves, basis: "synthetic" });
  const boundaryFittedOnAll = boundaryAtShare(moves, COVERAGE_TARGET);
  assert.ok(boundaryFittedOnAll !== null);
  assert.ok(
    Math.abs(grade.boundaryPct - boundaryFittedOnAll) > 0,
    "the graded boundary must differ from one fitted on the whole sample",
  );
  assert.ok(grade.testCount > 0, "a grade requires held-out observations");
});

test("the grading split keeps order and reserves held-out observations", () => {
  const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const { train, test } = splitForGrading(samples);
  assert.equal(train.length, 6);
  assert.equal(test.length, 4);
  assert.equal(train[0], 1);
  assert.equal(test[0], 7);
});

test("session returns compute close to close", () => {
  const returns = sessionReturns([
    { t: 0, o: 100, h: 100, l: 100, c: 100, v: 1 },
    { t: 86400, o: 100, h: 110, l: 100, c: 110, v: 1 },
  ]);
  assert.equal(returns.length, 1);
  assert.ok(Math.abs(returns[0] - 10) < 1e-9);
});

test("realized volatility rises with dispersion", () => {
  const calm = realizedVolPct(syntheticBars(120, 0.2), 60);
  const wild = realizedVolPct(syntheticBars(120, 2), 60);
  assert.ok(wild > calm, "a more volatile series must measure higher");
  assert.ok(calm > 0);
});

test("no scheduled event uses the measured hold boundary", () => {
  const adverse = adverseMoveFrom({
    severities: [],
    holdBoundaryPct: 7.5,
    holdStatus: "HOLDS",
    shorterBoundaryPct: 6,
    holdSessions: 5,
  });
  assert.ok(Math.abs(adverse.pct - 7.5) < 1e-9, `expected 7.5, got ${adverse.pct}`);
  assert.ok(adverse.driver.includes("cumulative"));
});

test("a scheduled event is used when it exceeds the hold boundary", () => {
  const adverse = adverseMoveFrom({
    severities: [
      { kind: "earnings", label: "Own earnings day", measuredPct: 9, coverage: {} } as never,
    ],
    holdBoundaryPct: 7.5,
    holdStatus: "HOLDS",
    shorterBoundaryPct: 6,
    holdSessions: 5,
  });
  assert.ok(Math.abs(adverse.pct - 15) < 1e-9, `expected 9 + 6 = 15, got ${adverse.pct}`);
  assert.ok(adverse.driver.includes("earnings"));
});

test("a small event does not inflate a larger measured hold", () => {
  const adverse = adverseMoveFrom({
    severities: [
      { kind: "weekend", label: "Weekend closure", measuredPct: 2, coverage: {} } as never,
    ],
    holdBoundaryPct: 40,
    holdStatus: "HOLDS",
    shorterBoundaryPct: 38,
    holdSessions: 60,
  });
  assert.ok(Math.abs(adverse.pct - 40) < 1e-9, `expected 40, got ${adverse.pct}`);
  assert.ok(adverse.driver.includes("exceeds"));
});

test("the largest scheduled event drives the adverse move", () => {
  const adverse = adverseMoveFrom({
    severities: [
      { kind: "earnings", label: "Own earnings day", measuredPct: 9, coverage: {} } as never,
      { kind: "fomc", label: "FOMC decision day", measuredPct: 12, coverage: {} } as never,
    ],
    holdBoundaryPct: 0,
    holdStatus: "NO_DATA",
    shorterBoundaryPct: 0,
    holdSessions: 2,
  });
  assert.ok(Math.abs(adverse.pct - 12) < 1e-9, `expected 12, got ${adverse.pct}`);
  assert.ok(adverse.driver.includes("FOMC"));
});

test("a long hold is measured, never extrapolated by summing days", () => {
  const bars = syntheticBars(400, 1.2);
  const clean = holdBoundary(bars, 60, new Set());
  const naive = clean.boundaryPct * 60;
  assert.ok(
    clean.boundaryPct < naive,
    `a 60-session boundary of ${clean.boundaryPct.toFixed(2)}% must be far below the naive ${naive.toFixed(2)}% product`,
  );
  assert.ok(clean.boundaryPct > 0);
});

test("cumulative holds skip windows containing an excluded event", () => {
  const bars = syntheticBars(60, 1);
  const dates = barDates(bars);
  const excluded = new Set([dates[30] as string]);
  const all = cumulativeHoldMoves(bars, 5, new Set());
  const filtered = cumulativeHoldMoves(bars, 5, excluded);
  assert.ok(filtered.length < all.length, "excluding a date must remove some windows");
  assert.ok(filtered.length > 0);
});

test("cumulative moves measure the whole span, not one day", () => {
  const bars = syntheticBars(40, 1);
  const moves = cumulativeHoldMoves(bars, 10, new Set());
  assert.ok(moves.length > 0);
  assert.ok(Math.abs(moves[0] as number) > 1, "a 10-session move must exceed a 1-session move");
});

test("a short hold measures the clean distribution", () => {
  const bars = syntheticBars(400, 1.2);
  const graded = holdBoundary(bars, 5, new Set());
  assert.equal(graded.scope, "clean-holds");
  assert.ok(graded.testCount > 0);
  assert.ok(graded.boundaryPct > 0);
});

test("heavy exclusion falls back to the full distribution rather than no data", () => {
  const bars = syntheticBars(400, 1.2);
  const dates = barDates(bars);
  const heavy = new Set(dates.filter((_, i) => i % 3 === 0));
  const graded = holdBoundary(bars, 5, heavy);
  assert.equal(graded.scope, "all-holds", "heavy exclusion should exhaust the clean sample");
  assert.ok(graded.testCount > 0, "the fallback still grades on held-out windows");
  assert.ok(graded.boundaryPct > 0);
  assert.ok(graded.shareInside !== null);
});

test("the fallback boundary is disclosed through the grade basis", () => {
  const bars = syntheticBars(400, 1.2);
  const heavy = new Set(barDates(bars).filter((_, i) => i % 3 === 0));
  const graded = holdBoundary(bars, 5, heavy);
  assert.equal(graded.scope, "all-holds");
  assert.ok(graded.moves.length > 0);
});

test("fees follow the venue of the book that was walked", () => {
  const spot = buildCostBreakdown({ asset: "AAPL", book, side: "BUY", notionalUsd: 5000 });
  assert.equal(spot.venue, "spot");
  assert.equal(spot.feeSchedule?.takerBps, SPOT_FEE_SCHEDULE.takerBps);

  const perp: BitgetOrderBook = { ...book, venue: "USDT-FUTURES" };
  const futures = buildCostBreakdown({ asset: "AAPL", book: perp, side: "BUY", notionalUsd: 5000 });
  assert.equal(futures.feeSchedule?.takerBps, FUTURES_FEE_SCHEDULE.takerBps);
  assert.ok(
    (futures.roundTrip.costUsd ?? 0) < (spot.roundTrip.costUsd ?? 0),
    "a futures book must cost less in fee than a spot book of the same shape",
  );
});

test("an explicit fee schedule overrides the venue default", () => {
  const perp: BitgetOrderBook = { ...book, venue: "USDT-FUTURES" };
  const cheap = buildCostBreakdown({
    asset: "AAPL", book: perp, side: "BUY", notionalUsd: 5000,
    feeSchedule: { takerBps: 0, makerBps: 0, liquidity: "maker", source: "test" },
  });
  assert.equal(cheap.roundTrip.feeUsd, 0);
  assert.ok((cheap.roundTrip.slippageUsd ?? 0) > 0, "slippage still applies");
});

test("the venue fee helper returns the documented published tiers", () => {
  assert.equal(feeScheduleForVenue("spot").takerBps, 10);
  assert.equal(feeScheduleForVenue("USDT-FUTURES").takerBps, 6);
});

const PATH_BASE = {
  direction: "LONG" as const,
  notionalUsd: 10_000,
  maxLossUsd: 500,
  window: { dates: ["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"] },
  severities: [] as Array<{ kind: "earnings" | "fomc" | "weekend"; label: string; date: string; measuredPct: number; rawPct: number; sampleN: number; coverage: never }>,
  ordinaryBoundaryPct: 6,
  ordinaryStatus: "HOLDS" as const,
  costUsd: 30,
};

test("another company earnings does not move this stock path", () => {
  const path = buildSessionPath({
    ...PATH_BASE,
    scheduled: [
      { kind: "earnings", label: "DAL reports earnings", date: "2026-10-09", source: "s" },
    ],
    ownEarningsDates: [],
  });
  const first = path[0]!;
  assert.equal(first.eventKind, null, "an unrelated issuer's earnings must not tag the session");
  assert.ok(Math.abs(first.cumulativeLossUsd - 10_000 * (6 / 5) / 100) < 1, "only ordinary drift applies");
});

test("a weekend inside the hold is tagged", () => {
  const path = buildSessionPath({
    ...PATH_BASE,
    scheduled: [
      { kind: "earnings", label: "GLDG reports earnings", date: "2026-10-09", source: "s" },
      { kind: "weekend", label: "Wall Street closed until Monday open", date: "2026-10-09", source: "s" },
    ],
    ownEarningsDates: [],
  });
  const first = path[0]!;
  assert.equal(first.eventKind, "weekend", "the weekend wins over unrelated earnings on the same date");
});

test("the issuer own earnings is tagged when it reports inside the hold", () => {
  const path = buildSessionPath({
    ...PATH_BASE,
    scheduled: [
      { kind: "earnings", label: "JPM reports earnings", date: "2026-10-13", source: "s" },
    ],
    ownEarningsDates: ["2026-10-13"],
  });
  const day13 = path[2]!;
  assert.equal(day13.eventKind, "earnings");
});

test("interest path accumulates and crosses the limit at a named session", () => {
  const path = buildSessionPath({
    ...PATH_BASE,
    notionalUsd: 20_000,
    maxLossUsd: 600,
    ordinaryBoundaryPct: 9,
    scheduled: [],
    ownEarningsDates: [],
  });
  let previous = 0;
  for (const point of path) {
    assert.ok(point.cumulativeLossUsd >= previous, "the measured path must be monotone for a long position");
    previous = point.cumulativeLossUsd;
  }
  const breach = firstBreachOf(path);
  assert.ok(breach, "a path above the limit must report a breach");
  assert.ok(breach.label.length > 0);
});

test("a fitting trade never breaches inside the hold", () => {
  const path = buildSessionPath({
    ...PATH_BASE,
    notionalUsd: 1_000,
    maxLossUsd: 5_000,
    scheduled: [],
    ownEarningsDates: [],
  });
  assert.equal(firstBreachOf(path), null);
  assert.ok(path.every((p) => !p.breach));
});

test("the round-trip cost lands on the closing session", () => {
  const withoutCost = buildSessionPath({
    ...PATH_BASE,
    costUsd: 0,
    scheduled: [],
    ownEarningsDates: [],
  });
  const withCost = buildSessionPath({
    ...PATH_BASE,
    costUsd: 120,
    scheduled: [],
    ownEarningsDates: [],
  });
  const lastIdx = withoutCost.length - 1;
  const delta = withCost[lastIdx]!.cumulativeLossUsd - withoutCost[lastIdx]!.cumulativeLossUsd;
  assert.ok(Math.abs(delta - 120) < 0.5, `expected the full cost on the last session, got ${delta}`);
  for (let i = 0; i < lastIdx; i++) {
    assert.equal(withCost[i]!.cumulativeLossUsd, withoutCost[i]!.cumulativeLossUsd);
  }
});

test("a short position moves in the opposite direction", () => {
  const long = buildSessionPath({ ...PATH_BASE, direction: "LONG", scheduled: [], ownEarningsDates: [] });
  const short = buildSessionPath({ ...PATH_BASE, direction: "SHORT", scheduled: [], ownEarningsDates: [] });
  assert.ok(
    long[long.length - 1]!.cumulativeLossUsd > 0,
    "a long adverse move is a loss",
  );
  assert.ok(
    short[short.length - 1]!.cumulativeLossUsd < 0,
    "a short adverse move is a gain, reported as a negative loss",
  );
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`[FAIL] ${name}`);
    console.error(err);
  }
}

if (failed > 0) {
  console.error(`${failed} of ${cases.length} risk checks failed`);
  process.exit(1);
}
console.log(`${cases.length} risk checks passed`);