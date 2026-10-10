import { bitgetOrderBookForSymbols, type BitgetOrderBook } from "../providers/bitget-book";
import type { Bar } from "../indicators";
import type { NameCard } from "../universe";
import {
  type CostBreakdown,
  buildCostBreakdown,
} from "./costs";
import {
  type ScheduledEvent,
  eventsForAsset,
  eventsWithinWindow,
  holdWindow,
  isoDay,
  scheduledCalendar,
} from "./events";
import { type SizingSolution, assessAgainstRequestedSize, solveLargestFittingNotional } from "./sizing";

export type RiskDirection = "LONG" | "SHORT";

export const COVERAGE_TARGET = 0.8;
const MIN_SAMPLES_TO_GRADE = 8;

export type CoverageGrade = {
  kind: ScheduledEvent["kind"] | "ordinary";
  label: string;
  boundaryPct: number;
  trainCount: number;
  testCount: number;
  insideCount: number;
  totalCount: number;
  shareInside: number | null;
  targetShareInside: number;
  status: "HOLDS" | "SHORT_OF_TARGET" | "NO_DATA";
  basis: string;
};

export type EventSeverity = {
  kind: ScheduledEvent["kind"];
  label: string;
  date: string;
  measuredPct: number;
  rawPct: number;
  sampleN: number;
  coverage: CoverageGrade;
};

export type SessionPoint = {
  date: string;
  label: string;
  index: number;
  cumulativeLossUsd: number;
  breach: boolean;
  eventKind: ScheduledEvent["kind"] | null;
  eventLabel: string | null;
};

export type RiskPillar = {
  ok: boolean;
  unavailableReason?: string;
  asset: string;
  rToken: string;
  direction: RiskDirection;
  notionalUsd: number;
  holdSessions: number;
  maxLossUsd: number | null;
  window: { from: string; to: string; dates: string[] };
  scheduled: ScheduledEvent[];
  severities: EventSeverity[];
  ordinary: CoverageGrade;
  adverseMovePct: number;
  adverseDriver: string;
  path: SessionPoint[];
  firstBreach: SessionPoint | null;
  costs: CostBreakdown;
  verdict: "FITS" | "DOES_NOT_FIT" | "NO_LIMIT" | "UNAVAILABLE";
  verdictSentence: string;
  worstLossUsd: number | null;
  moveLossUsd: number | null;
  costUsdAtRequestedSize: number | null;
  overageUsd: number | null;
  sizing: SizingSolution;
  unverified: string[];
};

export function quantileOf(sorted: readonly number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const upper = sorted[base + 1];
  return upper === undefined ? sorted[base] : sorted[base] + rest * (upper - sorted[base]);
}

export function boundaryAtShare(moves: readonly number[], shareInside: number): number | null {
  if (moves.length < MIN_SAMPLES_TO_GRADE) return null;
  const magnitudes = moves.map((m) => Math.abs(m)).sort((a, b) => a - b);
  return quantileOf(magnitudes, shareInside);
}

const TRAIN_SHARE = 0.6;

export function splitForGrading<T>(samples: readonly T[]): { train: T[]; test: T[] } {
  if (samples.length < 2) return { train: [...samples], test: [] };
  const cut = Math.max(1, Math.floor(samples.length * TRAIN_SHARE));
  return { train: samples.slice(0, cut), test: samples.slice(cut) };
}

