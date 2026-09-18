import { chartLibraryState } from "../providers/chart-library";
import { forwardReturn, yahooChart } from "../providers/yahoo";
import type { Bar } from "../indicators";
import type { AnalogFollowThrough, AnalogsPillar, OverlaySeries, Regime } from "../types";
import type { NameCard } from "../universe";

function overlayFromBars(
  id: string,
  label: string,
  kind: "current" | "analog",
  closes: Bar[],
  centerIdx: number,
  left = 20,
  right = 10,
): OverlaySeries {
  const origin = closes[centerIdx]?.c;
  const points = [];
  for (let t = -left; t <= right; t++) {
    const bar = closes[centerIdx + t];
    points.push({
      t,
      value: bar && origin ? (bar.c / origin) * 100 : null,
    });
  }
  return { id, label, kind, points };
}

function findSameTickerAnalogs(
  bars: Bar[],
  ticker: string,
  minDaysApart = 15,
  windowSize = 20,
): AnalogFollowThrough[] {
  if (!bars || bars.length < windowSize * 2 + 20) return [];

  const currentIdx = bars.length - 1;
  const currentOrigin = bars[currentIdx]?.c;
  if (!currentOrigin || currentOrigin <= 0) return [];

  const currentShape: number[] = [];
  for (let t = -windowSize; t <= 0; t++) {
    const b = bars[currentIdx + t];
    if (!b || b.c <= 0) return [];
    currentShape.push(b.c / currentOrigin);
  }

  type Candidate = {
    idx: number;
    date: string;
    distance: number;
  };
  const candidates: Candidate[] = [];

  const scanEnd = bars.length - 30;
  for (let i = windowSize; i <= scanEnd; i++) {
    const origin = bars[i]?.c;
    if (!origin || origin <= 0) continue;

    let sumSq = 0;
    let valid = true;
    for (let j = 0; j <= windowSize; j++) {
      const b = bars[i - windowSize + j];
      if (!b || b.c <= 0) {
        valid = false;
        break;
      }
      const diff = b.c / origin - currentShape[j];
      sumSq += diff * diff;
    }
    if (!valid) continue;

    const distance = Math.sqrt(sumSq / (windowSize + 1));
    const dateStr = new Date(bars[i].t * 1000).toISOString().slice(0, 10);
    candidates.push({ idx: i, date: dateStr, distance });
  }

  candidates.sort((a, b) => a.distance - b.distance);

  const distinct: Candidate[] = [];
  for (const c of candidates) {
    const cTime = new Date(c.date).getTime();
    const isNearby = distinct.some((d) => Math.abs(new Date(d.date).getTime() - cTime) < minDaysApart * 86400000);
    if (!isNearby) {
      distinct.push(c);
      if (distinct.length >= 4) break;
    }
  }

  return distinct.map((d) => ({
    ticker,
    date: d.date,
    distance: d.distance,
    sameName: true,
    ret1d: forwardReturn(bars, d.date, 1),
    ret5d: forwardReturn(bars, d.date, 5),
    ret10d: forwardReturn(bars, d.date, 10),
  })).filter(
    (a) =>
      (typeof a.ret5d === "number" && !Number.isNaN(a.ret5d)) ||
      (typeof a.ret1d === "number" && !Number.isNaN(a.ret1d)) ||
      (typeof a.ret10d === "number" && !Number.isNaN(a.ret10d)),
  );
}

function computeEmpiricalRanges(
  bars: Bar[],
  windowSize = 20,
): { ranges: AnalogsPillar["ranges"]; sampleN: number } {
  if (!bars || bars.length < windowSize * 2 + 30) {
    return { ranges: [], sampleN: 0 };
  }

  const currentIdx = bars.length - 1;
  const currentOrigin = bars[currentIdx]?.c;
  if (!currentOrigin || currentOrigin <= 0) return { ranges: [], sampleN: 0 };

  const currentShape: number[] = [];
  for (let t = -windowSize; t <= 0; t++) {
    const b = bars[currentIdx + t];
    if (!b || b.c <= 0) return { ranges: [], sampleN: 0 };
    currentShape.push(b.c / currentOrigin);
  }

  type Candidate = { idx: number; dist: number };
  const candidates: Candidate[] = [];
  const scanEnd = bars.length - 15;
  for (let i = windowSize; i <= scanEnd; i++) {
    const origin = bars[i]?.c;
    if (!origin || origin <= 0) continue;

    let sumSq = 0;
    let valid = true;
    for (let j = 0; j <= windowSize; j++) {
      const b = bars[i - windowSize + j];
      if (!b || b.c <= 0) {
        valid = false;
        break;
      }
      const diff = b.c / origin - currentShape[j];
      sumSq += diff * diff;
    }
    if (!valid) continue;

    const dist = Math.sqrt(sumSq / (windowSize + 1));
    candidates.push({ idx: i, dist });
  }

  candidates.sort((a, b) => a.dist - b.dist);

  const distinct: Candidate[] = [];
  for (const c of candidates) {
    if (!distinct.some((d) => Math.abs(d.idx - c.idx) < 5)) {
      distinct.push(c);
      if (distinct.length >= 100) break;
    }
  }

  if (distinct.length < 10) return { ranges: [], sampleN: 0 };

  function getPercentiles(returns: number[]) {
    if (!returns.length) return { n: 0, p10: 0, p50: 0, p90: 0, pUp: 0 };
    returns.sort((a, b) => a - b);
    const n = returns.length;
    const p10 = returns[Math.floor(n * 0.10)];
    const p50 = returns[Math.floor(n * 0.50)];
    const p90 = returns[Math.floor(n * 0.90)];
    const upCount = returns.filter((r) => r > 0).length;
    return { n, p10, p50, p90, pUp: upCount / n };
  }

  const ret1d: number[] = [];
  const ret5d: number[] = [];
  const ret10d: number[] = [];

  for (const c of distinct) {
    const p0 = bars[c.idx].c;
    if (bars[c.idx + 1]?.c) ret1d.push(((bars[c.idx + 1].c - p0) / p0) * 100);
    if (bars[c.idx + 5]?.c) ret5d.push(((bars[c.idx + 5].c - p0) / p0) * 100);
    if (bars[c.idx + 10]?.c) ret10d.push(((bars[c.idx + 10].c - p0) / p0) * 100);
  }

  return {
    ranges: [
      { horizon: "1d", ...getPercentiles(ret1d) },
      { horizon: "5d", ...getPercentiles(ret5d) },
      { horizon: "10d", ...getPercentiles(ret10d) },
    ],
    sampleN: distinct.length,
  };
}

