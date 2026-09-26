import { fmtPct } from "./http";
import { guardBriefing } from "./language-guard";
import { STYLES } from "./style-profiles";
import type { Briefing, PillarBundle, Regime, TradingStyle } from "./types";
import type { NameCard } from "./universe";

export function collectSources(pillars: PillarBundle) {
  return [
    ...(pillars?.fundamentals?.sources ?? []),
    ...(pillars?.technicals?.sources ?? []),
    ...(pillars?.news?.sources ?? []),
    ...(pillars?.analogs?.sources ?? []),
    ...(pillars?.marketStructure?.sources ?? []),
  ];
}

// Pillar sentences are authored as complete sentences and so already end in
// terminal punctuation. Interpolating one into a template that adds its own
// punctuation produced "not NAV.." in the rendered memo, so strip any trailing
// run of terminal marks (and whitespace) before an outer template supplies its
// own. The class covers every mark a pillar sentence may legitimately end on,
// not just "." — otherwise a sentence ending in "!" or "?" reintroduces the
// same double-punctuation defect.
function inline(sentence: string): string {
  return sentence.replace(/[.!?:;…]+[\s]*$/, "");
}

export function deterministicBriefing(opts: {
  style: TradingStyle;
  question: string;
  name: NameCard;
  regime: Regime;
  pillars: PillarBundle;
  flags: Briefing["flags"];
}): Briefing {
  const { pillars, name, style, regime, flags } = opts;
  const profile = STYLES[style] ?? STYLES.swing;
  const asksAboutOvernight = /\b(overnight|7\s*[Ã—x]\s*24|cash|basis|bitget|session|intraday|open|close|gap)\b/i.test(opts.question);
  const isDayOrOvernight = style === "day" || asksAboutOvernight;
  const analogHorizon = profile.analogHorizon;
  const ranges = pillars?.analogs?.ranges ?? [];
  const band = ranges.find((r) => r.horizon === analogHorizon) ?? ranges[0];
  const evidence = [];

  if (pillars?.fundamentals?.ok && pillars.fundamentals.eps) {
    evidence.push({
      claim: `${pillars.fundamentals.company} last reported diluted EPS ${pillars.fundamentals.eps.value} for the period ending ${pillars.fundamentals.eps.periodEnd} (${pillars.fundamentals.eps.form} filed ${pillars.fundamentals.eps.filed}).`,
      source: "SEC EDGAR companyconcept",
      pillar: "fundamentals" as const,
    });
  }
  if (pillars?.fundamentals?.latestFilings?.[0]) {
    const f = pillars.fundamentals.latestFilings[0];
    evidence.push({
      claim: `Most recent filing on the EDGAR tape: ${f.form} dated ${f.filed}.`,
      source: "SEC EDGAR submissions",
      pillar: "fundamentals" as const,
    });
  }
  if (pillars?.technicals?.ok) {
    const lastPrice = pillars.technicals.native?.last !== undefined ? pillars.technicals.native.last.toFixed(2) : "0.00";
    const changePct = pillars.technicals.native?.changePct !== undefined ? fmtPct(pillars.technicals.native.changePct) : "0.00%";
    evidence.push({
      claim: `Native ${name.native} last ${lastPrice} (${changePct}). ${pillars.technicals.trend ?? ""}`,
      source: "Yahoo Finance chart",
      pillar: "technicals" as const,
    });
    if (pillars.technicals.rTokenGap) {
      evidence.push({
        claim: pillars.technicals.rTokenGap,
        source: pillars.technicals.rToken ? "Bitget public ticker" : "Bitget tape unavailable",
        pillar: "technicals" as const,
      });
    }
  }
  if (pillars?.news?.headlines?.[0]) {
    evidence.push({
      claim: `Lead headline: â€œ${pillars.news.headlines[0].title}â€ (${pillars.news.headlines[0].publisher}).`,
      source: pillars.news.headlines[0].publisher,
      pillar: "news" as const,
    });
  }
  if (pillars?.news?.social?.x?.[0]) {
    const top = pillars.news.social.x[0];
    evidence.push({
      claim: `Top X post (@${top.author}, ${top.lean}): â€œ${top.text.slice(0, 160)}â€. Aggregate X lean across ${pillars.news.social.x.length} posts is engagement-weighted.`,
      source: "X discourse",
      pillar: "news" as const,
    });
  }
  if (pillars?.news?.caveats?.length) {
    evidence.push({
      claim: `Social coverage caveats: ${pillars.news.caveats.join(" ")}`,
      source: "Sentiment pillar",
      pillar: "news" as const,
    });
  }
  if (pillars?.marketStructure?.ok) {
    const ms = pillars.marketStructure;
    const cohortPeers = (ms.communityMembers ?? []).filter((m) => m !== name.native);
    const residualPeers = (ms.cleanedCorrelations ?? []).slice(0, 5);
    const cohortClause = cohortPeers.length
      ? `sits in RMT community ${ms.communityId} alongside ${cohortPeers.slice(0, 5).join(", ")}`
      : `has no distinct peer cluster at this cut; its strongest market-mode-removed partners are ${
          residualPeers.map((p) => `${p.peer} (${p.residual.toFixed(2)})`).join(", ") || "none above the cut"
        }`;
    evidence.push({
      claim: `Market structure: ${name.native} ${cohortClause}; market-mode share ${ms.marketModeStrength !== undefined ? (ms.marketModeStrength * 100).toFixed(1) + "%" : "n/a"}; â‰ˆ${ms.infoBeyondNoisePct?.toFixed(1)}% of eigenstructure beyond noise.${ms.stale ? ` Snapshot from ${ms.computedAt ?? "an unknown time"} is stale and is historical context only.` : ""}`,
      source: "RMT precompute snapshot",
      pillar: "marketStructure" as const,
    });
  } else if (pillars?.marketStructure) {
    evidence.push({
      claim: `Market-structure lookup degraded: ${pillars.marketStructure.error ?? "no snapshot"}. Community-conditioned analogs fall back to pure chart shape.`,
      source: "RMT precompute snapshot",
      pillar: "marketStructure" as const,
    });
  }
  if (flags) {
    evidence.push({
      claim: `Flags (separate facts, not a score): catalyst density ${flags.catalystDensity}; regime alignment ${flags.regimeAlignment}; community stability ${flags.communityStability}; analog base n=${flags.analogQuality.n} (${flags.analogQuality.clustered ? "clustered" : "scattered"} outcomes)${flags.cleanedCorrRankPct !== undefined ? `; cleaned-correlation rank p${flags.cleanedCorrRankPct} in community` : ""}.`,
      source: "Structure & Fundamentals flags",
      pillar: "marketStructure" as const,
    });
    for (const line of flags.balanceSheet.slice(0, 2)) {
      evidence.push({ claim: line, source: "SEC EDGAR companyconcept", pillar: "fundamentals" as const });
    }
  }
  if (pillars?.analogs?.ok && band) {
    evidence.push({
      claim: `Chart Library ${analogHorizon} analog excess vs a liquid baseline: p10 ${fmtPct(band.p10)}, median ${fmtPct(band.p50)}, p90 ${fmtPct(band.p90)} (n=${band.n}). State: ${pillars.analogs.state ?? "n/a"} on ${pillars.analogs.session ?? "n/a"}. Regime frame: ${regime}.`,
      source: "Chart Library state-packet",
      pillar: "analogs" as const,
    });
  }

  const tension = [];
  const rsi = pillars?.technicals?.indicators?.rsi14;
  const newsLean = pillars?.news?.headlines?.[0]?.lean;
  const xLean = pillars?.news?.social?.x?.[0]?.lean;

  if (isDayOrOvernight || pillars?.technicals?.rTokenGap) {
    tension.push({
      left: "Bitget trades 24/7 on crypto exchange rails.",
      right: pillars?.technicals?.rTokenGap
        ? `US cash market is closed overnight, establishing venue basis: ${inline(pillars.technicals.rTokenGap)}.`
        : "US cash equity market is closed overnight, operating only during standard daytime hours.",
      whyItMatters:
        "Overnight rToken quotes reflect off-hours crypto venue liquidity; basis spreads frequently mean-revert or gap sharply upon NY cash market open.",
    });
  }

  if (band) {
    const dir = pillars?.technicals?.native?.changePct !== undefined && pillars.technicals.native.changePct >= 0 ? "upward" : "downward";
    tension.push({
      left: `Native cash tape demonstrates recent ${dir} price movement.`,
      right: `Historical analog follow-through produced positive returns in only ${Math.round(band.pUp * band.n)} of ${band.n} matching instances.`,
      whyItMatters:
        "Recent price action and historical analog follow-through are separate measurements; past patterns produced a split distribution rather than a uniform move.",
    });
  }

  if (band && (band.p90 - band.p10) >= 3) {
    tension.push({
      left: `Spot equity trades near ${pillars?.technicals?.native?.last !== undefined ? `$${pillars.technicals.native.last.toFixed(2)}` : "its current print"}.`,
      right: `Historical analog realizations over ${analogHorizon} span a wide distribution: ${fmtPct(band.p10)} (p10) to ${fmtPct(band.p90)} (p90).`,
      whyItMatters:
        `Historical quantile dispersion (${fmtPct(band.p10)} to ${fmtPct(band.p90)}) confirms two-sided tail risk; past realizations were not clustered unidirectionally.`,
    });
  }

  if (rsi !== undefined && rsi >= 60 && pillars?.news?.headlines?.some((h) => h.lean === "cautious")) {
    tension.push({
      left: `RSI-14 indicates elevated short-term momentum at ${rsi.toFixed(1)}.`,
      right: "Verified headline flow reflects cautious or risk-sensitive editorial coverage.",
      whyItMatters:
        "Price momentum and cautious headline flow diverge; treat the clash as analytical friction rather than directional signal.",
    });
  }

  if (newsLean && xLean && newsLean !== "mixed" && xLean !== "mixed" && newsLean !== xLean) {
    const describeLean = (l: string) => (l === "constructive" ? "positive" : l === "cautious" ? "risk-conscious" : l);
    tension.push({
      left: `Verified news headlines show ${describeLean(newsLean)} editorial coverage.`,
      right: `Social discourse feeds show ${describeLean(xLean)} engagement-weighted sentiment.`,
      whyItMatters:
        "Financial media editorial coverage and social participant sentiment track distinct data streams and market participant cohorts.",
    });
  }

  if (pillars?.fundamentals?.eps) {
    tension.push({
      left: `SEC filings confirm reported quarterly profitability (diluted EPS ${pillars.fundamentals.eps.value}).`,
      right: "Continuous secondary market prices fluctuate independently on order flow and macro sentiment.",
      whyItMatters:
        "SEC-filed financial statements record historical accounting results, while market pricing continuously discounts forward macro and liquidity expectations.",
    });
  }

  if (!tension.length) {
    tension.push({
      left: "Retrieved pillar streams demonstrate no obvious direct contradiction.",
      right: "Absence of active divergence does not eliminate tail risk or structural vulnerability.",
      whyItMatters: "Clear invalidation boundaries remain mandatory regardless of multi-stream agreement.",
    });
  }

  const analogRows = (pillars?.analogs?.closest ?? []).slice(0, 5).map((a) => ({
    ticker: a.ticker,
    date: a.date,
    similarity: `distance ${a.distance.toFixed(3)} (lower is closer)`,
    followed: `next session ${fmtPct(a.ret1d)}; 5 sessions ${fmtPct(a.ret5d)}; 10 sessions ${fmtPct(a.ret10d)} (cash close-to-close)`,
  }));

  const whatWeDidText = (!band || band.n === 0)
    ? `Cross-examined live tape and 24/7 Bitget basis for ${name.native} (${name.rToken}) against SEC filings, market structure, and headline flow; 10-year historical analog feed returned no qualifying matches.`
    : style === "day"
    ? `Cross-examined 1-session price action for ${name.native} (${name.rToken}) against 10-year analogs, measuring the 24/7 Bitget basis against the NY cash close alongside SEC filings and recent headlines.`
    : style === "position"
    ? `Cross-examined multi-week position trajectory for ${name.native} (${name.rToken}) against 10-year analog distributions, SEC EDGAR filing trends, and RMT market structure alongside 24/7 Bitget tape context.`
    : style === "event"
    ? `Cross-examined catalyst and event-window pricing for ${name.native} (${name.rToken}) against historical reaction bands, SEC filing disclosures, and 24/7 Bitget tape basis.`
    : asksAboutOvernight
    ? `Evaluated ${name.native} (${name.rToken}) overnight tape dynamics, measuring the 24/7 Bitget pricing basis and liquidity spread against the NY cash close alongside 10-year historical analog distributions.`
    : `Cross-examined 5-session swing structure for ${name.native} (${name.rToken}) against 10-year analog distributions, measuring the 24/7 Bitget basis against the NY cash close alongside corporate fundamentals and discourse.`;

  const otherChecked = isDayOrOvernight
    ? [
        pillars?.technicals?.rTokenGap
          ? `Tape & Venue Basis: 24/7 Bitget pricing vs NY cash close: ${inline(pillars.technicals.rTokenGap)}.`
          : "Tape & Venue Basis: Bitget trades 24/7 on crypto rails, while the primary US equity market closes overnight.",
        "Liquidity & Spread: Off-hours rToken trading operates with thinner order depth, exposing positions to opening basis gap risk.",
        pillars?.fundamentals?.eps
          ? `SEC EDGAR Filing Tape: Diluted EPS ${pillars.fundamentals.eps.value} for period ending ${pillars.fundamentals.eps.periodEnd} (${pillars.fundamentals.eps.form} filed ${pillars.fundamentals.eps.filed}).`
          : pillars?.fundamentals?.latestFilings?.[0]
          ? `SEC EDGAR Filing Tape: Latest disclosure is ${pillars.fundamentals.latestFilings[0].form} dated ${pillars.fundamentals.latestFilings[0].filed}.`
          : "SEC Filing Tape: Corporate disclosure feed returned limited reporting in this run.",
      ]
    : [
        pillars?.fundamentals?.eps
          ? `SEC EDGAR Filing Tape: Diluted EPS ${pillars.fundamentals.eps.value} for period ending ${pillars.fundamentals.eps.periodEnd} (${pillars.fundamentals.eps.form} filed ${pillars.fundamentals.eps.filed}).`
          : pillars?.fundamentals?.latestFilings?.[0]
          ? `SEC EDGAR Filing Tape: Latest disclosure is ${pillars.fundamentals.latestFilings[0].form} dated ${pillars.fundamentals.latestFilings[0].filed}.`
          : "SEC Filing Tape: Corporate disclosure feed returned limited reporting in this run.",
        pillars?.technicals?.rTokenGap
          ? `Tape & Venue Basis: 24/7 Bitget pricing vs NY cash close: ${inline(pillars.technicals.rTokenGap)}.`
          : "Tape & Venue Basis: Bitget 24/7 trading operates continuously across closed cash market sessions.",
        pillars?.news?.headlines?.[0]
          ? `Lead Editorial Headline: â€œ${pillars.news.headlines[0].title}â€ (${pillars.news.headlines[0].publisher}).`
          : "News & Macro: Live headline stream verified where coverage was active.",
      ];

  const takeaways = isDayOrOvernight
    ? [
        "Bitget trades 24/7; overnight rToken prices establish a venue basis against the NY cash close that frequently adjusts upon cash equity open.",
        band && band.n > 0
          ? `Past 10-year analogs (n=${band.n}) show positive follow-through in ${Math.round(band.pUp * band.n)} of ${band.n} sessions, with quantile dispersion spanning ${fmtPct(band.p10)} (p10) to ${fmtPct(band.p90)} (p90).`
          : "Historical chart comparison was not available in this run; focus on verified technical support/resistance levels and venue order flow.",
        "Trading during offline cash sessions exposes capital to venue liquidity vacuums and overnight gap risk.",
      ]
    : [
        band && band.n > 0
          ? `Past 10-year analogs (n=${band.n}) show positive follow-through in ${Math.round(band.pUp * band.n)} of ${band.n} sessions, with quantile dispersion spanning ${fmtPct(band.p10)} (p10) to ${fmtPct(band.p90)} (p90).`
          : "Historical chart comparison was not available in this run; focus on verified technical support/resistance levels and venue order flow.",
        pillars?.technicals?.rTokenGap
          ? `24/7 Bitget price vs NY cash close: ${inline(pillars.technicals.rTokenGap)}.`
          : "Bitget 24/7 trading functions continuously independent of daytime cash session schedules.",
        "Historical analog distributions indicate realization dispersion, not deterministic forward paths.",
      ];

  const reflectionQuestions = isDayOrOvernight
    ? [
        "If the Bitget overnight basis dislocates sharply while US cash markets are closed, does your rule set mandate exiting on crypto rails or waiting for New York open price discovery?",
        band
          ? `If price breaches the historical ${fmtPct(band.p10)} lower quantile boundary, what is your predetermined invalidation trigger?`
          : "What precise price print invalidates the premise and forces immediate risk liquidation?",
        "Are you equipped to manage rToken execution during off-hours when underlying equity liquidity is offline?",
      ]
    : [
        band
          ? `If post-entry price realization breaches the historical quantile boundaries (${fmtPct(band.p10)} to ${fmtPct(band.p90)}), what is your mechanical invalidation protocol?`
          : "What specific price level invalidates the thesis and triggers complete exposure removal?",
        "What specific catalyst drift (e.g. surprise 8-K disclosure, regulatory filing, or macro volatility spike) would invalidate the current setup?",
        "Is your conviction grounded in cross-examined evidence across the 4 witnesses, or unearned directional bias?",
      ];

  const unverified: string[] = [];
  if (!pillars?.fundamentals?.ok) {
    unverified.push(
      pillars?.fundamentals?.error || "Fundamentals partial â€” no SEC CIK available for this rToken.",
    );
  }
  if (!pillars?.technicals?.ok) {
    unverified.push(
      pillars?.technicals?.error || "Technicals & Tape partial â€” Bitget venue order flow or cash session spread unavailable.",
    );
  }
  if (!pillars?.news?.ok) {
    unverified.push(
      pillars?.news?.error || "News & Macro partial â€” multi-channel news flow was incomplete.",
    );
  } else if (pillars?.news?.caveats?.length) {
    pillars.news.caveats.forEach((c) => unverified.push(`News & Macro note â€” ${c}`));
  }
  const analogSampleSize = band?.n ?? 0;
  if (!pillars?.analogs?.ok || analogSampleSize === 0) {
    unverified.push("Historical analog matches unavailable â€” 0 past cases found.");
  } else if (analogSampleSize < 30) {
    unverified.push(`Historical analog sample is limited (${analogSampleSize} cases).`);
  }

  const result: Briefing = {
    title: `${name.rToken} â€” ${profile.label} stress test`,
    whatWeDid: whatWeDidText,
    historicalStressTest: {
      summary: band && band.n > 0
        ? `Identified ${band.n} matching historical setups across the 10-year library. Analog follow-through exhibits quantile dispersion between ${fmtPct(band.p10)} and ${fmtPct(band.p90)}, indicating significant variance in post-pattern realization.`
        : "Historical comparison was not available in this run because chart pattern feeds returned insufficient matching sessions. Decisions should rely on verified technical support/resistance and fundamental catalysts rather than ungrounded analogs.",
      sampleSize: band?.n ?? 0,
      results: ([
        { key: "1d", period: "Next 1 trading day" as const },
        { key: "5d", period: "Next 5 trading days" as const },
        { key: "10d", period: "Next 10 trading days" as const },
      ])
        .map(({ key, period }, idx) => {
          const r = ranges.find((item) => item.horizon === key) ?? ranges[idx];
          if (!r || r.n === 0) return null;
          return {
            period,
            wentUp: `Went up ${Math.round(r.pUp * r.n)} times out of ${r.n}`,
            typicalMove: `Typical move: usually between ${fmtPct(r.p10)} and ${fmtPct(r.p90)}`,
            median: fmtPct(r.p50),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
      examples: [...(pillars?.analogs?.closest ?? [])]
        .sort((a, b) => {
          const aSame = a.sameName || a.ticker === name.native ? 0 : 1;
          const bSame = b.sameName || b.ticker === name.native ? 0 : 1;
          return aSame - bSame;
        })
        .map((a) => {
          const outcome = formatAnalogOutcome(a, analogHorizon);
          if (!outcome) return null;
          const isSame = a.sameName || a.ticker === name.native;
          const whenLabel = isSame
            ? `${a.ticker} (${a.date})`
            : `${a.ticker} (${a.date}, cross-ticker)`;
          return {
            when: whenLabel,
            whatHappened: outcome,
          };
        })
        .filter((ex): ex is { when: string; whatHappened: string } => ex !== null && !/\b(n\/?a|null|undefined)\b/i.test(ex.whatHappened))
        .slice(0, 3),
      importantNote: "Historical results are past occurrences only, not predictions.",
    },
    otherThingsWeChecked: otherChecked,
    whereThingsDoNotAgree: tension.slice(0, 3).map((item) => ({
      conflict: `${item.left} ${item.right}`.trim(),
      whyItMatters: item.whyItMatters,
    })),
    simpleTakeAways: takeaways,
    questionsOnlyYouCanAnswer: reflectionQuestions,
    unverified,
    styleNote: `${profile.framing} Target horizon: ${profile.horizon} Regime frame: ${regime}.`,
    model: "deterministic-synthesizer",
    isFallback: true,
    regime,
    flags: flags ?? undefined,
    evidence: evidence.slice(0, 12),
    tension,
    historicalAnalog: {
      setup: pillars?.analogs?.state
        ? `Current Chart Library state â€œ${pillars.analogs.state}â€ on ${pillars.analogs.session}. Previous: â€œ${pillars.analogs.prevState}â€. Regime frame: ${regime}.`
        : "Historical pattern comparison was not available in this run; live technical and fundamental levels are prioritized.",
      analogs: (pillars?.analogs?.closest ?? []).slice(0, 5).map((a) => {
        const returns = [
          typeof a.ret1d === "number" && !Number.isNaN(a.ret1d) ? `next day ${fmtPct(a.ret1d)}` : null,
          typeof a.ret5d === "number" && !Number.isNaN(a.ret5d) ? `5 days ${fmtPct(a.ret5d)}` : null,
          typeof a.ret10d === "number" && !Number.isNaN(a.ret10d) ? `10 days ${fmtPct(a.ret10d)}` : null,
        ].filter(Boolean);
        return {
          ticker: a.ticker,
          date: a.date,
          similarity: a.sameName
            ? "Same stock with a similar chart shape"
            : a.ticker.startsWith(name.native) || name.native.startsWith(a.ticker)
            ? "Related asset with a similar chart shape"
            : `Different stock with a similar chart shape (distance: ${a.distance.toFixed(3)})`,
          followed: returns.length ? `${returns.join("; ")} (cash close-to-close)` : "Follow-through data pending",
        };
      }),
      baseRates: ranges.map((r) => ({
        horizon: r.horizon,
        range: `p10 ${fmtPct(r.p10)} Â· median ${fmtPct(r.p50)} Â· p90 ${fmtPct(r.p90)} Â· share of positive excess ${Math.round(r.pUp * 100)}% of the sample`,
        n: r.n,
        note: "Excess versus a date-matched liquid-stock baseline, not raw return, and not a forecast.",
      })),
      caveat:
        pillars?.analogs?.caveats?.join(" ") ||
        "Analogs are a historical sample. They do not assign a side to the current name.",
    },
    considerations: {
      forStyle: [
        `This memo is framed for a ${profile.label} horizon (${profile.horizon}).`,
        analogHorizon === "1d"
          ? "Single-session horizon prioritizes 24/7 rToken basis and overnight gap risk into the NY cash open."
          : analogHorizon === "10d"
            ? "Multi-week horizon prioritizes SEC filing trajectory and RMT community stability over short-term session noise."
            : "Swing horizon prioritizes 5-session analog dispersion and tension between tape momentum and news flow.",
        pillars?.technicals?.rTokenGap ?? "rToken venue print was not on the tape this run.",
        pillars?.marketStructure?.ok
          ? `Community ${pillars.marketStructure.communityId} membership indicates peer moves inside that group carry higher explanatory power than broad index beta.`
          : "No community membership resolved this run; peer comparison requires manual tracking.",
      ],
      invalidation: [
        band
          ? `Realization outside the historical distribution for ${analogHorizon} (${fmtPct(band.p10)} to ${fmtPct(band.p90)}) represents an outlier regime break.`
          : "Without analog bands, invalidation must be anchored to explicit structural support/resistance levels â€” the desk does not assume a trade side.",
        pillars?.fundamentals?.catalysts?.[0]
          ? `An unscheduled 8-K or regulatory filing that alters the documented disclosure tape (${pillars.fundamentals.catalysts[0]}) reopens fundamental assumptions.`
          : "Monitor upcoming SEC filings; the recorded EDGAR state represents the last verified corporate baseline.",
      ],
      questions: [
        "Is the analog quantile dispersion wide enough that standing aside represents the disciplined institutional choice?",
        "If cash equity is offline while rToken trades 24/7, which venue's pricing governs your execution rules?",
        "Which witness stream, if it inverted tomorrow, would force immediate thesis invalidation?",
      ],
    },
    sources: collectSources(pillars),
  };
  return guardBriefing(result, (rewriteCount) => {
    if (rewriteCount > 0) {
      console.log(`[DeterministicBriefing] Language guard actively sanitized briefing text.`);
    }
  });
}

export function formatAnalogOutcome(
  a: { ticker: string; ret1d: number | null; ret5d: number | null; ret10d?: number | null },
  targetHorizon: "1d" | "5d" | "10d" = "5d"
): string | null {
  const format1d = () => {
    if (typeof a.ret1d === "number" && !Number.isNaN(a.ret1d)) {
      const abs1d = Math.abs(a.ret1d).toFixed(1);
      const verb = a.ret1d > 0.05 ? "rose" : a.ret1d < -0.05 ? "fell" : "stayed roughly flat";
      const amount = a.ret1d > 0.05 || a.ret1d < -0.05 ? `about ${abs1d}%` : `(${a.ret1d >= 0 ? "+" : ""}${a.ret1d.toFixed(1)}%)`;
      return `${verb} ${amount} the next day`;
    }
    return null;
  };

  const format5d = () => {
    if (typeof a.ret5d === "number" && !Number.isNaN(a.ret5d)) {
      const abs5d = Math.abs(a.ret5d).toFixed(1);
      const verb = a.ret5d > 0.05 ? "rose" : a.ret5d < -0.05 ? "fell" : "stayed roughly flat";
      const amount = a.ret5d > 0.05 || a.ret5d < -0.05 ? `about ${abs5d}%` : `(${a.ret5d >= 0 ? "+" : ""}${a.ret5d.toFixed(1)}%)`;
      return `${verb} ${amount} over the next 5 days`;
    }
    return null;
  };

  const format10d = () => {
    if (typeof a.ret10d === "number" && !Number.isNaN(a.ret10d)) {
      const abs10d = Math.abs(a.ret10d).toFixed(1);
      const verb = a.ret10d > 0.05 ? "rose" : a.ret10d < -0.05 ? "fell" : "stayed roughly flat";
      const amount = a.ret10d > 0.05 || a.ret10d < -0.05 ? `about ${abs10d}%` : `(${a.ret10d >= 0 ? "+" : ""}${a.ret10d.toFixed(1)}%)`;
      return `${verb} ${amount} over the next 10 days`;
    }
    return null;
  };

  if (targetHorizon === "1d") {
    return format1d() ?? format5d() ?? format10d();
  }
  if (targetHorizon === "10d") {
    return format10d() ?? format5d() ?? format1d();
  }
  return format5d() ?? format1d() ?? format10d();
}
