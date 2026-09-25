import { loadMarketStructureStore } from "./pillars/market-structure";
import type { PillarBundle, Regime, StructureFlags } from "./types";

// Research-only evidence flags. Each flag is computed independently from the
// pillar bundle and shown separately in the Evidence section — they are never
// combined into a blended score (see v2 spec §10: a single composite number
// collapses disagreement, which is exactly what the Tension section exists
// to prevent).

export async function computeFlags(
  pillars: PillarBundle,
  regime: Regime,
  native: string,
): Promise<StructureFlags> {
  const catalystCount = pillars.fundamentals.catalysts.length;
  const catalystDensity = catalystCount >= 4 ? "high" : catalystCount >= 2 ? "moderate" : "low";

  const balanceSheet: string[] = [];
  const eps = pillars.fundamentals.eps;
  if (eps?.prior !== undefined && eps.prior !== 0) {
    const delta = ((eps.value - eps.prior) / Math.abs(eps.prior)) * 100;
    balanceSheet.push(
      `Diluted EPS moved from ${eps.prior} to ${eps.value} (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% quarter-on-quarter, per SEC XBRL).`,
    );
  } else if (eps) {
    balanceSheet.push(`Diluted EPS ${eps.value} for the period ending ${eps.periodEnd} (no prior quarter retrieved for comparison).`);
  }
  if (pillars.fundamentals.revenue) {
    balanceSheet.push(
      `Reported revenue ${pillars.fundamentals.revenue.value.toLocaleString()} for the period ending ${pillars.fundamentals.revenue.periodEnd}.`,
    );
  }
  if (!balanceSheet.length) {
    balanceSheet.push("No balance-sheet facts retrieved this run — nothing is inferred in their place.");
  }

  const last = pillars.technicals.ok ? pillars.technicals.native.last : undefined;
  const sma20 = pillars.technicals.indicators.sma20;
  // Only trending regimes carry a price-vs-average condition to violate;
  // range-bound, systemic, and normal labels describe structure, not level.
  // Missing tape means the check cannot run, reported conservatively.
  const regimeAlignment =
    last !== undefined && sma20 !== undefined
      ? regime === "trending-up"
        ? last >= sma20
          ? "aligned"
          : "misaligned"
        : regime === "trending-down"
          ? last < sma20
            ? "aligned"
            : "misaligned"
          : "aligned"
      : "misaligned";

  const communityStability = pillars.marketStructure.ok ? "stable" : "unstable";

  const cleanedCorrRankPct = await cleanedCorrRank(pillars.marketStructure.communityMembers, native);

  const ranges = pillars.analogs.ranges;
  const medians = ranges.map((r) => r.p50);
  const clustered =
    ranges.length > 0 &&
    medians.every((m) => Math.sign(m) === Math.sign(medians[0]) || m === 0) &&
    Math.max(...ranges.map((r) => r.p90 - r.p10)) < 8;

  return {
    catalystDensity,
    balanceSheet,
    regimeAlignment,
    communityStability,
    cleanedCorrRankPct,
    analogQuality: { n: pillars.analogs.sample.n, clustered },
  };
}

// The target's percentile position within its RMT community by mean cleaned
// correlation to fellow members. A descriptive number, not a score of the
// asset itself. Undefined when the community or snapshot is unavailable.
async function cleanedCorrRank(members: string[] | undefined, native: string): Promise<number | undefined> {
  if (!members || members.length < 3 || !members.includes(native)) return undefined;
  try {
    const store = await loadMarketStructureStore();
    if (!store) return undefined;
    const meanToMembers = (n: string): number | null => {
      const value = store.communityStats[n]?.meanResidualToMembers;
      return Number.isFinite(value) ? value : null;
    };
    const scored = members
      .map((m) => ({ m, s: meanToMembers(m) }))
      .filter((x): x is { m: string; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s);
    if (scored.length < 3) return undefined;
    const self = scored.find((x) => x.m === native);
    if (!self) return undefined;
    const below = scored.filter((x) => x.s <= self.s).length;
    return Math.round(((below - 1) / Math.max(1, scored.length - 1)) * 100);
  } catch {
    return undefined;
  }
}
