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
  communities: Record<string, { id: string; members: string[] }>;
  raw: { native: string; row: number[] }[];
  cleaned: { native: string; row: number[] }[];
  note: string;
};

const STORE_PATH = path.join(process.cwd(), "data", "market-structure.json");

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
    const entry = store.communities[name.native];
    if (!entry) {
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
    const idx = store.raw.findIndex((r) => r.native === name.native);
    const peers = idx >= 0 ? entry.members.filter((m) => m !== name.native).slice(0, 6) : [];
    const cleanedCorrelations = peers
      .map((peer) => {
        const peerIdx = store.raw.findIndex((r) => r.native === peer);
        if (idx < 0 || peerIdx < 0) return null;
        return {
          peer,
          raw: store.raw[idx].row[peerIdx] ?? 0,
          cleaned: store.cleaned[idx].row[peerIdx] ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      ok: true,
      communityId: entry.id,
      communityMembers: entry.members,
      marketModeStrength: store.marketModeStrength,
      cleanedCorrelations,
      infoBeyondNoisePct: store.infoBeyondNoisePct,
      stability: `Snapshot from ${store.computedAt} across ${store.universeSize} assets and ${store.sharedBars} shared sessions; community assignment stability is tracked across rolling nightly runs.`,
      universeSize: store.universeSize,
      computedAt: store.computedAt,
      caveats: [
        `≈${store.infoBeyondNoisePct.toFixed(1)}% of this universe's eigenstructure carries information beyond noise (MP edge ${store.mpPlus.toFixed(2)}).`,
        ...(store.skipped.length ? [`${store.skipped.length} names skipped for short history and named in the snapshot.`] : []),
      ],
      sources: [
        { label: "RMT precompute snapshot (Marcenko-Pastur filtered)" },
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
