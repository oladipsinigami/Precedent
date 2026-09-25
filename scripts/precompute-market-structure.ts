// Precomputed Market Structure job — run on a schedule (nightly), NOT per query.
//
// Why precompute: RMT filtering only separates signal from noise once the
// peer universe is large (published tests show little or no benefit at
// 15-39 assets, solid results at 400+). Bitget lists 500+ rTokens, so this
// job builds ONE correlation matrix across the full universe, filters it
// once, and stores per-asset community membership. Query time is a fast
// lookup in lib/pillars/market-structure.ts, never a live decomposition.
//
// Usage:
//   npx tsx scripts/precompute-market-structure.ts   (nightly cron / action)
//   npm run precompute
//
// Output: data/market-structure.json (checked in as the demo seed; refreshed
// nightly by the schedule). Bars come from the same Yahoo historical-bars
// source as the Technicals pillar, using underlying cash equities.
//
// Schedule ownership: configure one of these before the demo and record the
// choice in the submission notes:
//   - Vercel Cron hitting an internal route that shells to this script, or
//   - GitHub Actions `schedule: cron: "0 5 * * *"` running npm run precompute.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { bitgetRTokenMarkets, bitgetSpotCandles, bitgetSpotTickers } from "../lib/providers/bitget";
import { yahooChart } from "../lib/providers/yahoo";
import {
  assignCommunitiesByAverageLinkage,
  correlationMatrix,
  logReturns,
  removeMarketMode,
  splitSpectrum,
} from "../lib/rmt";
import { UNIVERSE, nameFromBitgetRTokenMarket } from "../lib/universe";

const MIN_BARS = 60;
const OUT_PATH = path.join(process.cwd(), "data", "market-structure.json");
const FETCH_CONCURRENCY = 8;
const DEFAULT_UNIVERSE_LIMIT = 500;
const MAX_UNIVERSE_LIMIT = 2_000;

// Admission threshold for the correlation matrix. Every admitted asset must
// share a timestamp with every other one, so a single recently-listed name can
// collapse the whole sample: a 495-asset run on a 69-session window put the 0.15
// cleaning and 0.30 clustering thresholds within ~1-2 standard errors of zero
// (SE ~= 1/sqrt(T-3) = 0.12), i.e. inside the estimation noise. Requiring real
// history keeps the sample large enough for those thresholds to mean something.
const DEFAULT_MIN_HISTORY_BARS = 180;

// Local bar cache for iterating on clustering thresholds without refetching
// ~500 series. Never used in CI (the scheduled job must see fresh bars) and
// always time-bounded, so a daily run can never publish stale prices.
const BAR_CACHE_PATH = path.join(process.cwd(), "data", ".cache", "market-structure-bars.json");
const BAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type BarSeries = { t: number; c: number }[];
type BarCache = { fetchedAt: string; series: Record<string, BarSeries> };