export function gradeCoverage(input: {
  kind: CoverageGrade["kind"];
  label: string;
  moves: readonly number[];
  basis: string;
}): CoverageGrade {
  const { kind, label, moves, basis } = input;
  const total = moves.length;
  const { train, test } = splitForGrading(moves);
  const boundary = boundaryAtShare(train, COVERAGE_TARGET);

  if (boundary === null || test.length === 0) {
    return {
      kind,
      label,
      boundaryPct: 0,
      trainCount: train.length,
      testCount: test.length,
      insideCount: 0,
      totalCount: total,
      shareInside: null,
      targetShareInside: COVERAGE_TARGET,
      status: "NO_DATA",
      basis: `Only ${total} past events of this kind, ${test.length} of them after the grading split; below the ${MIN_SAMPLES_TO_GRADE} needed to grade a range out of sample.`,
    };
  }

  const insideCount = test.filter((m) => Math.abs(m) <= boundary).length;
  const shareInside = insideCount / test.length;

  return {
    kind,
    label,
    boundaryPct: boundary,
    trainCount: train.length,
    testCount: test.length,
    insideCount,
    totalCount: total,
    shareInside,
    targetShareInside: COVERAGE_TARGET,
    status: shareInside >= COVERAGE_TARGET ? "HOLDS" : "SHORT_OF_TARGET",
    basis: `Boundary fitted on the first ${train.length} past events, graded on the ${test.length} that came after it. ${basis}`,
  };
}

export function realizedVolPct(bars: readonly Bar[], lookback: number): number {
  const slice = bars.slice(-lookback);
  if (slice.length < 6) return 0;
  const logs: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].c;
    if (!prev || prev <= 0 || !slice[i].c) continue;
    logs.push(Math.log(slice[i].c / prev));
  }
  if (logs.length < 5) return 0;
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance = logs.reduce((acc, l) => acc + (l - mean) ** 2, 0) / (logs.length - 1);
  return Math.sqrt(variance) * 100;
}

export function sessionReturns(bars: readonly Bar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].c;
    if (!prev || prev <= 0) continue;
    out.push(((bars[i].c - prev) / prev) * 100);
  }
  return out;
}

export function barDates(bars: readonly Bar[]): string[] {
  return bars.map((bar) => isoDay(new Date(bar.t * 1000)));
}

export function cumulativeHoldMoves(
  bars: readonly Bar[],
  sessions: number,
  excludedDates: ReadonlySet<string>,
): number[] {
  const span = Math.max(1, Math.round(sessions));
  const dates = barDates(bars);
  const out: number[] = [];
  for (let end = span; end < bars.length; end++) {
    const startPrice = bars[end - span].c;
    if (!startPrice || startPrice <= 0) continue;
    let contaminated = false;
    for (let i = end - span + 1; i <= end; i++) {
      if (excludedDates.has(dates[i] as string)) {
        contaminated = true;
        break;
      }
    }
    if (contaminated) continue;
    out.push(((bars[end].c - startPrice) / startPrice) * 100);
  }
  return out;
}

export function holdBoundary(bars: readonly Bar[], sessions: number, excludedDates: ReadonlySet<string>): {
  boundaryPct: number;
  trainCount: number;
  testCount: number;
  shareInside: number | null;
  status: CoverageGrade["status"];
  moves: number[];
  scope: "clean-holds" | "all-holds";
} {
  const attempt = (excluded: ReadonlySet<string>) => {
    const moves = cumulativeHoldMoves(bars, sessions, excluded);
    const { train, test } = splitForGrading(moves);
    const boundary = boundaryAtShare(train, COVERAGE_TARGET);
    if (boundary === null || test.length === 0) {
      return {
        boundaryPct: 0,
        trainCount: train.length,
        testCount: test.length,
        shareInside: null,
        status: "NO_DATA" as const,
        moves,
      };
    }
    const inside = test.filter((m) => Math.abs(m) <= boundary).length;
    const shareInside = inside / test.length;
    return {
      boundaryPct: boundary,
      trainCount: train.length,
      testCount: test.length,
      shareInside,
      status: (shareInside >= COVERAGE_TARGET ? "HOLDS" : "SHORT_OF_TARGET") as CoverageGrade["status"],
      moves,
    };
  };

  const clean = attempt(excludedDates);
  if (clean.testCount > 0 && clean.trainCount > 0) {
    return { ...clean, scope: "clean-holds" };
  }

  // Long holds almost always contain an earnings or policy day, so the clean
  // sample empties out. Fall back to the full distribution of N-session holds,
  // which already carries those days, and disclose that it does.
  const all = attempt(new Set<string>());
  return { ...all, scope: "all-holds" };
}

