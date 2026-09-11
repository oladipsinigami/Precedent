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

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { bitgetRTokenMarkets, bitgetSpotCandles } from "../lib/providers/bitget";
import { yahooChart } from "../lib/providers/yahoo";
import {
  assignCommunities,
  cleanedMatrix,
  correlationMatrix,
  logReturns,
  splitSpectrum,
} from "../lib/rmt";
import { UNIVERSE, nameFromBitgetRTokenMarket } from "../lib/universe";

const MIN_BARS = 60;
const OUT_PATH = path.join(process.cwd(), "data", "market-structure.json");
const FETCH_CONCURRENCY = 8;

async function universeNatives(): Promise<string[]> {
  const natives = new Set<string>(UNIVERSE.map((u) => u.native));
  try {
    const markets = await bitgetRTokenMarkets();
    for (const m of markets) {
      try {
        natives.add(nameFromBitgetRTokenMarket(m).native);
      } catch {
        // Skip unmappable markets; fallback list still stands.
      }
    }
  } catch {
    // Live discovery unavailable: fall back to the built-in list.
  }
  return [...natives].sort();
}

async function main() {
  const natives = await universeNatives();
  const bitgetSymbols = new Map<string, string>();
  try {
    for (const market of await bitgetRTokenMarkets()) {
      bitgetSymbols.set(nameFromBitgetRTokenMarket(market).native, market.symbol);
    }
  } catch {
    // Yahoo remains the explicit fallback when Bitget is unavailable.
  }
  const closesByNative = new Map<string, { t: number; c: number }[]>();
  const skipped: string[] = [];
  let bitgetBars = 0;
  let yahooBars = 0;

  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= natives.length) return;
      const native = natives[index];
      try {
        let bars: { t: number; c: number }[];
        const bitgetSymbol = bitgetSymbols.get(native);
        if (bitgetSymbol) {
          try {
            bars = await bitgetSpotCandles(bitgetSymbol, 365);
            if (bars.length >= MIN_BARS) bitgetBars += 1;
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
        if (bars.length < MIN_BARS) {
          skipped.push(native);
          continue;
        }
        closesByNative.set(
          native,
          bars.map((b) => ({ t: b.t, c: b.c })),
        );
      } catch {
        skipped.push(native);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, natives.length) }, () => worker()));
  skipped.sort();

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
  const cleaned = cleanedMatrix(corr);
  const labels = assignCommunities(cleaned);

  const communities: Record<string, { id: string; members: string[] }> = {};
  const buckets = new Map<number, string[]>();
  kept.forEach((n, i) => {
    const list = buckets.get(labels[i] ?? 0) ?? [];
    list.push(n);
    buckets.set(labels[i] ?? 0, list);
  });
  for (const [label, members] of buckets) {
    const id = `c${label}`;
    for (const m of members) communities[m] = { id, members: [...members].sort() };
  }

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
    communities,
    raw: kept.map((n, i) => ({ native: n, row: corr[i] })),
    cleaned: kept.map((n, i) => ({ native: n, row: cleaned[i] })),
    barSource: bitgetBars
      ? `Bitget spot rToken candles for ${bitgetBars} assets; Yahoo Finance fallback for ${yahooBars} assets.`
      : `Yahoo Finance underlying cash candles; Bitget spot candles were unavailable for this run.`,
    note: "Precomputed RMT snapshot across the Bitget rToken universe. Query time reads this file; nothing here is recomputed per request.",
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
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