function roundCorrelation(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function minHistoryBars(): number {
  const configured = Number(process.env.MARKET_STRUCTURE_MIN_BARS);
  if (!Number.isFinite(configured)) return DEFAULT_MIN_HISTORY_BARS;
  return Math.max(MIN_BARS, Math.floor(configured));
}

// Average-correlation cut for the community pass, applied to market-mode-removed
// (residual) correlations. Measured on the current 494-name universe: 0.25 -> 82
// communities, 0.30 -> 111 communities with the largest holding 17% of the
// universe, 0.35 -> 135 communities with 53 singletons. 0.30 is the default
// because every sector sanity check holds there (banks, oil, gold/miners and
// semis separate; within-group names stay together).
const DEFAULT_MIN_AVG_CORR = 0.3;

function communityMinAvgCorr(): number {
  const configured = Number(process.env.MARKET_STRUCTURE_MIN_AVG_CORR);
  if (!Number.isFinite(configured)) return DEFAULT_MIN_AVG_CORR;
  return Math.min(0.9, Math.max(0.05, configured));
}

function barCacheEnabled(): boolean {
  return process.env.MARKET_STRUCTURE_REFRESH_BARS !== "1" && process.env.CI !== "true";
}

async function readBarCache(natives: string[]): Promise<BarCache | null> {
  if (!barCacheEnabled()) return null;
  try {
    const parsed = JSON.parse(await readFile(BAR_CACHE_PATH, "utf-8")) as BarCache;
    if (!parsed || typeof parsed.fetchedAt !== "string" || !parsed.series) return null;
    if (Date.now() - Date.parse(parsed.fetchedAt) > BAR_CACHE_TTL_MS) return null;
    const allowed = new Set(natives);
    const series = Object.fromEntries(
      Object.entries(parsed.series).filter(
        ([native, bars]) => allowed.has(native) && Array.isArray(bars) && bars.length > 0,
      ),
    );
    return { fetchedAt: parsed.fetchedAt, series };
  } catch {
    return null;
  }
}

async function writeBarCache(series: Record<string, BarSeries>): Promise<void> {
  if (!barCacheEnabled()) return;
  try {
    await mkdir(path.dirname(BAR_CACHE_PATH), { recursive: true });
    await writeFile(BAR_CACHE_PATH, JSON.stringify({ fetchedAt: new Date().toISOString(), series }));
  } catch (err) {
    console.warn(
      `market-structure precompute: bar cache not written (${
        err instanceof Error ? err.message : err
      })`,
    );
  }
}

type UniverseSelection = {
  natives: string[];
  bitgetSymbols: Map<string, string>;
  liveMarketCount?: number;
};

function universeLimit(): number {
  const configured = Number(process.env.MARKET_STRUCTURE_UNIVERSE_LIMIT);
  if (!Number.isFinite(configured)) return DEFAULT_UNIVERSE_LIMIT;
  return Math.min(MAX_UNIVERSE_LIMIT, Math.max(UNIVERSE.length, Math.floor(configured)));
}

async function selectUniverse(): Promise<UniverseSelection> {
  const seedNatives = UNIVERSE.map((u) => u.native);
  try {
    const markets = await bitgetRTokenMarkets();
    const volumes = new Map<string, number>();
    try {
      for (const ticker of await bitgetSpotTickers()) {
        if (ticker.symbol) volumes.set(ticker.symbol, Number(ticker.usdtVolume ?? 0));
      }
    } catch {
      // Keep the exchange's market order when the ticker-volume ranker is unavailable.
    }

    const rankedMarkets = [...markets].sort(
      (a, b) => (volumes.get(b.symbol) ?? 0) - (volumes.get(a.symbol) ?? 0),
    );
    const selectedNatives = new Set(seedNatives);
    const bitgetSymbols = new Map<string, string>();

    for (const market of rankedMarkets) {
      let native: string;
      try {
        native = nameFromBitgetRTokenMarket(market).native;
      } catch {
        continue;
      }
      if (!selectedNatives.has(native) && selectedNatives.size >= universeLimit()) continue;
      selectedNatives.add(native);
      if (!bitgetSymbols.has(native)) bitgetSymbols.set(native, market.symbol);
    }

    return {
      natives: [...selectedNatives].sort(),
      bitgetSymbols,
      liveMarketCount: markets.length,
    };
  } catch {
    // Live discovery unavailable: fall back to the built-in list and Yahoo bars.
    return { natives: [...seedNatives].sort(), bitgetSymbols: new Map() };
  }
}

async function main() {
  const universe = await selectUniverse();
  const { natives, bitgetSymbols } = universe;
  const requiredBars = minHistoryBars();
  console.log(
    `market-structure precompute: selected ${natives.length} assets` +
      (universe.liveMarketCount !== undefined ? ` from ${universe.liveMarketCount} live rToken markets` : "") +
      ` (limit=${universeLimit()}, min-history=${requiredBars} bars)`,
  );
  const closesByNative = new Map<string, BarSeries>();
  const cache = await readBarCache(natives);
  if (cache) {
    for (const [native, bars] of Object.entries(cache.series)) {
      if (bars.length >= requiredBars) closesByNative.set(native, bars);
    }
    console.log(
      `market-structure precompute: reused ${closesByNative.size} cached bar series from ${cache.fetchedAt}`,
    );
  }
  const skipped: string[] = [];
  let bitgetBars = 0;
  let yahooBars = 0;

  let next = 0;
  let completed = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= natives.length) return;
      const native = natives[index];
      if (closesByNative.has(native)) continue;
      try {
        let bars: { t: number; c: number }[];
        const bitgetSymbol = bitgetSymbols.get(native);
        if (bitgetSymbol) {
          try {
            bars = await bitgetSpotCandles(bitgetSymbol, 365);
            if (bars.length >= requiredBars) bitgetBars += 1;
            else throw new Error("insufficient Bitget candles");
          } catch {
            const yahoo = await yahooChart(native, "1y", "1d");
            bars = yahoo.bars;
            yahooBars += 1;
          }
        } else {
          const yahoo = await yahooChart(native, "1y", "1d");
          bars = yahoo.bars;
          yahooBars += 1;
        }
        if (bars.length < requiredBars) {
          skipped.push(native);
          continue;
        }
        closesByNative.set(
          native,
          bars.map((b) => ({ t: b.t, c: b.c })),
        );
      } catch {
        skipped.push(native);
      } finally {
        completed += 1;
        if (completed % 25 === 0 || completed === natives.length) {
          console.log(`market-structure precompute: fetched ${completed}/${natives.length} assets`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, natives.length) }, () => worker()));
  skipped.sort();
  await writeBarCache(Object.fromEntries(closesByNative));
  console.log(
    `market-structure precompute: admitted ${closesByNative.size}/${natives.length} assets with ` +
      `>=${requiredBars} bars (${skipped.length} skipped for short history or fetch failure)`,
  );

  // Intersect on timestamps so every series shares the same observation window.
  const counts = new Map<number, number>();
  for (const bars of closesByNative.values()) {
    for (const b of bars) counts.set(b.t, (counts.get(b.t) ?? 0) + 1);
  }
  const eligible = [...closesByNative.keys()];
  const commonT = [...counts.entries()]
    .filter(([, c]) => c === eligible.length)
    .map(([t]) => t)
    .sort((a, b) => a - b);

  // If the full intersection is too thin, fall back to the largest subset
  // with at least MIN_BARS of shared history and name the shortfall.
  let kept = eligible;
  let sharedT = commonT;
  if (sharedT.length < MIN_BARS) {
    const byCoverage = eligible
      .map((n) => ({ n, len: closesByNative.get(n)?.length ?? 0 }))
      .sort((a, b) => b.len - a.len);
    kept = byCoverage.slice(0, Math.max(2, Math.floor(byCoverage.length / 2))).map((x) => x.n);
    const recount = new Map<number, number>();
    for (const n of kept) {
      for (const b of closesByNative.get(n) ?? []) recount.set(b.t, (recount.get(b.t) ?? 0) + 1);
    }
    sharedT = [...recount.entries()]
      .filter(([, c]) => c === kept.length)
      .map(([t]) => t)
      .sort((a, b) => a - b);
  }

  if (kept.length < 2 || sharedT.length < MIN_BARS) {
    throw new Error(
      `Insufficient shared history for RMT precompute (assets=${kept.length}, sharedBars=${sharedT.length}).`,
    );
  }

  const series = kept.map((n) => {
    const byT = new Map((closesByNative.get(n) ?? []).map((b) => [b.t, b.c]));
    return { n, closes: sharedT.map((t) => byT.get(t)) };
  });
  // Drop observation columns where ANY asset lacks a finite close, so all
  // series stay aligned (per-asset filtering here would silently misalign).
  const goodIdx = sharedT.map((_, i) => i).filter((i) => series.every((s) => Number.isFinite(s.closes[i])));
  if (goodIdx.length < MIN_BARS) {
    throw new Error(
      `Insufficient clean shared history for RMT precompute (cleanBars=${goodIdx.length}).`,
    );
  }
  const returns = series.map((s) => logReturns(goodIdx.map((i) => s.closes[i] as number)));

  const corr = correlationMatrix(returns);
  const nObs = returns[0]?.length ?? 0;
  const split = splitSpectrum(corr, nObs);
  // The market mode carries ~22% of total variance here, so raw correlations are
  // mostly beta. Cluster on the market-mode-removed (residual) matrix instead and
  // publish both: `raw` is the observed correlation, `residual` is what is left
  // once the common factor is deflated out of both series.
  const residual = correlationMatrix(removeMarketMode(returns));
  const minAvgCorr = communityMinAvgCorr();
  const labels = assignCommunitiesByAverageLinkage(residual, minAvgCorr);

  const communities: Record<string, string> = {};
  const communityMembers: Record<string, string[]> = {};
  const buckets = new Map<number, string[]>();
  kept.forEach((n, i) => {
    const list = buckets.get(labels[i] ?? 0) ?? [];
    list.push(n);
    buckets.set(labels[i] ?? 0, list);
  });
  for (const [label, members] of buckets) {
    const id = `c${label}`;
    const sortedMembers = [...members].sort();
    for (const m of members) communities[m] = id;
    communityMembers[id] = sortedMembers;
  }

  const nativeIndex = new Map(kept.map((native, index) => [native, index]));
  const communityStats: Record<string, { meanResidualToMembers: number }> = {};
  for (const members of buckets.values()) {
    for (const native of members) {
      const rowIndex = nativeIndex.get(native);
      if (rowIndex === undefined) continue;
      const values = members
        .filter((peer) => peer !== native)
        .map((peer) => {
          const peerIndex = nativeIndex.get(peer);
          return peerIndex === undefined ? null : residual[rowIndex][peerIndex];
        })
        .filter((value): value is number => Number.isFinite(value));
      if (values.length) {
        communityStats[native] = {
          meanResidualToMembers: roundCorrelation(values.reduce((sum, value) => sum + value, 0) / values.length),
        };
      }
    }
  }

  // Peer lists are the asset's strongest market-mode-removed partners across the
  // whole universe, not just its community: a name can be a legitimate singleton
  // (no cohort clears the cut) and still have a ranked peer list worth showing.
  const correlations = kept.map((native, rowIndex) => ({
    native,
    peers: kept
      .map((peer, peerIndex) => ({
        native: peer,
        raw: roundCorrelation(corr[rowIndex][peerIndex] ?? 0),
        residual: roundCorrelation(residual[rowIndex][peerIndex] ?? 0),
      }))
      .filter((peer) => peer.native !== native)
      .sort((a, b) => b.residual - a.residual)
      .slice(0, 6),
  }));

  const communitySizes = [...buckets.values()].map((members) => members.length);
  const largestCommunity = communitySizes.length ? Math.max(...communitySizes) : 0;
  const singletons = communitySizes.filter((size) => size === 1).length;

  const payload = {
    computedAt: new Date().toISOString(),
    universeSize: kept.length,
    universeRequested: natives.length,
    skipped,
    sharedBars: goodIdx.length,
    marketModeStrength: split.marketModeStrength,
    infoBeyondNoisePct: split.infoBeyondNoisePct,
    mpPlus: split.mpPlus,
    signalEigenvalues: split.signalCount,
    communityCount: buckets.size,
    largestCommunity,
    largestCommunityShare: Number((largestCommunity / Math.max(1, kept.length)).toFixed(4)),
    singletonCommunities: singletons,
    communityMinAvgCorr: minAvgCorr,
    communities,
    communityMembers,
    communityStats,
    correlations,
    barSource: bitgetBars
      ? `Bitget spot rToken candles for ${bitgetBars} assets; Yahoo Finance fallback for ${yahooBars} assets.`
      : `Yahoo Finance underlying cash candles; Bitget spot candles were unavailable for this run.`,
    note:
      "Precomputed RMT snapshot across the Bitget rToken universe. Communities are average-linkage clusters " +
      `of market-mode-removed (residual) correlations at an average-correlation cut of ${minAvgCorr}; ` +
      "the Marcenko-Pastur split is a signal-versus-noise diagnostic on the raw matrix, not the clustering input. " +
      "Query time reads this file; nothing here is recomputed per request.",
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2));

  // Judge-checkable validation number, also reported per §18 of the v2 spec.
  console.log(
    `market-structure precompute: assets=${kept.length} sharedBars=${goodIdx.length} ` +
      `signalEigen=${split.signalCount}/${kept.length} ` +
      `infoBeyondNoise=${split.infoBeyondNoisePct.toFixed(1)}% ` +
      `marketMode=${(split.marketModeStrength * 100).toFixed(1)}% skipped=${skipped.length}`,
  );
  console.log(
    `market-structure communities: count=${buckets.size} largest=${largestCommunity} ` +
      `(${(100 * largestCommunity / Math.max(1, kept.length)).toFixed(1)}% of universe) ` +
      `singletons=${singletons} minAvgCorr=${minAvgCorr}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
