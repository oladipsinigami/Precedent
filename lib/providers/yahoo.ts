import { fetchJson, yahooHeaders } from "../http";
import type { Bar } from "../indicators";

type ChartResponse = {
  chart: {
    result: {
      meta: {
        regularMarketPrice: number;
        regularMarketChangePercent: number;
        fiftyTwoWeekHigh: number;
        fiftyTwoWeekLow: number;
        regularMarketVolume: number;
        regularMarketTime: number;
        longName?: string;
        shortName?: string;
        instrumentType?: string;
        hasPrePostMarketData?: boolean;
        fulldayPrice?: number;
        fulldayChangePercent?: number;
      };
      timestamp: number[];
      indicators: { quote: { open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }[] };
    }[];
    error: unknown;
  };
};

type SearchResponse = {
  news?: {
    title: string;
    publisher?: string;
    link: string;
    providerPublishTime?: number;
  }[];
};

export async function yahooChart(symbol: string, range = "1y", interval = "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=true`;
  const data = await fetchJson<ChartResponse>(url, {
    headers: yahooHeaders(),
    cacheTtlMs: 60_000,
    timeoutMs: 12_000,
  });
  const result = data.chart.result?.[0];
  if (!result) throw new Error(`Yahoo chart empty for ${symbol}`);
  const q = result.indicators.quote[0];
  const bars: Bar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    const v = q.volume[i];
    if ([o, h, l, c].some((x) => x == null || Number.isNaN(x))) continue;
    bars.push({ t: result.timestamp[i], o, h, l, c, v: v ?? 0 });
  }
  return { meta: result.meta, bars };
}

export async function yahooNews(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=10`;
  const data = await fetchJson<SearchResponse>(url, {
    headers: yahooHeaders(),
    cacheTtlMs: 60_000,
  });
  return (data.news ?? []).map((n) => ({
    title: n.title,
    publisher: n.publisher ?? "Yahoo Finance",
    url: n.link,
    published: n.providerPublishTime
      ? new Date(n.providerPublishTime * 1000).toISOString()
      : undefined,
  }));
}

export function nearestBar(bars: Bar[], iso: string): Bar | undefined {
  const target = Date.parse(`${iso}T20:00:00Z`);
  if (Number.isNaN(target)) return undefined;
  let best: Bar | undefined;
  let bestDist = Infinity;
  for (const b of bars) {
    const dist = Math.abs(b.t * 1000 - target);
    if (dist < bestDist) {
      best = b;
      bestDist = dist;
    }
  }
  if (!best || bestDist > 1000 * 60 * 60 * 24 * 6) return undefined;
  return best;
}

export function forwardReturn(bars: Bar[], analogIso: string, sessions: number): number | null {
  const start = nearestBar(bars, analogIso);
  if (!start) return null;
  const idx = bars.findIndex((b) => b.t === start.t);
  const end = bars[idx + sessions];
  if (!end) return null;
  return ((end.c - start.c) / start.c) * 100;
}