export function adverseMoveFrom(input: {
  severities: readonly EventSeverity[];
  holdBoundaryPct: number;
  holdStatus: CoverageGrade["status"];
  shorterBoundaryPct: number;
  holdSessions: number;
}): { pct: number; driver: string } {
  const ordinary = input.holdStatus === "NO_DATA" ? 0 : input.holdBoundaryPct;

  let worst: EventSeverity | undefined;
  for (const candidate of input.severities) {
    if (!worst || candidate.measuredPct > worst.measuredPct) worst = candidate;
  }

  if (!worst) {
    return {
      pct: ordinary,
      driver: `${input.holdSessions} ordinary sessions measured as one cumulative hold`,
    };
  }

  const withEvent = worst.measuredPct + input.shorterBoundaryPct;
  if (withEvent > ordinary) {
    return {
      pct: withEvent,
      driver: `${worst.label} plus ${Math.max(0, input.holdSessions - 1)} remaining sessions, both measured`,
    };
  }

  return {
    pct: ordinary,
    driver: `${input.holdSessions} ordinary sessions measured as one cumulative hold, which already exceeds ${worst.label}`,
  };
}

export function emptyRiskPillar(reason: string, asset = "", rToken = ""): RiskPillar {
  const emptyGrade: CoverageGrade = {
    kind: "ordinary",
    label: "ordinary session",
    boundaryPct: 0,
    trainCount: 0,
    testCount: 0,
    insideCount: 0,
    totalCount: 0,
    shareInside: null,
    targetShareInside: COVERAGE_TARGET,
    status: "NO_DATA",
    basis: reason,
  };

  return {
    ok: false,
    unavailableReason: reason,
    asset,
    rToken,
    direction: "LONG",
    notionalUsd: 0,
    holdSessions: 0,
    maxLossUsd: null,
    window: { from: "", to: "", dates: [] },
    scheduled: [],
    severities: [],
    ordinary: emptyGrade,
    path: [],
    firstBreach: null,
    adverseMovePct: 0,
    adverseDriver: reason,
    costs: buildCostBreakdown({ asset, side: "BUY", notionalUsd: 0, unavailableReason: reason }),
    verdict: "UNAVAILABLE",
    verdictSentence: reason,
    worstLossUsd: null,
    moveLossUsd: null,
    costUsdAtRequestedSize: null,
    overageUsd: null,
    sizing: {
      ok: false,
      unavailableReason: reason,
      asset,
      side: "BUY",
      holdSessions: 0,
      maxLossUsd: 0,
      expectedMovePct: 0,
      fitsAtRequestedSize: false,
      largestFittingNotionalUsd: null,
      largestFittingBaseQty: null,
      moveLossUsd: null,
      costUsdAtFit: null,
      breakevenCostBps: null,
      verdict: "UNAVAILABLE",
      basis: reason,
    },
    unverified: [reason],
  };
}

