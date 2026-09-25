import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { MarketStructurePillar } from "../types";
import type { NameCard } from "../universe";

export type MarketStructureStore = {
  computedAt: string;
  universeSize: number;
  universeRequested: number;
  skipped: string[];
  sharedBars: number;
  marketModeStrength: number;
  infoBeyondNoisePct: number;
  mpPlus: number;
  signalEigenvalues: number;
  barSource?: string;
  communities: Record<string, string>;
  communityMembers: Record<string, string[]>;
  communityStats: Record<string, { meanResidualToMembers: number }>;
  correlations: { native: string; peers: { native: string; raw: number; residual: number }[] }[];
  communityCount?: number;
  largestCommunity?: number;
  largestCommunityShare?: number;
  singletonCommunities?: number;
  communityMinAvgCorr?: number;
  note: string;
};

const STORE_PATH = path.join(process.cwd(), "data", "market-structure.json");
export const MARKET_STRUCTURE_SNAPSHOT_MAX_AGE_MS = 36 * 60 * 60 * 1000;

export function isMarketStructureSnapshotStale(computedAt?: string): boolean {
  const computedAtMs = computedAt ? Date.parse(computedAt) : Number.NaN;
  return !Number.isFinite(computedAtMs) || Date.now() - computedAtMs > MARKET_STRUCTURE_SNAPSHOT_MAX_AGE_MS;
}

let cached: MarketStructureStore | null = null;
let cachedMtimeMs = 0;

// Shared loader: the pillar and the regime detector both read the same
// precomputed snapshot. Never recompute here — query time is lookup only.
// The file's mtime is checked per call so a nightly rewrite is picked up
// without restarting the server; a missing file yields null until present.
export async function loadMarketStructureStore(): Promise<MarketStructureStore | null> {
  try {
    const mtimeMs = (await stat(STORE_PATH)).mtimeMs;
    if (cached && mtimeMs === cachedMtimeMs) return cached;
    const text = await readFile(STORE_PATH, "utf-8");
    cached = JSON.parse(text) as MarketStructureStore;
    cachedMtimeMs = mtimeMs;
    return cached;
  } catch {
    return cached;
  }
}

export async function runMarketStructure(name: NameCard): Promise<MarketStructurePillar> {
  const base = { universeSize: 0, caveats: [] as string[], sources: [] as MarketStructurePillar["sources"] };
  try {
    const store = await loadMarketStructureStore();
    if (!store) {
      return {
        ...base,
        ok: false,
        error: "Precomputed market-structure snapshot not found (data/market-structure.json). Run npm run precompute.",
        caveats: ["Market-structure snapshot unavailable. Synthesis continues with the other four pillars."],
        sources: [{ label: "RMT precompute (missing)" }],
      };
    }
    const communityId = store.communities[name.native];
    const members = communityId ? store.communityMembers[communityId] : undefined;
    if (!communityId || !members?.length) {
      return {
        ...base,
        universeSize: store.universeSize,
        computedAt: store.computedAt,
        ok: false,
        error: `No precomputed community for ${name.native}: peer-count shortfall (universe=${store.universeSize}, skipped=${store.skipped.length}).`,
        caveats: [
          `${name.native} is not in the precomputed universe snapshot from ${store.computedAt}. Community-conditioned analogs fall back to pure chart-shape matches.`,
        ],
        sources: [{ label: "RMT precompute snapshot" }],
      };
    }
    const row = store.correlations.find((item) => item.native === name.native);
    const peers = (row?.peers ?? []).slice(0, 6);
    const cleanedCorrelations = peers.map((peer) => ({
      peer: peer.native,
      raw: peer.raw,
      residual: peer.residual,
    }));
    const stale = isMarketStructureSnapshotStale(store.computedAt);
    const cohort = members.length > 1;
    const caveats = [
      `≈${store.infoBeyondNoisePct.toFixed(1)}% of this universe's eigenstructure carries information beyond noise (MP edge ${store.mpPlus.toFixed(2)}).`,
      ...(store.skipped.length ? [`${store.skipped.length} names skipped for short history and named in the snapshot.`] : []),
      ...(!cohort
        ? [
            `${name.native} forms no distinct cohort at this cut: its market-mode-removed correlations do not average ${store.communityMinAvgCorr ?? 0.3} against any cluster, so the peer list below is its strongest residual partners rather than a community.`,
          ]
        : []),
      ...(store.largestCommunityShare !== undefined && store.largestCommunityShare > 0.6
        ? [
            `Community structure is coarse this run: the largest cluster holds ${(store.largestCommunityShare * 100).toFixed(0)}% of the ${store.universeSize}-asset universe, so peer lists are a market-wide basket rather than a tight sector cohort.`,
          ]
        : []),
      ...(stale ? [`Snapshot is older than ${Math.round(MARKET_STRUCTURE_SNAPSHOT_MAX_AGE_MS / 3_600_000)} hours; treat community structure as historical context until npm run precompute refreshes it.`] : []),
    ];

    return {
      ok: true,
      stale,
      communityId,
      communityMembers: members,
      marketModeStrength: store.marketModeStrength,
      cleanedCorrelations,
      infoBeyondNoisePct: store.infoBeyondNoisePct,
      stability: `Snapshot from ${store.computedAt} across ${store.universeSize} assets and ${store.sharedBars} shared sessions. Communities are average-linkage clusters of market-mode-removed correlations${store.communityCount !== undefined ? ` (${store.communityCount} clusters, largest holding ${(100 * (store.largestCommunityShare ?? 0)).toFixed(0)}% of the universe)` : ""}; the Marcenko-Pastur split is a signal-versus-noise diagnostic on the raw matrix. Assignment reflects this snapshot only; ${stale ? "it is stale — run npm run precompute before relying on it." : "the nightly precompute should refresh it."}`,
      universeSize: store.universeSize,
      computedAt: store.computedAt,
      caveats,
      sources: [
        { label: `RMT precompute snapshot (market-mode removed, average-linkage communities${stale ? "; stale" : ""})` },
        { label: store.barSource ?? "Historical bars used by the precompute job" },
      ],
    };
  } catch (err) {
    return {
      ...base,
      ok: false,
      error: err instanceof Error ? err.message : "Market-structure lookup failed",
      caveats: ["Market-structure lookup degraded. Synthesis continues with the other four pillars."],
      sources: [{ label: "RMT precompute snapshot" }],
    };
  }
}
