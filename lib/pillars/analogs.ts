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

export async function runAnalogs(
  name: NameCard,
  opts: { regime?: Regime; communityId?: string; communityMembers?: string[] } = {},
): Promise<AnalogsPillar> {
  try {
    const packet = await chartLibraryState(name.native);
    if (packet.status !== "ok" || !packet.data?.analogs_of_new_state) {
      throw new Error("Chart Library returned a non-ok packet");
    }
    const analogs = packet.data.analogs_of_new_state;
    const members = new Set(opts.communityMembers ?? []);
    // Regime + community conditioning: analogs whose ticker sits in the
    // target's precomputed RMT community rank first at equal shape distance.
    // (Per-analog-date historical regime is not observable, so the regime
    // label frames the memo and the analog search rather than filtering it.)
    // Prefer same-ticker matches, then highly similar (related ticker or RMT community), then distance
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

    const uniqueTickers = [...new Set([name.native, ...poolRaw.map((x) => x[0])])];
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
    const byTicker = Object.fromEntries(charts);
    const selfBars = byTicker[name.native] ?? [];

    const sameTickerAnalogs = findSameTickerAnalogs(selfBars, name.native);

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

    // Only show examples that have clear, complete forward outcomes
    const validPool = poolComputed.filter(
      (a) =>
        (typeof a.ret5d === "number" && !Number.isNaN(a.ret5d)) ||
        (typeof a.ret1d === "number" && !Number.isNaN(a.ret1d)) ||
        (typeof a.ret10d === "number" && !Number.isNaN(a.ret10d)),
    );

    // Prefer same-ticker or highly similar examples with complete forward returns
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
    const conditioned = members.size > 0 && closest.some((c) => members.has(c.ticker));

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

    const ranges = Object.entries(analogs.excess_followed ?? {}).map(([horizon, row]) => ({
      horizon,
      n: row.n,
      p10: row.p10,
      p50: row.p50,
      p90: row.p90,
      pUp: row.p_up,
    }));

    const caveats = [
      packet.meta?.note ??
        "Chart Library bands describe historical excess versus a liquid-stock baseline. They are a range, not a side.",
      `Sample: ${analogs.n} analogs across ${analogs.symbols} names and ${analogs.sessions} sessions.`,
      "Follow-through percentages on the five closest names are cash-session closes from Yahoo, not rToken marks.",
      opts.regime
        ? `Current regime label “${opts.regime}” frames this memo${opts.communityId ? `; analogs prefer matches in RMT community ${opts.communityId}` : ""}${conditioned ? " and at least one listed analog shares that community" : " but no listed analog shares that community, so ranking fell back to pure chart shape"}.`
        : "No regime label was available; analogs are pure chart-shape matches.",
    ];

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
      caveats,
      sources: [
        { label: "Chart Library state-packet", url: `https://chartlibrary.io/api/v1/state-packet?symbol=${name.native}` },
        { label: "Yahoo Finance forward returns on closest analogs" },
      ],
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Analog fetch failed",
      closest: [],
      ranges: [],
      overlay: [],
      sample: { n: 0, symbols: 0, sessions: 0 },
      caveats: ["Pattern matching degraded. Do not invent analogs."],
      sources: [{ label: "Chart Library" }],
    };
  }
}
