import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Bar } from "../lib/indicators";
import { computeEmpiricalRangesForTest } from "../lib/pillars/analogs";
import { yahooChart } from "../lib/providers/yahoo";

/**
 * Walk-forward check on the analog bands.
 *
 * For each evaluation date, bands are built from bars strictly before that
 * date and compared with what the market actually did afterwards. Nothing after
 * the cut is visible to the band. The reported figure is coverage: how often the
 * realised 5-day return landed inside the stated p10-p90 band. It measures
 * whether the band is the right width. It says nothing about direction, and a
 * band can be correctly sized and still be wrong on any given day.
 */

// Tunable: liquid, widely held names so the sample is not dominated by one
// sector. Chosen for data availability rather than for a result.
const TICKERS = [
  "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "JPM", "V", "WMT",
  "XOM", "UNH", "JNJ", "PG", "HD", "CVX", "ABBV", "PEP", "KO", "TMO",
] as const;

// Tunable: how often to re-fit. Every 10 sessions across roughly five years.
const STEP_SESSIONS = 10;
// Tunable: how many evaluation points per ticker. Bounds runtime.
const MAX_EVALS_PER_TICKER = 24;
// Tunable: the forward window whose containment we measure.
const HORIZON_SESSIONS = 5;

const CACHE_PATH = path.join(process.cwd(), "data", ".cache", "band-validation-bars.json");
const OUT_PATH = path.join(process.cwd(), "docs", "analog-validation.md");

type Cache = { fetchedAt: string; series: Record<string, Bar[]> };

