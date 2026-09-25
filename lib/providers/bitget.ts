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

async function fetchRTokenMarkets(): Promise<BitgetRTokenMarket[]> {
  const response = await fetchJson<SpotSymbolsResponse>(
    "https://api.bitget.com/api/v2/spot/public/symbols",
    { timeoutMs: 2500, cacheTtlMs: 5 * 60_000 },
  );
  const markets = (response.data ?? []).filter(
    (market) => /^r[A-Za-z0-9]+$/.test(market.baseCoin) && market.status === "online",
  );
  rTokenCache = { markets, expires: Date.now() + 5 * 60_000 };
  return markets;
}

export async function bitgetRTokenMarkets(): Promise<BitgetRTokenMarket[]> {
  if (rTokenCache && rTokenCache.expires > Date.now()) return rTokenCache.markets;
  rTokenInFlight ??= fetchRTokenMarkets().finally(() => {
    rTokenInFlight = null;
  });
  return rTokenInFlight;
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
