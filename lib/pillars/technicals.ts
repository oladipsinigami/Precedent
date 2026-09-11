import {
  atr,
  describeMomentum,
  describeTrend,
  macd,
  realizedVol,
  rsi,
  sma,
  swingLevels,
} from "../indicators";
import { bitgetTape } from "../providers/bitget";
import { yahooChart } from "../providers/yahoo";
import type { TechnicalsPillar } from "../types";
import type { NameCard } from "../universe";

export async function runTechnicals(name: NameCard): Promise<TechnicalsPillar> {
  try {
    const [{ meta, bars }, rTape] = await Promise.all([yahooChart(name.native, "1y", "1d"), bitgetTape(name)]);
    const closes = bars.map((b) => b.c);
    const last = closes[closes.length - 1] ?? meta.regularMarketPrice;
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);
    const rsi14 = rsi(closes, 14);
    const macdPrint = macd(closes);
    const atr14 = atr(bars, 14);
    const vol = realizedVol(closes, 20);
    const levels = swingLevels(bars, 60);
    const dist52 = meta.fiftyTwoWeekHigh ? ((last - meta.fiftyTwoWeekHigh) / meta.fiftyTwoWeekHigh) * 100 : undefined;
    const asOf = new Date(meta.regularMarketTime * 1000).toISOString();

    const notes = [
      describeTrend(last, sma20, sma50, sma200),
      describeMomentum(rsi14, macdPrint?.macd, macdPrint?.signal),
      vol !== undefined ? `20-session realized vol (annualized) ~ ${vol.toFixed(1)}%.` : "Realized vol unavailable.",
      dist52 !== undefined ? `Distance from 52-week high: ${dist52.toFixed(1)}%.` : "",
    ].filter(Boolean);

    let rTokenGap: string | undefined;
    let premiumPct: number | null | undefined;
    if (rTape) {
      premiumPct = ((rTape.last - last) / last) * 100;
      rTokenGap = `Bitget rToken tape ${rTape.symbol} last ${rTape.last} vs native ${last} (${premiumPct >= 0 ? "+" : ""}${premiumPct.toFixed(2)}% vs cash last). Treat as a venue print, not NAV.`;
    } else {
      rTokenGap =
        "Bitget rToken tape was not reachable from this environment. Native cash session (Yahoo) is the tape; 7×24 implications are framed, not fabricated.";
    }

    return {
      ok: true,
      native: {
        last,
        changePct: meta.regularMarketChangePercent,
        high52: meta.fiftyTwoWeekHigh,
        low52: meta.fiftyTwoWeekLow,
        volume: meta.regularMarketVolume,
        asOf,
      },
      rToken: rTape
        ? { ...rTape, premiumPct }
        : undefined,
      rTokenGap,
      trend: describeTrend(last, sma20, sma50, sma200),
      momentum: describeMomentum(rsi14, macdPrint?.macd, macdPrint?.signal),
      volatility: vol !== undefined ? `${vol.toFixed(1)}% realized (20d ann.)` : "n/a",
      levels,
      indicators: {
        sma20,
        sma50,
        sma200,
        rsi14,
        macd: macdPrint?.macd,
        macdSignal: macdPrint?.signal,
        atr14,
        realizedVol20: vol,
        dist52wHighPct: dist52,
      },
      spark: closes.slice(-40),
      notes,
      sources: [
        { label: `Yahoo Finance chart ${name.native}`, url: `https://finance.yahoo.com/quote/${name.native}` },
        ...(rTape ? [{ label: `Bitget ${rTape.symbol}` }] : [{ label: "Bitget public ticker (unreachable this run)" }]),
      ],
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Technicals fetch failed",
      native: { last: 0, changePct: 0, high52: 0, low52: 0, volume: 0, asOf: "" },
      trend: "unavailable",
      momentum: "unavailable",
      volatility: "unavailable",
      levels: { support: [], resistance: [] },
      indicators: {},
      spark: [],
      notes: [],
      sources: [],
    };
  }
}
