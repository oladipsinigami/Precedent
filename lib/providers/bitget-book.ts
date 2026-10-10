import { fetchJson } from "../http";

export type BookLevel = {
  price: number;
  size: number;
};

export type BitgetOrderBook = {
  symbol: string;
  venue: "spot" | "USDT-FUTURES";
  bids: BookLevel[];
  asks: BookLevel[];
  ts: number;
};

type BookResponse = {
  code?: string;
  ts?: number | string;
  data?: {
    bids?: string[][];
    asks?: string[][];
    ts?: number | string;
  };
};

const bookCache = new Map<string, { expires: number; book: BitgetOrderBook }>();
let spotBookInFlight: Promise<BitgetOrderBook> | null = null;
let bookTtlMs = 15_000;

function parseLevels(raw: string[][] | undefined, descending: boolean): BookLevel[] {
  const levels: BookLevel[] = [];
  for (const row of raw ?? []) {
    const price = Number(row?.[0]);
    const size = Number(row?.[1]);
    if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
    if (price <= 0 || size <= 0) continue;
    levels.push({ price, size });
  }
  levels.sort((a, b) => (descending ? b.price - a.price : a.price - b.price));
  return levels;
}

async function fetchBook(symbol: string, venue: BitgetOrderBook["venue"]): Promise<BitgetOrderBook> {
  const url =
    venue === "spot"
      ? `https://api.bitget.com/api/v2/spot/market/orderbook?symbol=${encodeURIComponent(symbol)}&limit=150`
      : `https://api.bitget.com/api/v2/mix/market/orderbook?productType=USDT-FUTURES&symbol=${encodeURIComponent(symbol)}`;

  const key = `${venue}:${symbol}`;
  const hit = bookCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.book;

  const json = await fetchJson<BookResponse>(url, { timeoutMs: 4_000 });
  const bids = parseLevels(json.data?.bids, true);
  const asks = parseLevels(json.data?.asks, false);
  if (!bids.length || !asks.length) throw new Error(`empty order book for ${key}`);

  const rawTs = json.data?.ts ?? json.ts;
  const ts = Number(rawTs);
  const book: BitgetOrderBook = {
    symbol,
    venue,
    bids,
    asks,
    ts: Number.isFinite(ts) ? ts : Date.now(),
  };
  bookCache.set(key, { expires: Date.now() + bookTtlMs, book });
  return book;
}

export async function bitgetOrderBook(
  symbol: string,
  venue: BitgetOrderBook["venue"] = "spot",
): Promise<BitgetOrderBook | undefined> {
  const key = `${venue}:${symbol}`;
  try {
    if (venue === "spot") {
      spotBookInFlight ??= fetchBook(symbol, venue).finally(() => {
        spotBookInFlight = null;
      });
      return await spotBookInFlight;
    }
    return await fetchBook(symbol, venue);
  } catch {
    return undefined;
  }
}

export async function bitgetOrderBookForSymbols(
  symbols: string[],
): Promise<BitgetOrderBook | undefined> {
  for (const symbol of symbols) {
    const spot = await bitgetOrderBook(symbol, "spot");
    if (spot) return spot;
    const perp = await bitgetOrderBook(symbol, "USDT-FUTURES");
    if (perp) return perp;
  }
  return undefined;
}

export function setOrderBookTtl(ms: number): void {
  bookTtlMs = Math.max(0, ms);
  bookCache.clear();
}

export function bookAsOf(book: BitgetOrderBook): string {
  return new Date(book.ts).toISOString();
}

export function midPrice(book: BitgetOrderBook): number {
  const bestBid = book.bids[0]?.price;
  const bestAsk = book.asks[0]?.price;
  if (!bestBid || !bestAsk) return 0;
  return (bestBid + bestAsk) / 2;
}

export function topOfBook(book: BitgetOrderBook): { bid: number; ask: number; spreadBps: number } {
  const bestBid = book.bids[0]?.price ?? 0;
  const bestAsk = book.asks[0]?.price ?? 0;
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;
  const spreadBps = mid > 0 ? ((bestAsk - bestBid) / mid) * 10_000 : 0;
  return { bid: bestBid, ask: bestAsk, spreadBps };
}

export function totalDepthUsd(book: BitgetOrderBook, levels: number): { bid: number; ask: number } {
  let bid = 0;
  let ask = 0;
  for (let i = 0; i < levels && i < book.bids.length; i++) bid += book.bids[i].price * book.bids[i].size;
  for (let i = 0; i < levels && i < book.asks.length; i++) ask += book.asks[i].price * book.asks[i].size;
  return { bid, ask };
}