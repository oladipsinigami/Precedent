export type Bar = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export function sma(values: number[], n: number): number | undefined {
  if (values.length < n) return undefined;
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

export function emaSeries(values: number[], n: number): number[] {
  if (!values.length) return [];
  const k = 2 / (n + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function rsi(values: number[], n = 14): number | undefined {
  if (values.length <= n) return undefined;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - n; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / n / (loss / n);
  return 100 - 100 / (1 + rs);
}

export function macd(values: number[]): { macd: number; signal: number } | undefined {
  if (values.length < 35) return undefined;
  const ema12 = emaSeries(values, 12);
  const ema26 = emaSeries(values, 26);
  const line = ema12.map((v, i) => v - ema26[i]);
  const signalSeries = emaSeries(line, 9);
  return { macd: line[line.length - 1], signal: signalSeries[signalSeries.length - 1] };
}

export function atr(bars: Bar[], n = 14): number | undefined {
  if (bars.length < n + 1) return undefined;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].c;
    const b = bars[i];
    trs.push(Math.max(b.h - b.l, Math.abs(b.h - prev), Math.abs(b.l - prev)));
  }
  return sma(trs, n);
}

export function realizedVol(values: number[], n = 20): number | undefined {
  if (values.length < n + 1) return undefined;
  const rets: number[] = [];
  for (let i = values.length - n; i < values.length; i++) {
    rets.push(Math.log(values[i] / values[i - 1]));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varSum = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(varSum) * Math.sqrt(252) * 100;
}

export function swingLevels(bars: Bar[], lookback = 60): { support: number[]; resistance: number[] } {
  const window = bars.slice(-lookback);
  if (window.length < 10) return { support: [], resistance: [] };
  const highs = window.map((b) => b.h).sort((a, b) => b - a);
  const lows = window.map((b) => b.l).sort((a, b) => a - b);
  const resistance = uniqueNear([highs[0], highs[Math.floor(highs.length * 0.1)], highs[Math.floor(highs.length * 0.2)]]);
  const support = uniqueNear([lows[0], lows[Math.floor(lows.length * 0.1)], lows[Math.floor(lows.length * 0.2)]]);
  return { support, resistance };
}

function uniqueNear(values: number[], pct = 0.008): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (out.some((x) => Math.abs(x - v) / v < pct)) continue;
    out.push(Number(v.toFixed(2)));
    if (out.length >= 3) break;
  }
  return out;
}

export function pctChange(from: number, to: number): number {
  return ((to - from) / from) * 100;
}

export function describeTrend(last: number, sma20?: number, sma50?: number, sma200?: number): string {
  const vs20 = sma20 ? last - sma20 : 0;
  const vs50 = sma50 ? last - sma50 : 0;
  const stacked = sma20 && sma50 && sma200 ? sma20 > sma50 && sma50 > sma200 : false;
  if (stacked && vs20 > 0) return "Price is above its 20-, 50-, and 200-day averages, showing steady upward movement.";
  if (sma200 && last < sma200 && vs50 < 0) return "Price is below its 50- and 200-day averages, showing steady downward movement.";
  if (vs20 > 0 && vs50 > 0) return "Price is holding above its 20- and 50-day price averages.";
  if (vs20 < 0 && vs50 > 0) return "Price is below its 20-day average but still above its 50-day average.";
  return "Price is between its short- and long-term averages; recent direction is mixed.";
}

export function describeMomentum(rsi14?: number, macdLine?: number, macdSignal?: number): string {
  const bits: string[] = [];
  if (rsi14 !== undefined) {
    if (rsi14 >= 70) bits.push(`Short-term strength score (RSI) is high at ${rsi14.toFixed(1)} out of 100, meaning recent gains have been fast and prices often pause here`);
    else if (rsi14 <= 30) bits.push(`Short-term strength score (RSI) is low at ${rsi14.toFixed(1)} out of 100, meaning recent drops have been fast and prices often pause here`);
    else bits.push(`Short-term strength score (RSI) is in the middle at ${rsi14.toFixed(1)} out of 100`);
  }
  if (macdLine !== undefined && macdSignal !== undefined) {
    bits.push(macdLine > macdSignal ? "Trend-speed indicator (MACD) shows short-term momentum is running faster than its baseline" : "Trend-speed indicator (MACD) shows short-term momentum is running slower than its baseline");
  }
  return bits.join(". ") || "Short-term momentum readings were incomplete.";
}