function readCache(): Cache | null {
  try {
    const parsed = JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache;
    return parsed.series ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(cache: Cache): void {
  mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf8");
}

async function loadSeries(ticker: string, cache: Cache): Promise<Bar[]> {
  if (cache.series[ticker]?.length) return cache.series[ticker];
  const { bars } = await yahooChart(ticker, "10y", "1d");
  cache.series[ticker] = bars;
  return bars;
}

type Eval = {
  ticker: string;
  cutIndex: number;
  band: { p10: number; p50: number; p90: number };
  realised: number;
  inside: boolean;
  belowP10: boolean;
  aboveP90: boolean;
};

function evaluate(ticker: string, bars: Bar[], cache: Cache): Eval[] {
  const out: Eval[] = [];
  // Leave room after the cut for the forward window.
  const lastCut = bars.length - HORIZON_SESSIONS - 1;
  const firstCut = 400;

  for (let cut = firstCut; cut <= lastCut && out.length < MAX_EVALS_PER_TICKER; cut += STEP_SESSIONS) {
    const history = bars.slice(0, cut);
    if (history.length < 300) continue;

    const result = computeEmpiricalRangesForTest(history, 20);
    const band = result.ranges.find((r) => r.horizon === `${HORIZON_SESSIONS}d`);
    if (!band || result.tier === "insufficient") continue;
    if (!Number.isFinite(band.p10) || !Number.isFinite(band.p90)) continue;

    const entry = bars[cut - 1]?.c;
    const exit = bars[cut + HORIZON_SESSIONS - 1]?.c;
    if (!entry || !exit || entry <= 0) continue;

    const realised = ((exit - entry) / entry) * 100;

    out.push({
      ticker,
      cutIndex: cut,
      band: { p10: band.p10, p50: band.p50, p90: band.p90 },
      realised,
      inside: realised >= band.p10 && realised <= band.p90,
      belowP10: realised < band.p10,
      aboveP90: realised > band.p90,
    });
  }
  void cache;
  return out;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

async function main() {
  const cache = readCache() ?? { fetchedAt: new Date().toISOString(), series: {} };

  const all: Eval[] = [];
  const failures: string[] = [];
  const perTicker: Array<{ ticker: string; n: number; inside: number; coverage: number }> = [];

  for (const ticker of TICKERS) {
    try {
      const bars = await loadSeries(ticker, cache);
      if (bars.length < 400) {
        failures.push(`${ticker}: only ${bars.length} bars`);
        continue;
      }
      const evals = evaluate(ticker, bars, cache);
      if (!evals.length) {
        failures.push(`${ticker}: no usable evaluation points`);
        continue;
      }
      const inside = evals.filter((e) => e.inside).length;
      perTicker.push({ ticker, n: evals.length, inside, coverage: inside / evals.length });
      all.push(...evals);
      process.stdout.write(`${ticker}: ${inside}/${evals.length}\n`);
    } catch (err) {
      failures.push(`${ticker}: ${String(err).slice(0, 80)}`);
    }
  }

  writeCache(cache);

  if (!all.length) {
    console.error("No evaluations completed. Provider data was unavailable.");
    process.exit(1);
  }

  const inside = all.filter((e) => e.inside).length;
  const below = all.filter((e) => e.belowP10).length;
  const above = all.filter((e) => e.aboveP90).length;
  const observedCoverage = inside / all.length;

  const width = all.reduce((sum, e) => sum + (e.band.p90 - e.band.p10), 0) / all.length;
  const medianP50 = [...all].map((e) => e.band.p50).sort((a, b) => a - b)[Math.floor(all.length / 2)] ?? 0;
  const medianRealised = [...all].map((e) => e.realised).sort((a, b) => a - b)[Math.floor(all.length / 2)] ?? 0;

  const rows = perTicker
    .slice()
    .sort((a, b) => b.coverage - a.coverage)
    .map((t) => `| ${t.ticker} | ${t.n} | ${t.inside} | ${pct(t.coverage)} |`)
    .join("\n");

  const doc = `# Analog band validation

Generated ${new Date().toISOString()} by \`scripts/validate-analog-bands.ts\`.

## What this measures

For each evaluation point the band was rebuilt from price history that stops
**before** that date, then compared with the return that actually happened over
the following ${HORIZON_SESSIONS} sessions. No data after the cut is visible to
the band builder.

**This validates band coverage only.** It says how often the stated p10-p90
range contained the realised move. It does not make any single outcome
predictable, and a correctly sized band is still wrong on any given day.

## Method

- Tickers: ${TICKERS.length} liquid US names, listed in \`TICKERS\` in the script.
- Source: Yahoo daily OHLC, ~10 years.
- Fit window: the stock's own 20-day shapes, using the same
  \`computeEmpiricalRanges\` path the product uses at request time.
- Re-fit every ${STEP_SESSIONS} sessions; up to ${MAX_EVALS_PER_TICKER} evaluation points per ticker.
- Forward window: ${HORIZON_SESSIONS} sessions, close to close.

## Result

| Figure | Value |
|---|---|
| Evaluation points | ${all.length} |
| Realised move inside the stated band | ${inside} (${pct(observedCoverage)}) |
| Below p10 | ${below} (${pct(below / all.length)}) |
| Above p90 | ${above} (${pct(above / all.length)}) |
| Mean band width | ${width.toFixed(2)} percentage points |
| Median band median (p50) | ${medianP50.toFixed(2)}% |
| Median realised | ${medianRealised.toFixed(2)}% |

## Per ticker

| Ticker | Points | Inside | Coverage |
|---|---|---|---|
${rows}

## Reading this

A band claiming p10-p90 is by construction meant to contain roughly 80% of
outcomes on unseen data. The headline figure is therefore a direct check of that
claim. A figure materially below 80% means the band is too narrow for the
sample it was fitted on; a figure above 80% means it is wider than it claims and
is not adding information.

The tail figures matter as much as the headline. Heavy mass on one side of the
band means the distribution is skewed in this sample, which the median band
figure alone would hide.

## Coverage of this run

${failures.length ? failures.map((f) => `- ${f}`).join("\n") : "- Every ticker completed."}

Tickers with too little history or no usable evaluation point are listed above
and are excluded from the headline figures. They are not silently dropped.
`;

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, doc, "utf8");

  console.log(`\n${all.length} evaluation points across ${perTicker.length} tickers`);
  console.log(`inside stated band: ${inside}/${all.length} = ${pct(observedCoverage)}`);
  console.log(`wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});