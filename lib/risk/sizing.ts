export type SizingRequest = {
  asset: string;
  side: "BUY" | "SELL";
  holdSessions: number;
  maxLossUsd: number;
  expectedMovePct: number;
  costAtSize: (notionalUsd: number) => number;
  minNotional?: number;
  maxNotional?: number;
};

export type SizingSolution = {
  ok: boolean;
  unavailableReason?: string;
  asset: string;
  side: "BUY" | "SELL";
  holdSessions: number;
  maxLossUsd: number;
  expectedMovePct: number;
  fitsAtRequestedSize: boolean;
  largestFittingNotionalUsd: number | null;
  largestFittingBaseQty: number | null;
  moveLossUsd: number | null;
  costUsdAtFit: number | null;
  breakevenCostBps: number | null;
  verdict: "FITS" | "TOO_BIG" | "UNAVAILABLE";
  basis: string;
};

const DEFAULT_MIN_NOTIONAL = 1;
const DEFAULT_MAX_NOTIONAL = 5_000_000;

function lossAtNotional(
  notionalUsd: number,
  expectedMovePct: number,
  costAtSize: (n: number) => number,
): number {
  const moveLoss = notionalUsd * (expectedMovePct / 100);
  return moveLoss + costAtSize(notionalUsd);
}

export function solveLargestFittingNotional(request: SizingRequest): SizingSolution {
  const {
    asset,
    side,
    holdSessions,
    maxLossUsd,
    expectedMovePct,
    costAtSize,
    minNotional = DEFAULT_MIN_NOTIONAL,
    maxNotional = DEFAULT_MAX_NOTIONAL,
  } = request;

  if (!Number.isFinite(maxLossUsd) || maxLossUsd <= 0) {
    return {
      ok: false,
      unavailableReason: "no positive loss limit supplied",
      asset,
      side,
      holdSessions,
      maxLossUsd,
      expectedMovePct,
      fitsAtRequestedSize: false,
      largestFittingNotionalUsd: null,
      largestFittingBaseQty: null,
      moveLossUsd: null,
      costUsdAtFit: null,
      breakevenCostBps: null,
      verdict: "UNAVAILABLE",
      basis: "A loss limit is required before a size can be solved.",
    };
  }

  if (!Number.isFinite(expectedMovePct) || expectedMovePct <= 0) {
    return {
      ok: false,
      unavailableReason: "no measured adverse move for this stock and hold length",
      asset,
      side,
      holdSessions,
      maxLossUsd,
      expectedMovePct,
      fitsAtRequestedSize: false,
      largestFittingNotionalUsd: null,
      largestFittingBaseQty: null,
      moveLossUsd: null,
      costUsdAtFit: null,
      breakevenCostBps: null,
      verdict: "UNAVAILABLE",
      basis: "Without a measured adverse move, no size can be shown to fit. Nothing is estimated here.",
    };
  }

  const fits = (n: number) => lossAtNotional(n, expectedMovePct, costAtSize) <= maxLossUsd;

  const topFits = fits(maxNotional);
  let low = 0;
  let high = maxNotional;

  if (topFits) {
    low = maxNotional;
  } else {
    for (let i = 0; i < 64; i++) {
      const mid = (low + high) / 2;
      if (fits(mid)) low = mid;
      else high = mid;
    }
  }

  const largest = topFits ? maxNotional : low;
  const notionalUsd = Math.floor(largest * 100) / 100;
  const belowFloor = notionalUsd < minNotional;
  const costUsd = costAtSize(notionalUsd);
  const moveLossUsd = notionalUsd * (expectedMovePct / 100);
  const totalLoss = moveLossUsd + costUsd;

  const atMaxFits = topFits;
  const breachesAtCap = lossAtNotional(maxNotional, expectedMovePct, costAtSize) > maxLossUsd;

  return {
    ok: true,
    asset,
    side,
    holdSessions,
    maxLossUsd,
    expectedMovePct,
    fitsAtRequestedSize: atMaxFits,
    largestFittingNotionalUsd: atMaxFits ? null : notionalUsd,
    largestFittingBaseQty: null,
    moveLossUsd: atMaxFits ? null : round2(moveLossUsd),
    costUsdAtFit: atMaxFits ? null : round2(costUsd),
    breakevenCostBps: notionalUsd > 0 ? round2((costUsd / notionalUsd) * 10_000) : null,
    verdict: atMaxFits ? "FITS" : belowFloor ? "TOO_BIG" : "TOO_BIG",
    basis: atMaxFits
      ? `Even at the ${Math.round(maxNotional).toLocaleString("en-US")} dollar search cap the move plus round-trip cost stays inside the limit.`
      : breachesAtCap
        ? `At the ${Math.round(maxNotional).toLocaleString("en-US")} dollar search cap the move plus round-trip cost is ${round2(lossAtNotional(maxNotional, expectedMovePct, costAtSize))} dollars, above the limit, so the fitted size below is the search result rather than a cap.`
        : "Size solved against the measured adverse move plus the live round-trip cost at that size.",
  };
}

export function attachBaseQty(
  solution: SizingSolution,
  price: number | undefined,
): SizingSolution {
  if (!solution.ok || !solution.largestFittingNotionalUsd || !price || price <= 0) return solution;
  return {
    ...solution,
    largestFittingBaseQty: round2(solution.largestFittingNotionalUsd / price),
  };
}

export function assessAgainstRequestedSize(input: {
  solution: SizingSolution;
  requestedNotionalUsd: number;
  expectedMovePct: number;
  costAtSize: (n: number) => number;
  maxLossUsd: number;
}): {
  verdict: "FITS" | "DOES_NOT_FIT" | "UNAVAILABLE";
  worstLossUsd: number | null;
  moveLossUsd: number | null;
  costUsd: number | null;
  overageUsd: number | null;
  largestFittingNotionalUsd: number | null;
  basis: string;
} {
  const { solution, requestedNotionalUsd, expectedMovePct, costAtSize, maxLossUsd } = input;

  if (!solution.ok || !Number.isFinite(expectedMovePct) || expectedMovePct <= 0) {
    return {
      verdict: "UNAVAILABLE",
      worstLossUsd: null,
      moveLossUsd: null,
      costUsd: null,
      overageUsd: null,
      largestFittingNotionalUsd: solution.largestFittingNotionalUsd,
      basis:
        solution.unavailableReason ??
        "no measured adverse move and no live cost, so no verdict is issued",
    };
  }

  const moveLossUsd = requestedNotionalUsd * (expectedMovePct / 100);
  const costUsd = costAtSize(requestedNotionalUsd);
  const worstLossUsd = moveLossUsd + costUsd;
  const fits = worstLossUsd <= maxLossUsd;

  return {
    verdict: fits ? "FITS" : "DOES_NOT_FIT",
    worstLossUsd: round2(worstLossUsd),
    moveLossUsd: round2(moveLossUsd),
    costUsd: round2(costUsd),
    overageUsd: fits ? null : round2(worstLossUsd - maxLossUsd),
    largestFittingNotionalUsd: solution.largestFittingNotionalUsd,
    basis: fits
      ? `A ${expectedMovePct.toFixed(1)} percent adverse move plus the round-trip cost is ${round2(worstLossUsd)} dollars, inside the ${maxLossUsd} dollar limit.`
      : `A ${expectedMovePct.toFixed(1)} percent adverse move plus the round-trip cost is ${round2(worstLossUsd)} dollars, ${round2(worstLossUsd - maxLossUsd)} dollars above the limit.`,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}