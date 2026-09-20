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
    `Active style re-weighted to ${profile.label}. Target horizon: ${profile.desk}.`,
    horizon === "1d"
      ? "Prioritize the 1-session analog band and overnight 7×24 rToken gap into the next cash open."
      : horizon === "10d"
      ? "Prioritize SEC filing trajectory and the 10-session analog band over any single-day momentum print."
      : "Prioritize the 5-session analog band and points of tension over isolated headlines.",
    pillarData?.technicals?.rTokenGap ?? "Evaluate 7×24 rToken tape vs cash close.",
  ];

  const invalidationConsiderations = [
    band
      ? `A realized move beyond the ${horizon} p10/p90 band (${fmtPct(band.p10)} / ${fmtPct(band.p90)} excess) invalidates the setup relative to historical precedent.`
      : briefing.considerations.invalidation[0] ?? "Setup invalidation marked at key structural swing level.",
    briefing.considerations.invalidation[1] ?? "Monitor upcoming 8-K filings for thesis changes.",
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
    ? "We compared the current chart with past charts that had a similar shape, focusing on the 1-session horizon into the next cash open. We specifically checked the 24-hour Bitget token price against the regular New York market close to assess overnight gap and basis risk. We also checked price trends and recent news."
    : newStyle === "position"
    ? "We compared the current chart with past charts over a multi-week horizon. We focused on company filings, earnings trajectory, and 10-day analog distributions, checking the 24-hour Bitget token price for context."
    : newStyle === "event"
    ? "We compared the current chart with past charts around similar event windows. We specifically evaluated the 24-hour Bitget token price against the regular market close, along with upcoming catalysts, company earnings, and recent news."
    : "We compared the current chart with past charts that had a similar shape. We also checked company earnings, price trends, Bitget trading, and recent news.";

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
      ? `We found ${band.n} past cases with a similar chart pattern over a ${horizon === "1d" ? "1-day" : horizon === "10d" ? "10-day" : "5-day"} horizon. Outcomes ranged from ${fmtPct(band.p10)} to ${fmtPct(band.p90)}. History provides context, but cannot predict this run.`
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
