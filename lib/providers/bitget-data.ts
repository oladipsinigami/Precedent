// Bitget first-party data layer — `bitget-mcp-server` (agent.bitget.com/mcp).
//
// Bitget's own Base Camp Hackathon documentation lists this server as the core
// information layer for the AI Trading Desk track ("US fundamentals / quotes"),
// alongside the `bitget-signal` research Skills. It needs no API key, serves
// the free data tier, and is read-only.
//
// The catalog is discovered through two tools: `guide` lists categories and
// entries, `do_query` executes an entry by id with validated params. We use a
// small slice of it:
//
//   equity_price_quote             US equity quote (last, OHLC, volume)
//   equity_price_historical        US equity historical OHLCV
//   equity_estimates_price_target  analyst price targets
//   equity_ownership_inst_position_summary   institutional ownership
//   sentiment_market_fear_greed    market-wide sentiment gauge
//
// Every call is cached and wrapped so a slow or unavailable service degrades to
// `null` instead of failing a pillar.

import { callMcpTool, mcpJson } from "./bitget-mcp";

export const BITGET_MCP_SOURCE_LABEL = "Bitget MCP (bitget-mcp-server) · official US equity/ETF data";

export type BitgetEquityQuote = {
  symbol: string;
  last: number;
  open?: number;
  high?: number;
  low?: number;
  prevClose?: number;
  changePct?: number;
  volume?: number;
};

export type BitgetFearGreed = {
  score: number;
  rating: string;
  asOf?: string;
  previousClose?: number;
  previousWeek?: number;
  previousMonth?: number;
  previousYear?: number;
};

type QueryEnvelope<T> = {
  success?: boolean;
  data?: { results?: T[] };
  error?: unknown;
};

const cache = new Map<string, { expires: number; value: unknown }>();
const QUOTE_TTL_MS = 60_000;
const REFERENCE_TTL_MS = 15 * 60_000;
const SENTIMENT_TTL_MS = 10 * 60_000;

function num(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function query<T>(
  entryId: string,
  params: Record<string, unknown>,
  ttlMs: number,
  timeoutMs = 12_000,
): Promise<T | null> {
  const key = `${entryId}:${JSON.stringify(params)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T | null;
  try {
    const result = await callMcpTool("do_query", { entry_id: entryId, params }, timeoutMs);
    const parsed = mcpJson<QueryEnvelope<T>>(result);
    // mcpJson falls back to the raw text when the payload is not JSON; that is
    // a miss, not a crash.
    const first = typeof parsed === "string" ? null : parsed?.data?.results?.[0] ?? null;
    cache.set(key, { expires: Date.now() + ttlMs, value: first });
    return first;
  } catch (err) {
    console.warn(`[bitget-data] ${entryId} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function bitgetEquityQuote(symbol: string): Promise<BitgetEquityQuote | null> {
  const row = await query<Record<string, unknown>>(
    "equity_price_quote",
    { symbol: symbol.toUpperCase() },
    QUOTE_TTL_MS,
  );
  if (!row) return null;
  const last = num(row.last_price);
  if (last === undefined || last <= 0) return null;
  const changeFraction = num(row.change_percent);
  return {
    symbol: String(row.symbol ?? symbol).toUpperCase(),
    last,
    open: num(row.open),
    high: num(row.high),
    low: num(row.low),
    prevClose: num(row.prev_close),
    // The catalog returns a fraction (-0.0032 == -0.32%); our pillars use percent.
    changePct: changeFraction === undefined ? undefined : changeFraction * 100,
    volume: num(row.volume),
  };
}

export async function bitgetMarketFearGreed(): Promise<BitgetFearGreed | null> {
  const row = await query<Record<string, unknown>>("sentiment_market_fear_greed", {}, SENTIMENT_TTL_MS);
  if (!row) return null;
  const score = num(row.score);
  if (score === undefined) return null;
  return {
    score,
    rating: String(row.rating ?? "unrated").toUpperCase(),
    asOf: typeof row.timestamp === "string" ? row.timestamp : undefined,
    previousClose: num(row.previous_close),
    previousWeek: num(row.previous_1_week),
    previousMonth: num(row.previous_1_month),
    previousYear: num(row.previous_1_year),
  };
}

export async function bitgetPriceTarget(symbol: string): Promise<Record<string, unknown> | null> {
  return query<Record<string, unknown>>(
    "equity_estimates_price_target",
    { symbol: symbol.toUpperCase() },
    REFERENCE_TTL_MS,
  );
}

export async function bitgetInstitutionalSummary(symbol: string): Promise<Record<string, unknown> | null> {
  return query<Record<string, unknown>>(
    "equity_ownership_inst_position_summary",
    { symbol: symbol.toUpperCase() },
    REFERENCE_TTL_MS,
  );
}
