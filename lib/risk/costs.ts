import {
  type BitgetOrderBook,
  type BookLevel,
  bookAsOf,
  bitgetOrderBookForSymbols,
  midPrice,
  topOfBook,
} from "../providers/bitget-book";
import type { NameCard } from "../universe";

export type FillResult = {
  filledUsd: number;
  filledBase: number;
  vwap: number;
  slippageBps: number;
  levelsConsumed: number;
  exhausted: boolean;
  worstLevelPrice: number;
};

export type CostBreakdown = {
  ok: boolean;
  unavailableReason?: string;
  asset: string;
  symbol?: string;
  venue?: string;
  feeSchedule?: FeeSchedule;
  side: "BUY" | "SELL";
  notionalUsd: number;
  midPrice: number;
  bookAsOf?: string;
  spreadBps?: number;
  top10DepthUsd?: { bid: number; ask: number };
  inLeg: {
    feeUsd: number;
    slippageUsd: number;
    costUsd: number;
    costBps: number;
  };
  outLeg: {
    feeUsd: number;
    slippageUsd: number;
    costUsd: number;
    costBps: number;
  };
  roundTrip: {
    feeUsd: number;
    slippageUsd: number;
    costUsd: number;
    costBps: number;
  };
};

export type FeeSchedule = {
  takerBps: number;
  makerBps: number;
  liquidity: "taker" | "maker";
  source: string;
};

export const SPOT_FEE_SCHEDULE: FeeSchedule = {
  takerBps: 10,
  makerBps: 10,
  liquidity: "taker",
  source:
    "Bitget standard spot tier, 0.10% maker and taker. Holding BGB or holding a VIP tier reduces this to 0.08%; the standard tier is used because it is the conservative and default case.",
};

export const FUTURES_FEE_SCHEDULE: FeeSchedule = {
  takerBps: 6,
  makerBps: 2,
  liquidity: "taker",
  source:
    "Bitget standard USDT-M futures tier, 0.06% taker and 0.02% maker. VIP tiers reduce this further; the standard tier is used.",
};

export function feeScheduleForVenue(venue: "spot" | "USDT-FUTURES"): FeeSchedule {
  return venue === "spot" ? SPOT_FEE_SCHEDULE : FUTURES_FEE_SCHEDULE;
}

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = SPOT_FEE_SCHEDULE;

export function fillAgainstBook(
  book: BitgetOrderBook,
  side: "BUY" | "SELL",
  targetUsd: number,
): FillResult {
  const levels: BookLevel[] = side === "BUY" ? book.asks : book.bids;
  const reference = midPrice(book);

  let remaining = targetUsd;
  let filledUsd = 0;
  let filledBase = 0;
  let levelsConsumed = 0;
  let exhausted = true;

  for (const level of levels) {
    if (remaining <= 0) {
      exhausted = false;
      break;
    }
    const levelUsd = level.price * level.size;
    const takeUsd = Math.min(remaining, levelUsd);
    filledUsd += takeUsd;
    filledBase += takeUsd / level.price;
    remaining -= takeUsd;
    levelsConsumed += 1;
  }

  const vwap = filledBase > 0 ? filledUsd / filledBase : 0;
  const worstLevelPrice = levelsConsumed > 0 ? levels[Math.min(levelsConsumed, levels.length) - 1].price : 0;
  const slippageBps = reference > 0 && vwap > 0 ? ((vwap - reference) / reference) * 10_000 : 0;

  return {
    filledUsd,
    filledBase,
    vwap,
    slippageBps,
    levelsConsumed,
    exhausted,
    worstLevelPrice,
  };
}

function feeUsd(notional: number, feeBps: number): number {
  return (notional * feeBps) / 10_000;
}

export function buildCostBreakdown(input: {
  asset: string;
  book?: BitgetOrderBook;
  side: "BUY" | "SELL";
  notionalUsd: number;
  feeSchedule?: FeeSchedule;
  unavailableReason?: string;
}): CostBreakdown {
  const fees = input.feeSchedule ?? (input.book ? feeScheduleForVenue(input.book.venue) : DEFAULT_FEE_SCHEDULE);
  const { asset, side, notionalUsd } = input;

  const emptyLeg = { feeUsd: 0, slippageUsd: 0, costUsd: 0, costBps: 0 };

  if (!input.book) {
    return {
      ok: false,
      unavailableReason: input.unavailableReason ?? "order book unavailable at request time",
      asset,
      side,
      notionalUsd,
      midPrice: 0,
      inLeg: emptyLeg,
      outLeg: emptyLeg,
      roundTrip: { feeUsd: 0, slippageUsd: 0, costUsd: 0, costBps: 0 },
    };
  }

  const book = input.book;
  const reference = midPrice(book);
  const spread = topOfBook(book);
  const depth = (() => {
    let bid = 0;
    let ask = 0;
    for (let i = 0; i < 10; i++) {
      if (book.bids[i]) bid += book.bids[i].price * book.bids[i].size;
      if (book.asks[i]) ask += book.asks[i].price * book.asks[i].size;
    }
    return { bid, ask };
  })();

  const entry = fillAgainstBook(book, side, notionalUsd);
  const exitSide: "BUY" | "SELL" = side === "BUY" ? "SELL" : "BUY";
  const exit = fillAgainstBook(book, exitSide, entry.filledUsd);

  const entryFee = feeUsd(entry.filledUsd, fees.takerBps);
  const entrySlip = Math.abs(entry.slippageBps / 10_000) * entry.filledUsd;
  const exitFee = feeUsd(exit.filledUsd, fees.takerBps);
  const exitSlip = Math.abs(exit.slippageBps / 10_000) * exit.filledUsd;

  const entryCost = entryFee + entrySlip;
  const exitCost = exitFee + exitSlip;
  const roundTripCost = entryCost + exitCost;

  return {
    ok: true,
    asset,
    symbol: book.symbol,
    venue: book.venue,
    feeSchedule: fees,
    side,
    notionalUsd,
    midPrice: reference,
    bookAsOf: bookAsOf(book),
    spreadBps: spread.spreadBps,
    top10DepthUsd: depth,
    inLeg: {
      feeUsd: entryFee,
      slippageUsd: entrySlip,
      costUsd: entryCost,
      costBps: entry.filledUsd > 0 ? (entryCost / entry.filledUsd) * 10_000 : 0,
    },
    outLeg: {
      feeUsd: exitFee,
      slippageUsd: exitSlip,
      costUsd: exitCost,
      costBps: exit.filledUsd > 0 ? (exitCost / exit.filledUsd) * 10_000 : 0,
    },
    roundTrip: {
      feeUsd: entryFee + exitFee,
      slippageUsd: entrySlip + exitSlip,
      costUsd: roundTripCost,
      costBps: entry.filledUsd > 0 ? (roundTripCost / entry.filledUsd) * 10_000 : 0,
    },
  };
}

export async function measureTradeCosts(input: {
  name: NameCard;
  side: "BUY" | "SELL";
  notionalUsd: number;
  feeSchedule?: FeeSchedule;
}): Promise<CostBreakdown> {
  const book = await bitgetOrderBookForSymbols(input.name.bitgetSymbols);
  return buildCostBreakdown({
    asset: input.name.native,
    book,
    side: input.side,
    notionalUsd: input.notionalUsd,
    feeSchedule: input.feeSchedule,
    unavailableReason: book
      ? undefined
      : `no order book returned for ${input.name.bitgetSymbols.join(", ")}`,
  });
}

export function totalCostForNotional(cost: CostBreakdown): number {
  return cost.ok ? cost.roundTrip.costUsd : 0;
}