export async function runAnalogs(
  name: NameCard,
  opts: { regime?: Regime; communityId?: string; communityMembers?: string[] } = {},
): Promise<AnalogsPillar> {
  const [chartLibResult, selfChartResult] = await Promise.allSettled([
    chartLibraryState(name.native),
    yahooChart(name.native, "10y", "1d"),
  ]);

  const selfBars = selfChartResult.status === "fulfilled" ? selfChartResult.value.bars ?? [] : [];
  const sameTickerAnalogs = findSameTickerAnalogs(selfBars, name.native);

  const packet = chartLibResult.status === "fulfilled" ? chartLibResult.value : null;
  const chartLibOk = packet && packet.status === "ok" && packet.data?.analogs_of_new_state && packet.data.analogs_of_new_state.n > 0;

  if (chartLibOk && packet?.data?.analogs_of_new_state) {
    const analogs = packet.data.analogs_of_new_state;
    const members = new Set(opts.communityMembers ?? []);

    const ranked = [...(analogs.closest ?? [])].sort((a, b) => {
      const aSame = a[0] === name.native ? 0 : 1;
      const bSame = b[0] === name.native ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;

      const aRelated = a[0].startsWith(name.native) || name.native.startsWith(a[0]) ? 0 : 1;
      const bRelated = b[0].startsWith(name.native) || name.native.startsWith(b[0]) ? 0 : 1;
      if (aRelated !== bRelated) return aRelated - bRelated;

      const aIn = members.has(a[0]) ? 0 : 1;
      const bIn = members.has(b[0]) ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;

      return a[2] - b[2];
    });
    const poolRaw = ranked.slice(0, 15);

    const uniqueTickers = [...new Set(poolRaw.map((x) => x[0]))].filter((t) => t !== name.native);
    const charts = await Promise.all(
      uniqueTickers.map(async (ticker) => {
        try {
          const { bars } = await yahooChart(ticker, "10y", "1d");
          return [ticker, bars] as const;
        } catch {
          return [ticker, []] as const;
        }
      }),
    );
    const byTicker: Record<string, Bar[]> = {
      [name.native]: selfBars,
      ...Object.fromEntries(charts),
    };

    const poolComputed: AnalogFollowThrough[] = [
      ...sameTickerAnalogs,
      ...poolRaw.map(([ticker, date, distance]) => {
        const bars = byTicker[ticker] ?? [];
        return {
          ticker,
          date,
          distance,
          sameName: ticker === name.native,
          ret1d: bars.length ? forwardReturn(bars, date, 1) : null,
          ret5d: bars.length ? forwardReturn(bars, date, 5) : null,
          ret10d: bars.length ? forwardReturn(bars, date, 10) : null,
        };
      }),
    ];

    const validPool = poolComputed.filter(
      (a) =>
        (typeof a.ret5d === "number" && !Number.isNaN(a.ret5d)) ||
        (typeof a.ret1d === "number" && !Number.isNaN(a.ret1d)) ||
        (typeof a.ret10d === "number" && !Number.isNaN(a.ret10d)),
    );

    const closest: AnalogFollowThrough[] = [...validPool].sort((a, b) => {
      const aSame = a.sameName ? 0 : 1;
      const bSame = b.sameName ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;

      const aRelated = a.ticker.startsWith(name.native) || name.native.startsWith(a.ticker) || members.has(a.ticker) ? 0 : 1;
      const bRelated = b.ticker.startsWith(name.native) || name.native.startsWith(b.ticker) || members.has(b.ticker) ? 0 : 1;
      if (aRelated !== bRelated) return aRelated - bRelated;

      const aScore = (a.ret5d !== null ? 4 : 0) + (a.ret1d !== null ? 2 : 0) + (a.ret10d !== null ? 1 : 0);
      const bScore = (b.ret5d !== null ? 4 : 0) + (b.ret1d !== null ? 2 : 0) + (b.ret10d !== null ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;

      return a.distance - b.distance;
    }).slice(0, 5);

    const overlay: OverlaySeries[] = [];
    if (selfBars.length) {
      overlay.push(
        overlayFromBars(
          name.native,
          `${name.native} now`,
          "current",
          selfBars,
          selfBars.length - 1,
        ),
      );
    }
    for (const analog of closest) {
      const bars = byTicker[analog.ticker] ?? [];
      if (!bars.length) continue;
      const target = Date.parse(`${analog.date}T20:00:00Z`);
      let idx = 0;
      let best = Infinity;
      bars.forEach((b: Bar, i: number) => {
        const d = Math.abs(b.t * 1000 - target);
        if (d < best) {
          best = d;
          idx = i;
        }
      });
      overlay.push(
        overlayFromBars(
          `${analog.ticker}-${analog.date}`,
          `${analog.ticker} ${analog.date}`,
          "analog",
          bars,
          idx,
        ),
      );
    }

    const horizonOrder = ["1d", "5d", "10d"];
    const ranges = Object.entries(analogs.excess_followed ?? {})
      .map(([horizon, row]) => ({
        horizon,
        n: row.n,
        p10: row.p10,
        p50: row.p50,
        p90: row.p90,
        pUp: row.p_up,
      }))
      .sort((a, b) => {
        const ai = horizonOrder.indexOf(a.horizon);
        const bi = horizonOrder.indexOf(b.horizon);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

    return {
      ok: true,
      session: packet.data.date,
      state: packet.data.state,
      prevState: packet.data.prev_state,
      tape: packet.data.tape,
      closest,
      ranges,
      informative: {
        verdict: analogs.informative_5d?.verdict,
        ratioToBase: analogs.informative_5d?.ratio_to_base,
        note: "Informative here means the analog range is tighter or more structured than the baseline sample — not that a direction is known.",
      },
      overlay,
      sample: { n: analogs.n, symbols: analogs.symbols, sessions: analogs.sessions },
      caveats: [
        packet.meta?.note ?? "Chart Library bands describe historical excess versus a liquid-stock baseline.",
        `Sample: ${analogs.n} analogs across ${analogs.symbols} names and ${analogs.sessions} sessions.`,
        "Follow-through percentages on the five closest names are cash-session closes from Yahoo, not rToken marks.",
      ],
      sources: [
        { label: "Chart Library state-packet", url: `https://chartlibrary.io/api/v1/state-packet?symbol=${name.native}` },
        { label: "Yahoo Finance forward returns on closest analogs" },
      ],
    };
  }

  // Fallback / Self-contained empirical distribution from native Yahoo bars
  if (selfBars.length >= 70) {
    const empirical = computeEmpiricalRanges(selfBars);
    if (empirical.sampleN > 0 && empirical.ranges.length > 0) {
      const overlay: OverlaySeries[] = [];
      overlay.push(
        overlayFromBars(
          name.native,
          `${name.native} now`,
          "current",
          selfBars,
          selfBars.length - 1,
        ),
      );

      const closest = sameTickerAnalogs.slice(0, 5);
      for (const analog of closest) {
        const target = Date.parse(`${analog.date}T20:00:00Z`);
        let idx = 0;
        let best = Infinity;
        selfBars.forEach((b: Bar, i: number) => {
          const d = Math.abs(b.t * 1000 - target);
          if (d < best) {
            best = d;
            idx = i;
          }
        });
        overlay.push(
          overlayFromBars(
            `${analog.ticker}-${analog.date}`,
            `${analog.ticker} ${analog.date}`,
            "analog",
            selfBars,
            idx,
          ),
        );
      }

      return {
        ok: true,
        session: new Date().toISOString().slice(0, 10),
        state: "native-empirical",
        prevState: "native-empirical",
        tape: {},
        closest,
        ranges: empirical.ranges,
        informative: {
          verdict: "empirical-native",
          ratioToBase: 1.0,
          note: "Distribution computed directly from historical price sessions of the same stock.",
        },
        overlay,
        sample: { n: empirical.sampleN, symbols: 1, sessions: empirical.sampleN },
        caveats: [
          `Sample: ${empirical.sampleN} historical chart-shape precedents identified from 10 years of daily trading history for ${name.native}.`,
          "Follow-through percentages reflect actual cash-session close-to-close returns.",
        ],
        sources: [
          { label: `Yahoo Finance 10y historical daily price tape (${name.native})` },
        ],
      };
    }
  }

  // Graceful degradation when both remote feeds return insufficient data
  return {
    ok: false,
    error: "Historical comparison was not available in this run",
    closest: [],
    ranges: [],
    overlay: [],
    sample: { n: 0, symbols: 0, sessions: 0 },
    caveats: ["Historical pattern comparison unavailable this run: sufficient chart data could not be retrieved."],
    sources: [{ label: "Chart Library" }, { label: "Yahoo Finance" }],
  };
}
