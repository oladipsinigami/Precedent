import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchJson } from "../http";
import type { NameCard } from "../universe";

export type BitgetRwaContract = {
  symbol: string;
  baseCoin: string;
  symbolStatus?: string;
  isRwa?: string;
};

export type BitgetRTokenMarket = {
  symbol: string;
  baseCoin: string;
  status?: string;
};

type Tick = {
  last: number;
  changePct: number;
  symbol: string;
  venue: string;
  asOf: string;
};

export type BitgetCandle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type BitgetTicker = {
  code?: string;
  data?: { lastPr?: string; change24h?: string; ts?: string; symbol?: string } | { lastPr?: string; change24h?: string; ts?: string; symbol?: string }[];
};

type ContractsResponse = {
  code?: string;
  data?: BitgetRwaContract[];
};

type SpotSymbolsResponse = {
  code?: string;
  data?: BitgetRTokenMarket[];
};

export type BitgetSpotTicker = {
  symbol?: string;
  usdtVolume?: string;
};

type SpotTickersResponse = {
  code?: string;
  data?: BitgetSpotTicker[];
};

let rwaCache: { expires: number; contracts: BitgetRwaContract[] } | undefined;
let rTokenCache: { expires: number; markets: BitgetRTokenMarket[] } | undefined;
const candleCache = new Map<string, { expires: number; bars: BitgetCandle[] }>();
// In-flight refresh de-duplication: a burst of concurrent research requests
// shares one upstream call instead of stampeding the Bitget API.
let rwaInFlight: Promise<BitgetRwaContract[]> | null = null;
let rTokenInFlight: Promise<BitgetRTokenMarket[]> | null = null;

async function fetchRwaContracts(): Promise<BitgetRwaContract[]> {
  const response = await fetchJson<ContractsResponse>(
    "https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES",
    { timeoutMs: 2500, cacheTtlMs: 5 * 60_000 },
  );
  const contracts = (response.data ?? []).filter(
    (contract) => contract.isRwa === "YES" && contract.symbolStatus === "normal",
  );
  rwaCache = { contracts, expires: Date.now() + 5 * 60_000 };
  return contracts;
}

export async function bitgetRwaContracts(): Promise<BitgetRwaContract[]> {
  if (rwaCache && rwaCache.expires > Date.now()) return rwaCache.contracts;
  rwaInFlight ??= fetchRwaContracts().finally(() => {
    rwaInFlight = null;
  });
  return rwaInFlight;
}

const UNIVERSE_CACHE_PATH = path.join(process.cwd(), "data", ".cache", "rToken-universe.json");
const UNIVERSE_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

type UniverseCache = { fetchedAt: string; markets: BitgetRTokenMarket[] };

