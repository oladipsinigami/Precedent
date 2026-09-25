import { STYLES } from "./style-profiles";
import type { Briefing, PillarBundle, TradingStyle } from "./types";
import { fmtPct } from "./http";
import { formatAnalogOutcome } from "./deterministic-briefing";
import { guardBriefing } from "./language-guard";

export function reweightBriefing(
  briefing: Briefing,
  newStyle: TradingStyle,
  pillarData?: PillarBundle | null
): Briefing {
  const profile = STYLES[newStyle];
  const horizon = profile.analogHorizon;

  const band = pillarData?.analogs?.ranges?.find((r) => r.horizon === horizon);

  const newStyleNote = `${profile.framing} Target horizon: ${profile.horizon}${briefing.regime ? ` Regime frame: ${briefing.regime}.` : ""}`;

  const styleConsiderations = [
    `Active style re-weighted to ${profile.label} (${profile.horizon}).`,
    horizon === "1d"
      ? "Single-session horizon prioritizes 24/7 rToken basis and overnight gap risk into the NY cash open."
      : horizon === "10d"
      ? "Multi-week horizon prioritizes SEC filing trajectory and RMT community stability over short-term session noise."
      : "Swing horizon prioritizes 5-session analog dispersion and tension between tape momentum and news flow.",
    pillarData?.technicals?.rTokenGap ?? "Evaluate 24/7 rToken venue basis vs NY cash close.",
  ];

  const invalidationConsiderations = [
    band
      ? `Realization beyond the ${horizon} p10/p90 band (${fmtPct(band.p10)} / ${fmtPct(band.p90)} excess) marks a regime break relative to historical precedent.`
      : briefing.considerations.invalidation[0] ?? "Setup invalidation requires explicit price violation of structural support/resistance.",
    briefing.considerations.invalidation[1] ?? "Monitor upcoming SEC filings for thesis alteration.",
  ];

  // Strip any prior "[Label]" suffix accumulated by earlier style switches,
  // then rebuild the title deterministically — never stack suffixes.
  const baseTitle = briefing.title.replace(/\s*\[[^\]]*\]\s*$/, "").trim();
  const tokenMatch = baseTitle.match(/^([rR]?[A-Za-z0-9]+)\s*[—\-:]\s*/);
  const prefix = tokenMatch ? `${tokenMatch[1]} — ` : "";
  const newTitle = prefix
    ? `${prefix}${profile.label} stress test`
    : baseTitle.includes("stress test")
    ? baseTitle.replace(
        /(Day trader|Swing trader|Event-driven \/ macro|Event-driven|Position trader|Position|Day|Swing)\s*(?:trader\s*)?stress test/i,
        `${profile.label} stress test`
      )
    : `${baseTitle} [${profile.label}]`;

  const updatedWhatWeDid = newStyle === "day"
    ? "Cross-examined 1-session price action against 10-year analogs, measuring the 24/7 Bitget basis against the NY cash close alongside SEC filings and recent headlines."
    : newStyle === "position"
    ? "Cross-examined multi-week position trajectory against 10-year analog distributions, SEC EDGAR filing trends, and RMT market structure alongside 24/7 Bitget tape context."
    : newStyle === "event"
    ? "Cross-examined catalyst and event-window pricing against historical reaction bands, SEC filing disclosures, and 24/7 Bitget tape basis."
    : "Cross-examined 5-session swing structure against 10-year analog distributions, measuring the 24/7 Bitget basis against the NY cash close alongside corporate fundamentals and discourse.";

  const nativeTicker = tokenMatch ? tokenMatch[1].replace(/^r/i, "").toUpperCase() : "";
  const updatedExamples = (pillarData?.analogs?.closest ?? [])
    .map((a) => {
      const outcome = formatAnalogOutcome(a, horizon);
      if (!outcome) return null;
      const whenLabel = a.sameName
        ? `${a.ticker} (${a.date})`
        : nativeTicker && (a.ticker.startsWith(nativeTicker) || nativeTicker.startsWith(a.ticker))
        ? `${a.ticker} (${a.date}, related)`
        : `${a.ticker} (${a.date}, similar chart)`;
      return { when: whenLabel, whatHappened: outcome };
    })
    .filter((ex): ex is { when: string; whatHappened: string } => ex !== null && !/\b(n\/?a|null|undefined)\b/i.test(ex.whatHappened))
    .slice(0, 3);

  const historicalStressTest = {
    ...briefing.historicalStressTest,
    summary: band
      ? `Identified ${band.n} matching historical setups across the 10-year library for a ${horizon === "1d" ? "1-session" : horizon === "10d" ? "10-session" : "5-session"} horizon. Quantile dispersion spans ${fmtPct(band.p10)} to ${fmtPct(band.p90)}, reflecting wide outcome variance.`
      : briefing.historicalStressTest.summary,
    examples: updatedExamples.length ? updatedExamples : briefing.historicalStressTest.examples,
  };

  return guardBriefing({
    ...briefing,
    title: newTitle.includes(profile.label) ? newTitle : `${baseTitle} [${profile.label}]`,
    whatWeDid: updatedWhatWeDid,
    historicalStressTest,
    styleNote: newStyleNote,
    considerations: {
      ...briefing.considerations,
      forStyle: styleConsiderations,
      invalidation: invalidationConsiderations,
    },
  });
}