export function buildSessionPath(input: {
  direction: RiskDirection;
  notionalUsd: number;
  maxLossUsd: number | null;
  window: { dates: string[] };
  scheduled: readonly ScheduledEvent[];
  ownEarningsDates: readonly string[];
  severities: readonly EventSeverity[];
  ordinaryBoundaryPct: number;
  ordinaryStatus: CoverageGrade["status"];
  costUsd: number;
}): SessionPoint[] {
  const {
    direction,
    notionalUsd,
    maxLossUsd,
    window,
    scheduled,
    ownEarningsDates,
    severities,
    ordinaryBoundaryPct,
    ordinaryStatus,
    costUsd,
  } = input;

  const dates = window.dates.length ? window.dates : [];
  const factor = direction === "LONG" ? 1 : -1;

  // A scheduled event only moves this stock if it is the issuer's own report, a
  // market-wide policy day, or a weekend. Another company's earnings are noise.
  const ownEarnings = new Set(ownEarningsDates);
  const relevant = scheduled.filter(
    (event) => event.kind !== "earnings" || ownEarnings.has(event.date),
  );

  const eventRank = (event: ScheduledEvent): number => {
    if (event.kind === "earnings") return 3;
    if (event.kind === "fomc") return 2;
    return 1;
  };

  const severityByKind = new Map(severities.map((s) => [s.kind, s]));

  const eventByDate = new Map<string, ScheduledEvent>();
  for (const event of relevant) {
    const existing = eventByDate.get(event.date);
    if (!existing) {
      eventByDate.set(event.date, event);
      continue;
    }
    const rank = eventRank(event);
    const existingRank = eventRank(existing);
    const severityPct = severityByKind.get(event.kind)?.measuredPct ?? 0;
    const existingPct = severityByKind.get(existing.kind)?.measuredPct ?? 0;
    if (rank > existingRank || (rank === existingRank && severityPct > existingPct)) {
      eventByDate.set(event.date, event);
    }
  }

  const shareByDay = new Map<string, number>();
  const eventsByDay = new Map<string, { kind: ScheduledEvent["kind"]; label: string }>();

  for (const [date, event] of eventByDate) {
    const severity = event.kind === "weekend" ? undefined : severityByKind.get(event.kind);
    const pctMove = severity ? severity.measuredPct : Math.max(0.5, ordinaryBoundaryPct * 0.4);
    shareByDay.set(date, (shareByDay.get(date) ?? 0) + pctMove / Math.max(1, dates.length));
    eventsByDay.set(date, { kind: event.kind, label: event.label });
  }

  if (ordinaryStatus !== "NO_DATA" && dates.length) {
    for (const date of dates) {
      shareByDay.set(date, (shareByDay.get(date) ?? 0) + ordinaryBoundaryPct / dates.length);
    }
  }

  const points: SessionPoint[] = [];
  let cumulative = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i] as string;
    const move = (shareByDay.get(date) ?? 0) * factor;
    cumulative += notionalUsd * (move / 100);
    const rounded = Math.round(cumulative * 100) / 100;
    points.push({
      date,
      label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      index: i,
      cumulativeLossUsd: rounded,
      breach: maxLossUsd !== null && Math.abs(rounded) > maxLossUsd,
      eventKind: eventsByDay.get(date)?.kind ?? null,
      eventLabel: eventsByDay.get(date)?.label ?? null,
    });
  }

  const closing = Math.round(costUsd * 100) / 100;
  if (points.length) {
    const last = points[points.length - 1] as SessionPoint;
    last.cumulativeLossUsd = Math.round((last.cumulativeLossUsd + closing) * 100) / 100;
    last.breach = maxLossUsd !== null && Math.abs(last.cumulativeLossUsd) > maxLossUsd;
  }

  return points;
}

export function firstBreachOf(path: readonly SessionPoint[]): SessionPoint | null {
  for (const point of path) {
    if (point.breach) return point;
  }
  return null;
}

function volOfMoves(moves: readonly number[]): number {
  if (moves.length < 4) return 0;
  const mean = moves.reduce((a, b) => a + b, 0) / moves.length;
  const variance = moves.reduce((acc, m) => acc + (m - mean) ** 2, 0) / (moves.length - 1);
  return Math.sqrt(variance);
}

function rescale(rawPct: number, eventVolPct: number, currentVolPct: number): number {
  if (eventVolPct <= 0 || currentVolPct <= 0) return rawPct;
  return (rawPct * currentVolPct) / eventVolPct;
}

export type HistoricalEventDates = {
  earnings: string[];
  fomc: string[];
};

export type BuildRiskInput = {
  name: NameCard;
  direction: RiskDirection;
  notionalUsd: number;
  holdSessions: number;
  maxLossUsd: number | null;
  bars: Bar[];
  historical: HistoricalEventDates;
  book?: BitgetOrderBook;
  bookUnavailableReason?: string;
  todayIso?: string;
  side: "BUY" | "SELL";
};