async function readUniverseCache(): Promise<UniverseCache | null> {
  try {
    const parsed = JSON.parse(await readFile(UNIVERSE_CACHE_PATH, "utf8")) as UniverseCache;
    if (!Array.isArray(parsed.markets) || !parsed.fetchedAt) return null;
    if (Date.now() - Date.parse(parsed.fetchedAt) > UNIVERSE_CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeUniverseCache(markets: BitgetRTokenMarket[]): Promise<void> {
  try {
    await mkdir(path.dirname(UNIVERSE_CACHE_PATH), { recursive: true });
    await writeFile(
      UNIVERSE_CACHE_PATH,
      JSON.stringify({ fetchedAt: new Date().toISOString(), markets }, null, 0),
      "utf8",
    );
  } catch {
    // A read-only deployment should still serve the live universe from memory.
  }
}

async function fetchRTokenMarkets(): Promise<BitgetRTokenMarket[]> {
  const response = await fetchJson<SpotSymbolsResponse>(
    "https://api.bitget.com/api/v2/spot/public/symbols",
    { timeoutMs: 2500, cacheTtlMs: 5 * 60_000 },
  );
  const markets = (response.data ?? []).filter(
    (market) => /^r[A-Za-z0-9]+$/.test(market.baseCoin) && market.status === "online",
  );
  rTokenCache = { markets, expires: Date.now() + 5 * 60_000 };
  void writeUniverseCache(markets);
  return markets;
}

export type RTokenMarketsResult = {
  markets: BitgetRTokenMarket[];
  source: "live" | "cached";
  fetchedAt: string | null;
};

export async function bitgetRTokenMarketsDetailed(): Promise<RTokenMarketsResult> {
  if (rTokenCache && rTokenCache.expires > Date.now()) {
    return { markets: rTokenCache.markets, source: "live", fetchedAt: null };
  }
  rTokenInFlight ??= fetchRTokenMarkets().finally(() => {
    rTokenInFlight = null;
  });
  try {
    return { markets: await rTokenInFlight, source: "live", fetchedAt: null };
  } catch (err) {
    // Discovery outage: the last successfully seen universe is still real
    // evidence and is far better than silently shrinking to the built-in list.
    const cached = await readUniverseCache();
    if (cached) return { markets: cached.markets, source: "cached", fetchedAt: cached.fetchedAt };
    throw err;
  }
}

export async function bitgetRTokenMarkets(): Promise<BitgetRTokenMarket[]> {
  return (await bitgetRTokenMarketsDetailed()).markets;
}

export async function bitgetSpotTickers(): Promise<BitgetSpotTicker[]> {
  const response = await fetchJson<SpotTickersResponse>(
    "https://api.bitget.com/api/v2/spot/market/tickers",
    { timeoutMs: 12_000, cacheTtlMs: 60_000 },
  );
  return response.data ?? [];
}

export async function bitgetTape(name: NameCard): Promise<Tick | undefined> {
  const candidates = name.bitgetSymbols.flatMap((symbol) => [
    { url: `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${symbol}`, symbol, venue: "Bitget spot" },
    { url: `https://api.bitget.com/api/v2/mix/market/ticker?productType=USDT-FUTURES&symbol=${symbol}`, symbol, venue: "Bitget USDT-M" },
  ]);

  try {
    return await Promise.any(
      candidates.map(async ({ url, symbol, venue }) => {
        const json = await fetchJson<BitgetTicker>(url, { timeoutMs: 2500, cacheTtlMs: 30_000 });
        const row = Array.isArray(json.data) ? json.data[0] : json.data;
        const last = Number(row?.lastPr);
        if (!Number.isFinite(last)) throw new Error("no last price");
        const rawChange = Number(row?.change24h ?? 0);
        // Bitget returns change24h as a decimal fraction (0.0234 = +2.34%).
        // Only rescale when the magnitude clearly indicates fraction form;
        // a genuine ±1% move encoded as "1" is left alone rather than inflated 100×.
        const changePct = Number.isFinite(rawChange)
          ? (Math.abs(rawChange) < 1 ? rawChange * 100 : rawChange)
          : 0;
        return {
          last,
          changePct,
          symbol,
          venue,
          asOf: row?.ts ? new Date(Number(row.ts)).toISOString() : new Date().toISOString(),
        };
      }),
    );
  } catch {
    return undefined;
  }
}

export async function bitgetSpotCandles(symbol: string, limit = 365): Promise<BitgetCandle[]> {
  const key = `${symbol}:${limit}`;
  const hit = candleCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.bars;
  const response = await fetchJson<{ code?: string; data?: string[][] }>(
    `https://api.bitget.com/api/v2/spot/market/candles?symbol=${encodeURIComponent(symbol)}&granularity=1D&limit=${Math.min(1000, Math.max(60, limit))}`,
    { timeoutMs: 12_000, cacheTtlMs: 5 * 60_000 },
  );
  const bars = (response.data ?? [])
    .map((row) => ({
      t: Number(row[0]) / 1000,
      o: Number(row[1]),
      h: Number(row[2]),
      l: Number(row[3]),
      c: Number(row[4]),
      v: Number(row[5] ?? 0),
    }))
    .filter((bar) => [bar.t, bar.o, bar.h, bar.l, bar.c].every(Number.isFinite))
    .sort((a, b) => a.t - b.t);
  candleCache.set(key, { expires: Date.now() + 5 * 60_000, bars });
  return bars;
}
