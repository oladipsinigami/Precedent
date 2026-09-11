import { STYLES } from "./style-profiles";
import type { Briefing, PillarBundle, TradingStyle } from "./types";
import { fmtPct } from "./http";

export function reweightBriefing(
  briefing: Briefing,
  newStyle: TradingStyle,
  pillarData?: PillarBundle | null
): Briefing {
  const profile = STYLES[newStyle];
  const horizon = profile.analogHorizon;

  const band = pillarData?.analogs?.ranges?.find((r) => r.horizon === horizon);

  const newStyleNote = `${profile.framing} Horizon in force: ${profile.horizon}${briefing.regime ? ` Regime frame: ${briefing.regime}.` : ""}`;

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

  return {
    ...briefing,
    title: briefing.title.includes("stress test")
      ? briefing.title.replace(
          /(Day trader|Swing trader|Event-driven \/ macro|Position) stress test/i,
          `${profile.label} stress test`
        )
      : `${briefing.title} [${profile.label}]`,
    styleNote: newStyleNote,
    considerations: {
      ...briefing.considerations,
      forStyle: styleConsiderations,
      invalidation: invalidationConsiderations,
    },
  };
}