export async function buildRiskPillar(input: BuildRiskInput): Promise<RiskPillar> {
  const { name, direction, holdSessions, notionalUsd, bars } = input;
  const todayIso = input.todayIso ?? isoDay(new Date());
  const window = holdWindow(todayIso, holdSessions);
  const side = input.side;
  const unverified: string[] = [];

  const calendar = await scheduledCalendar();
  unverified.push(...calendar.caveats);

  const scheduled = eventsWithinWindow(calendar.events, window.from, window.to);

  const dates = barDates(bars);
  const returns = sessionReturns(bars);
  const currentVol = realizedVolPct(bars, 60);

  const dateToIndex = new Map<string, number>();
  dates.forEach((date, index) => {
    if (!dateToIndex.has(date)) dateToIndex.set(date, index);
  });

  const nearestIndex = (date: string): number | undefined => {
    const exact = dateToIndex.get(date);
    if (exact !== undefined) return exact;
    let best: number | undefined;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const [candidate, index] of dateToIndex) {
      const gap = Math.abs(Date.parse(`${candidate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`));
      if (gap < bestGap) {
        bestGap = gap;
        best = index;
      }
    }
    if (best === undefined || bestGap > 5 * 86_400_000) return undefined;
    return best;
  };

  const measure = (eventDates: readonly string[]): number[] => {
    const stamps = eventDates
      .map((date) => Date.parse(`${date}T00:00:00Z`))
      .filter((stamp) => Number.isFinite(stamp))
      .sort((a, b) => a - b);

    const clustered: string[] = [];
    for (const stamp of stamps) {
      const last = clustered.length ? Date.parse(`${clustered[clustered.length - 1]}T00:00:00Z`) : Number.NaN;
      if (!Number.isFinite(last) || stamp - last > 4 * 86_400_000) {
        clustered.push(isoDay(new Date(stamp)));
      }
    }

    const moves: number[] = [];
    for (const date of clustered) {
      const index = nearestIndex(date);
      if (index === undefined || index < 1 || index >= returns.length + 1) continue;
      const move = returns[index - 1];
      if (Number.isFinite(move)) moves.push(move);
    }
    return moves;
  };

  const eventSets = {
    earnings: measure(input.historical.earnings),
    fomc: measure(input.historical.fomc),
  };

  const eventIndices = new Set<number>();
  for (const datesList of [input.historical.earnings, input.historical.fomc]) {
    for (const date of datesList) {
      const index = nearestIndex(date);
      if (index !== undefined) eventIndices.add(index);
    }
  }
  const weekendIndices = new Set<number>();
  bars.forEach((bar, index) => {
    const day = new Date(bar.t * 1000).getUTCDay();
    if (day === 1 || day === 6) weekendIndices.add(index);
  });
  for (const index of eventIndices) weekendIndices.delete(index);

  const weekendMoves = returns.filter((_, i) => weekendIndices.has(i + 1));

  const ordinaryMoves = returns.filter((_, i) => !eventIndices.has(i + 1) && !weekendIndices.has(i + 1));

  const grade = (
    kind: CoverageGrade["kind"],
    label: string,
    moves: number[],
    basis: string,
  ): CoverageGrade => gradeCoverage({ kind, label, moves, basis });

    const severities: EventSeverity[] = [];
  const kinds: Array<[ScheduledEvent["kind"], string, string, number[]]> = [
    ["earnings", "Own earnings day", "close to close on the session that reacts to the report", eventSets.earnings],
    ["fomc", "FOMC decision day", "close to close on a scheduled policy statement day", eventSets.fomc],
    ["weekend", "Weekend closure", "Friday close to Monday open", weekendMoves],
  ];

  for (const [kind, label, basis, moves] of kinds) {
    if (moves.length < MIN_SAMPLES_TO_GRADE) continue;
    const gradeResult = grade(kind, label, moves, `${moves.length} past instances. ${basis}.`);
    const rawPct = rescale(gradeResult.boundaryPct, volOfMoves(moves), currentVol);
    severities.push({
      kind,
      label,
      date: "",
      measuredPct: rawPct,
      rawPct: gradeResult.boundaryPct,
      sampleN: moves.length,
      coverage: gradeResult,
    });
  }

  const ordinary = grade(
    "ordinary",
    "Ordinary session",
    ordinaryMoves,
    `${ordinaryMoves.length} past sessions with no earnings, policy or weekend gap in the window.`,
  );

  const inWindowKinds = new Set(scheduled.map((event) => event.kind));
  const ownEarningsInWindow = eventsForAsset(scheduled, name.native).filter((event) => event.kind === "earnings");
  const activeSeverities = severities.filter((severity) => {
    if (!inWindowKinds.has(severity.kind)) return false;
    // Another company's earnings are not this stock's earnings day. Only the
    // issuer's own report inside the hold activates the earnings severity.
    if (severity.kind === "earnings") return ownEarningsInWindow.length > 0;
    return true;
  });

  const marketWideEarnings = scheduled.filter((event) => event.kind === "earnings").length;
  if (marketWideEarnings && !ownEarningsInWindow.length) {
    unverified.push(
      `${marketWideEarnings} companies report inside this hold, but ${name.native} does not, so no earnings severity is applied to it.`,
    );
  }

  for (const severity of activeSeverities) {
    if (severity.date) continue;
    const matching = scheduled.find((event) => event.kind === severity.kind);
    if (matching) severity.date = matching.date;
  }

  const eventDatesForExclusion = new Set<string>();
  for (const date of input.historical.earnings) {
    const index = nearestIndex(date);
    if (index !== undefined) eventDatesForExclusion.add(dates[index] as string);
  }
  for (const date of input.historical.fomc) {
    const index = nearestIndex(date);
    if (index !== undefined) eventDatesForExclusion.add(dates[index] as string);
  }

  // Only discrete scheduled catalysts are excluded from the hold distribution.
  // Weekends stay in: every multi-session hold spans one, so removing them
  // would empty the sample and describe a hold no trader actually holds.
  const excludedForHold = new Set<string>(eventDatesForExclusion);
  const hold = holdBoundary(bars, holdSessions, excludedForHold);
  const shorter: ReturnType<typeof holdBoundary> =
    holdSessions > 1
      ? holdBoundary(bars, holdSessions - 1, excludedForHold)
      : { boundaryPct: 0, trainCount: 0, testCount: 0, shareInside: null, status: "NO_DATA", moves: [], scope: "clean-holds" };

  const holdGrade: CoverageGrade = {
    kind: "ordinary",
    label: `${holdSessions}-session cumulative hold`,
    boundaryPct: hold.boundaryPct,
    trainCount: hold.trainCount,
    testCount: hold.testCount,
    insideCount: 0,
    totalCount: hold.moves.length,
    shareInside: hold.shareInside,
    targetShareInside: COVERAGE_TARGET,
    status: hold.status,
    basis:
      hold.scope === "clean-holds"
        ? `Boundary fitted on the first ${hold.trainCount} ${holdSessions}-session holds, graded on the ${hold.testCount} that came after it. Holds containing an earnings or policy day are excluded from both halves; weekends stay in because every multi-session hold spans one.`
        : `Boundary fitted on the first ${hold.trainCount} of all ${holdSessions}-session holds, graded on the ${hold.testCount} that came after it. Too few ${holdSessions}-session holds exclude an earnings or policy day, so event days are left in the distribution rather than reporting no data.`,
  };

  const adverse = adverseMoveFrom({
    severities: activeSeverities,
    holdBoundaryPct: hold.boundaryPct,
    holdStatus: hold.status,
    shorterBoundaryPct: shorter.boundaryPct,
    holdSessions,
  });

  const book =
    input.book ??
    (await bitgetOrderBookForSymbols(name.bitgetSymbols));

  const costAt = (n: number): number =>
    buildCostBreakdown({ asset: name.native, book, side, notionalUsd: n }).roundTrip.costUsd;

  const costs = buildCostBreakdown({
    asset: name.native,
    book,
    side,
    notionalUsd,
    unavailableReason: book ? undefined : input.bookUnavailableReason ?? "order book unavailable",
  });

  if (!costs.ok) {
    unverified.push(
      "Live order book unavailable: cost is reported as unavailable and excluded from the sizing solve rather than assumed.",
    );
  }

  const sizing = solveLargestFittingNotional({
    asset: name.native,
    side,
    holdSessions,
    maxLossUsd: input.maxLossUsd ?? 0,
    expectedMovePct: adverse.pct,
    costAtSize: costAt,
  });

  const costUsdForPath = costs.ok ? costs.roundTrip.costUsd : 0;
  const path = buildSessionPath({
    direction,
    notionalUsd,
    maxLossUsd: input.maxLossUsd,
    window,
    scheduled,
    ownEarningsDates: input.historical.earnings,
    severities: activeSeverities,
    ordinaryBoundaryPct: holdGrade.boundaryPct,
    ordinaryStatus: holdGrade.status,
    costUsd: costUsdForPath,
  });
  const firstBreach = firstBreachOf(path);

  let verdict: RiskPillar["verdict"];
  let verdictSentence: string;
  let worstLossUsd: number | null = null;
  let moveLossUsd: number | null = null;
  let costUsdAtRequestedSize: number | null = null;
  let overageUsd: number | null = null;

  if (input.maxLossUsd === null) {
    verdict = "NO_LIMIT";
    verdictSentence =
      "No loss limit was supplied, so no verdict is issued. Supply the most you can lose to get a fitted size.";
    sizing.verdict = "UNAVAILABLE";
  } else {
    const assessment = assessAgainstRequestedSize({
      solution: sizing,
      requestedNotionalUsd: notionalUsd,
      expectedMovePct: adverse.pct,
      costAtSize: costAt,
      maxLossUsd: input.maxLossUsd,
    });
    verdict = assessment.verdict;
    worstLossUsd = assessment.worstLossUsd;
    moveLossUsd = assessment.moveLossUsd;
    costUsdAtRequestedSize = assessment.costUsd;
    overageUsd = assessment.overageUsd;
    verdictSentence =
      assessment.verdict === "DOES_NOT_FIT" && sizing.largestFittingNotionalUsd !== null
        ? `Does not fit at ${Math.round(notionalUsd).toLocaleString("en-US")} dollars. ${Math.floor(sizing.largestFittingNotionalUsd).toLocaleString("en-US")} dollars or less fits.`
        : assessment.basis;
  }

  const negativeGrades = [ordinary, ...severities.map((s) => s.coverage)].filter(
    (g) => g.status === "SHORT_OF_TARGET",
  );
  if (negativeGrades.length) {
    unverified.push(
      `${negativeGrades.length} measured range${negativeGrades.length > 1 ? "s sit" : " sits"} below the 80% containment target and ${negativeGrades.length > 1 ? "are" : "is"} reported as measured.`,
    );
  }

  if (bars.length < 120) {
    unverified.push(`Only ${bars.length} price sessions available; event samples are correspondingly thin.`);
  }

    return {
    ok: verdict !== "UNAVAILABLE",
    unavailableReason: sizing.unavailableReason,
    asset: name.native,
    rToken: name.rToken,
    direction,
    notionalUsd,
    holdSessions,
    maxLossUsd: input.maxLossUsd,
    window,
    scheduled,
    severities: activeSeverities,
    ordinary: holdGrade,
    path,
    firstBreach,
    adverseMovePct: adverse.pct,
    adverseDriver: adverse.driver,
    costs,
    verdict,
    verdictSentence,
    worstLossUsd,
    moveLossUsd,
    costUsdAtRequestedSize,
    overageUsd,
    sizing,
    unverified,
  };
}