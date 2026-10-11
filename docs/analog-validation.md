# Analog band validation

Generated 2026-10-10T17:20:27.712Z by `scripts/validate-analog-bands.ts`.

## What this measures

For each evaluation point the band was rebuilt from price history that stops
**before** that date, then compared with the return that actually happened over
the following 5 sessions. No data after the cut is visible to
the band builder.

**This validates band coverage only.** It says how often the stated p10-p90
range contained the realised move. It does not make any single outcome
predictable, and a correctly sized band is still wrong on any given day.

## Method

- Tickers: 20 liquid US names, listed in `TICKERS` in the script.
- Source: Yahoo daily OHLC, ~10 years.
- Fit window: the stock's own 20-day shapes, using the same
  `computeEmpiricalRanges` path the product uses at request time.
- Re-fit every 10 sessions; up to 24 evaluation points per ticker.
- Forward window: 5 sessions, close to close.

## Result

| Figure | Value |
|---|---|
| Evaluation points | 480 |
| Realised move inside the stated band | 319 (66.5%) |
| Below p10 | 85 (17.7%) |
| Above p90 | 76 (15.8%) |
| Mean band width | 7.07 percentage points |
| Median band median (p50) | 0.27% |
| Median realised | 0.33% |

## Per ticker

| Ticker | Points | Inside | Coverage |
|---|---|---|---|
| WMT | 24 | 22 | 91.7% |
| NVDA | 24 | 19 | 79.2% |
| GOOGL | 24 | 19 | 79.2% |
| V | 24 | 19 | 79.2% |
| CVX | 24 | 19 | 79.2% |
| AAPL | 24 | 17 | 70.8% |
| JNJ | 24 | 17 | 70.8% |
| AMZN | 24 | 16 | 66.7% |
| PG | 24 | 16 | 66.7% |
| ABBV | 24 | 16 | 66.7% |
| KO | 24 | 16 | 66.7% |
| MSFT | 24 | 15 | 62.5% |
| JPM | 24 | 15 | 62.5% |
| HD | 24 | 15 | 62.5% |
| PEP | 24 | 15 | 62.5% |
| TMO | 24 | 15 | 62.5% |
| META | 24 | 13 | 54.2% |
| TSLA | 24 | 12 | 50.0% |
| XOM | 24 | 12 | 50.0% |
| UNH | 24 | 11 | 45.8% |

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

- Every ticker completed.

Tickers with too little history or no usable evaluation point are listed above
and are excluded from the headline figures. They are not silently dropped.
