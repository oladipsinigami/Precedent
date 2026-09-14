import { fmtPct } from "./http";
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
  const asksAboutOvernight = /\b(overnight|7\s*[×x]\s*24|cash|basis|bitget)\b/i.test(opts.question);
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
      claim: `Lead headline: “${pillars.news.headlines[0].title}” (${pillars.news.headlines[0].publisher}).`,
      source: pillars.news.headlines[0].publisher,
      pillar: "news" as const,
    });
  }
  if (pillars?.news?.social?.x?.[0]) {
    const top = pillars.news.social.x[0];
    evidence.push({
      claim: `Top X post (@${top.author}, ${top.lean}): “${top.text.slice(0, 160)}”. Aggregate X lean across ${pillars.news.social.x.length} posts is engagement-weighted.`,
      source: "X discourse",
      pillar: "news" as const,
    });
  }
  if (pillars?.news?.social?.youtube?.[0]) {
    const v = pillars.news.social.youtube[0];
    evidence.push({
      claim: `Top YouTube item: “${v.title}” (${v.channelTitle}, ${v.overallLean}).`,
      source: "YouTube discourse",
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
    evidence.push({
      claim: `Market structure: ${name.native} sits in RMT community ${ms.communityId} alongside ${(ms.communityMembers ?? []).filter((m) => m !== name.native).slice(0, 5).join(", ") || "no listed peers"}; market-mode share ${ms.marketModeStrength !== undefined ? (ms.marketModeStrength * 100).toFixed(1) + "%" : "n/a"}; ≈${ms.infoBeyondNoisePct?.toFixed(1)}% of eigenstructure beyond noise.`,
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

  if (asksAboutOvernight || pillars?.technicals?.rTokenGap) {
    tension.push({
      left: "Bitget trades 24 hours a day on crypto exchange rails.",
      right: pillars?.technicals?.rTokenGap
        ? `The regular US stock market is closed overnight, leaving a price difference: ${pillars.technicals.rTokenGap}.`
        : "The regular US stock market is closed overnight and only trades during daytime hours.",
      whyItMatters:
        "Overnight prices trade on lighter volume. When the regular New York market opens, prices often snap back quickly, which creates basis risk.",
    });
  }

  if (band) {
    const dir = pillars?.technicals?.native?.changePct !== undefined && pillars.technicals.native.changePct >= 0 ? "upward" : "downward";
    tension.push({
      left: `Recent price action has trended ${dir} in native trading.`,
      right: `Similar past chart patterns only went up ${Math.round(band.pUp * band.n)} out of ${band.n} times.`,
      whyItMatters:
        "Recent momentum often tempts traders to expect the same direction to continue, but historical outcomes were split rather than one-sided.",
    });
  }

  if (band && (band.p90 - band.p10) >= 3) {
    tension.push({
      left: `The stock is currently trading around ${pillars?.technicals?.native?.last !== undefined ? `$${pillars.technicals.native.last.toFixed(2)}` : "its current price"}.`,
      right: `In past similar charts, outcomes over ${analogHorizon} ranged from ${fmtPct(band.p10)} on the downside to ${fmtPct(band.p90)} on the upside.`,
      whyItMatters:
        "The historical range shows that both positive and negative moves occurred from this pattern, so a plan must account for both.",
    });
  }

  if (rsi !== undefined && rsi >= 60 && pillars?.news?.headlines?.some((h) => h.lean === "cautious")) {
    tension.push({
      left: `The short-term strength indicator (RSI) is high at ${rsi.toFixed(1)}.`,
      right: "Recent news headlines include cautious language.",
      whyItMatters:
        "The price and recent news do not tell the same story, so a beginner should note the disagreement rather than treat either one as a forecast.",
    });
  }

  if (newsLean && xLean && newsLean !== "mixed" && xLean !== "mixed" && newsLean !== xLean) {
    tension.push({
      left: `Official news headlines lean ${newsLean}.`,
      right: `Social media discussions lean ${xLean}.`,
      whyItMatters:
        "News reporters and social media traders focus on different factors, which can create erratic short-term swings.",
    });
  }

  if (pillars?.fundamentals?.eps) {
    tension.push({
      left: `Company reports show quarterly performance (latest diluted EPS ${pillars.fundamentals.eps.value}).`,
      right: "Daily market prices fluctuate continuously based on short-term trading.",
      whyItMatters:
        "Solid company earnings do not prevent short-term price drops, and short-term price swings do not change quarterly earnings.",
    });
  }

  if (!tension.length) {
    tension.push({
      left: "Retrieved facts do not show an obvious open contradiction.",
      right: "An absence of contradiction is not a guarantee of safety.",
      whyItMatters: "A beginner still needs a clear invalidation level before opening any position.",
    });
  }

  const analogRows = (pillars?.analogs?.closest ?? []).slice(0, 5).map((a) => ({
    ticker: a.ticker,
    date: a.date,
    similarity: `distance ${a.distance.toFixed(3)} (lower is closer)`,
    followed: `next session ${fmtPct(a.ret1d)}; 5 sessions ${fmtPct(a.ret5d)}; 10 sessions ${fmtPct(a.ret10d)} (cash close-to-close)`,
  }));

  const whatWeDidText = asksAboutOvernight
    ? `We compared the current chart with past charts that had a similar shape. Because you asked about overnight trading, we specifically checked the 24-hour Bitget token price against the regular New York market close. We also checked company earnings and recent news.`
    : `We compared the current chart with past charts that had a similar shape. We also checked company earnings, price trends, Bitget trading, and recent news.`;

  const otherChecked = asksAboutOvernight
    ? [
        pillars?.technicals?.rTokenGap
          ? `24-hour Bitget price vs regular stock close: ${pillars.technicals.rTokenGap}.`
          : "Bitget trades 24 hours a day, while the regular US stock market closes overnight.",
        "Overnight basis risk: Bitget prices can move on lighter volume overnight, which may snap back when the regular New York session opens.",
        pillars?.fundamentals?.eps
          ? `Company earnings: diluted EPS was ${pillars.fundamentals.eps.value} for the period ending ${pillars.fundamentals.eps.periodEnd}.`
          : "Company earnings data was limited in this run.",
      ]
    : [
        pillars?.fundamentals?.eps
          ? `Company earnings: diluted EPS was ${pillars.fundamentals.eps.value} for the period ending ${pillars.fundamentals.eps.periodEnd}.`
          : "Company earnings data was limited in this run.",
        pillars?.technicals?.rTokenGap
          ? `24-hour Bitget price vs regular stock: ${pillars.technicals.rTokenGap}.`
          : "Bitget 24-hour trading operates independently of daytime market hours.",
        pillars?.news?.headlines?.[0]
          ? `Latest headline: “${pillars.news.headlines[0].title}”.`
          : "Recent news coverage was included where available.",
      ];

  const takeaways = asksAboutOvernight
    ? [
        "Bitget trades 7×24, so overnight prices can differ from regular market closing prices until New York trading opens.",
        band
          ? `Past similar charts went up ${Math.round(band.pUp * band.n)} out of ${band.n} times, with outcomes spread between ${fmtPct(band.p10)} and ${fmtPct(band.p90)}.`
          : "Historical comparisons showed mixed results across similar charts.",
        "Trading during closed cash sessions carries basis risk if liquidity is thin.",
      ]
    : [
        band
          ? `Past similar charts went up ${Math.round(band.pUp * band.n)} out of ${band.n} times, with outcomes spread between ${fmtPct(band.p10)} and ${fmtPct(band.p90)}.`
          : "Historical comparisons showed mixed results across similar charts.",
        pillars?.technicals?.rTokenGap
          ? `24-hour Bitget price vs regular stock: ${pillars.technicals.rTokenGap}.`
          : "Bitget 24-hour trading operates independently of daytime market hours.",
        "Historical patterns show possibilities, but never predict what will happen next.",
      ];

  const reflectionQuestions = asksAboutOvernight
    ? [
        "If the 24-hour Bitget price moves sharply overnight while regular US stock markets are closed, will you exit immediately or wait for the New York open?",
        band
          ? `If the price drops below the typical historical range of ${fmtPct(band.p10)}, what is your exit plan?`
          : "What specific price drop would make you step aside and close the trade?",
        "Are you comfortable holding an rToken position when daytime stock liquidity is offline?",
      ]
    : [
        band
          ? `If the price moves outside the typical historical range (${fmtPct(band.p10)} to ${fmtPct(band.p90)}), will you stick to your plan?`
          : "If the price moves against you immediately, where will you step aside?",
        "What specific news or price drop would prove your plan wrong?",
        "Are you making this decision based on verified facts, or fear of missing out?",
      ];

  return {
    title: `${name.rToken} — ${profile.label} stress test`,
    whatWeDid: whatWeDidText,
    historicalStressTest: {
      summary: band
        ? `We found ${band.n} past cases with a similar chart pattern. The results show a wide range of outcomes. History helps provide context, but it cannot tell us what will happen this time.`
        : "The historical comparison was not available in this run, so there is not enough past data to summarize.",
      sampleSize: band?.n ?? 0,
      results: ranges.slice(0, 3).map((r) => ({
        period: r.horizon === "1d" ? ("Next day" as const) : r.horizon === "5d" ? ("Next 5 trading days" as const) : ("Next 10 trading days" as const),
        wentUp: `went up ${Math.round(r.pUp * r.n)} times out of ${r.n}`,
        typicalMove: `usually between ${fmtPct(r.p10)} and ${fmtPct(r.p90)}`,
        median: fmtPct(r.p50),
      })),
      examples: (pillars?.analogs?.closest ?? [])
        .map((a) => {
          const outcome = formatAnalogOutcome(a);
          if (!outcome) return null;
          return {
            when: a.date,
            whatHappened: outcome,
          };
        })
        .filter((ex): ex is { when: string; whatHappened: string } => ex !== null)
        .slice(0, 3),
      importantNote: "This is only what happened in the past. It does not tell us what will happen this time.",
    },
    otherThingsWeChecked: otherChecked,
    whereThingsDoNotAgree: tension.slice(0, 3).map((item) => ({
      conflict: `${item.left} ${item.right}`.trim(),
      whyItMatters: item.whyItMatters,
    })),
    simpleTakeAways: takeaways,
    questionsOnlyYouCanAnswer: reflectionQuestions,
    styleNote: `${profile.framing} Horizon in force: ${profile.horizon} Regime frame: ${regime}.`,
    model: "deterministic-synthesizer",
    isFallback: true,
    regime,
    flags: flags ?? undefined,
    evidence: evidence.slice(0, 12),
    tension,
    historicalAnalog: {
      setup: pillars?.analogs?.state
        ? `Current Chart Library state “${pillars.analogs.state}” on ${pillars.analogs.session}. Previous: “${pillars.analogs.prevState}”. Regime frame: ${regime}.`
        : "Chart Library state was unavailable; closest-name follow-through still listed where Yahoo history exists.",
      analogs: analogRows,
      baseRates: ranges.map((r) => ({
        horizon: r.horizon,
        range: `p10 ${fmtPct(r.p10)} · median ${fmtPct(r.p50)} · p90 ${fmtPct(r.p90)} · share of positive excess ${Math.round(r.pUp * 100)}% of the sample`,
        n: r.n,
        note: "Excess versus a date-matched liquid-stock baseline, not raw return, and not a forecast.",
      })),
      caveat:
        pillars?.analogs?.caveats?.join(" ") ||
        "Analogs are a historical sample. They do not assign a side to the current name.",
    },
    considerations: {
      forStyle: [
        `This memo is framed for a ${profile.label} style over ${profile.horizon}.`,
        analogHorizon === "1d"
          ? "Weight the 1-session analog band and any cash/rToken gap into the next open."
          : analogHorizon === "10d"
            ? "For this time frame, company reports matter more than one short-term price reading."
            : "For this time frame, compare the five-session history with the places where the facts disagree.",
        pillars?.technicals?.rTokenGap ?? "rToken venue print was not on the tape this run.",
        pillars?.marketStructure?.ok
          ? `Community ${pillars.marketStructure.communityId} membership means peer moves inside that group deserve more weight than index-level moves.`
          : "No community membership this run; peer comparison stays manual.",
      ],
      invalidation: [
        band
          ? `A move outside the usual historical range for ${analogHorizon} (${fmtPct(band.p10)} to ${fmtPct(band.p90)}) would be different from the cases in this sample.`
          : "Without analog bands, invalidation has to be defined by the trader’s own level — the desk will not invent one.",
        pillars?.fundamentals?.catalysts?.[0]
          ? `A new 8-K that changes the last-known filing picture (latest on tape: ${pillars.fundamentals.catalysts[0]}) would reopen the fundamental case.`
          : "Watch the next 8-K; the current filing tape is the last known state.",
      ],
      questions: [
        "Is the analog range wide enough that standing aside is the actual decision, not a placeholder?",
        "If cash is closed and rToken is still trading, which tape are you answering to?",
        "Which pillar, if it flipped tomorrow, would make you abandon the rest of this memo?",
      ],
    },
    sources: collectSources(pillars),
  };
}

function formatAnalogOutcome(a: { ticker: string; ret1d: number | null; ret5d: number | null; ret10d?: number | null }): string | null {
  if (typeof a.ret5d === "number" && !Number.isNaN(a.ret5d)) {
    const abs5d = Math.abs(a.ret5d).toFixed(1);
    const verb = a.ret5d > 0.05 ? "rose" : a.ret5d < -0.05 ? "fell" : "stayed roughly flat";
    const amount = a.ret5d > 0.05 || a.ret5d < -0.05 ? `about ${abs5d}%` : `(${a.ret5d >= 0 ? "+" : ""}${a.ret5d.toFixed(1)}%)`;
    return `${a.ticker} ${verb} ${amount} over the next 5 trading days.`;
  }
  if (typeof a.ret1d === "number" && !Number.isNaN(a.ret1d)) {
    const abs1d = Math.abs(a.ret1d).toFixed(1);
    const verb = a.ret1d > 0.05 ? "rose" : a.ret1d < -0.05 ? "fell" : "stayed roughly flat";
    const amount = a.ret1d > 0.05 || a.ret1d < -0.05 ? `about ${abs1d}%` : `(${a.ret1d >= 0 ? "+" : ""}${a.ret1d.toFixed(1)}%)`;
    return `${a.ticker} ${verb} ${amount} the next day.`;
  }
  if (typeof a.ret10d === "number" && !Number.isNaN(a.ret10d)) {
    const abs10d = Math.abs(a.ret10d).toFixed(1);
    const verb = a.ret10d > 0.05 ? "rose" : a.ret10d < -0.05 ? "fell" : "stayed roughly flat";
    const amount = a.ret10d > 0.05 || a.ret10d < -0.05 ? `about ${abs10d}%` : `(${a.ret10d >= 0 ? "+" : ""}${a.ret10d.toFixed(1)}%)`;
    return `${a.ticker} ${verb} ${amount} over the next 10 trading days.`;
  }
  return null;
}
