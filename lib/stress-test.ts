import type { AnalogsPillar, StressDirection, StressTest, TechnicalsPillar } from "./types";

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function signedReturn(value: number, direction: StressDirection) {
  return direction === "LONG" ? value : -value;
}

export function buildStressTest(input: {
  asset: string;
  rToken?: string;
  direction: StressDirection;
  capital: number;
  timeHorizon: string;
  analogs?: AnalogsPillar;
  technicals?: TechnicalsPillar;
}): StressTest {
  const { asset, rToken, direction, capital, timeHorizon, analogs, technicals } = input;
  const range = analogs?.ranges.find((item) => item.horizon === timeHorizon) ?? analogs?.ranges[0];
  const sampleSize = range?.n ?? analogs?.sample.n ?? 0;
  const medianReturnPct = range ? round(signedReturn(range.p50, direction)) : null;
  const historicalWinRate = range ? round(direction === "LONG" ? range.pUp : 1 - range.pUp, 4) : null;
  const maxDrawdownPct = range ? round(Math.min(0, signedReturn(range.p10, direction))) : null;
  const confidenceScore = sampleSize > 0 ? round(Math.min(0.95, Math.max(0.35, sampleSize / 30)), 2) : null;
  const volatility = technicals?.indicators.realizedVol20;
  const atr = technicals?.indicators.atr14;
  const stopPct = volatility ? round(Math.max(2.5, Math.min(12, volatility * 0.65))) : null;
  const lossBudget = stopPct !== null ? round(capital * (stopPct / 100)) : null;
  const shockMagnitude = volatility ? Math.max(2, volatility / Math.sqrt(5)) : 3;
  const eventShock = Math.max(4, shockMagnitude * 1.8);
  const marketShock = Math.max(2, shockMagnitude);
  const scenarios = [
    { event: "Broad risk-off session", move: -marketShock, basis: "Volatility-scaled 5-session stress" },
    { event: "Catalyst / guidance miss", move: -eventShock, basis: "Event shock above recent realized volatility" },
    { event: "Broad risk-on session", move: marketShock * 0.75, basis: "Volatility-scaled relief scenario" },
  ].map(({ event, move, basis }) => {
    const projected = round(signedReturn(move, direction));
    return {
      event,
      projectedAssetChangePct: projected,
      dollarPnL: round(capital * projected / 100),
      basis,
    };
  });

  let riskLevel: StressTest["riskLevel"] = "MEDIUM";
  if (sampleSize < 10 || (historicalWinRate !== null && historicalWinRate < 0.4)) riskLevel = "HIGH";
  if ((stopPct !== null && stopPct >= 8) || (maxDrawdownPct !== null && maxDrawdownPct <= -8)) riskLevel = "EXTREME";
  if (sampleSize >= 20 && historicalWinRate !== null && historicalWinRate >= 0.6 && (stopPct === null || stopPct < 5)) riskLevel = "LOW";

  return {
    asset,
    rToken,
    direction,
    capital,
    timeHorizon,
    riskLevel,
    riskBasis: "Risk level is derived from analog sample depth, directional base-rate split, and observed volatility. It is not a trading signal.",
    metrics: {
      sampleSize,
      historicalWinRate,
      medianReturnPct,
      maxDrawdownPct,
      confidenceScore,
    },
    shockScenarios: scenarios,
    portfolioImpact: {
      status: "unavailable",
      note: "Portfolio holdings, sector weights, and baseline beta were not supplied, so concentration impact is not estimated.",
    },
    safeguards: {
      suggestedEntryStrategy: capital > 0 ? "Two-stage entry; retain at least 50% as reserve until the thesis is confirmed." : "Define capital before sizing an entry.",
      recommendedStopLossPct: stopPct,
      suggestedStopLossPrice: technicals?.rToken?.last && stopPct !== null
        ? round(technicals.rToken.last * (1 - (direction === "LONG" ? stopPct : -stopPct) / 100))
        : null,
      maxRiskBudgetDollars: lossBudget,
      invalidationLevel: technicals?.levels.support[0]
        ? `Reassess if the Bitget tape loses ${technicals.levels.support[0].toFixed(2)} support.`
        : atr
          ? `Reassess after a move of roughly ${round(atr, 2)} ATR against the thesis.`
          : "Define an invalidation level before execution.",
    },
    executionAction: {
      requiresHumanConfirmation: true,
      targetExchange: "Bitget",
      actionButtonLabel: "Review plan only",
    },
  };
}
