import type { TradingStyle } from "./types";

export const STYLES: Record<
  TradingStyle,
  {
    label: string;
    desk: string;
    horizon: string;
    depth: string;
    analogHorizon: "1d" | "5d" | "10d";
    framing: string;
  }
> = {
  day: {
    label: "Day trader",
    desk: "Intraday / next cash session",
    horizon: "Hours to the next cash open/close. Overnight rToken gaps matter more than the 10-day analog band.",
    depth: "Keep the memo short. Lead with tape, realized vol, and 1-day analog range. Fundamentals only as a catalyst check.",
    analogHorizon: "1d",
    framing: "Pre-open and session brief emphasizing overnight gap risk while US cash is closed and the 7×24 rToken window is live.",
  },
  swing: {
    label: "Swing trader",
    desk: "Several sessions to two weeks",
    horizon: "5–10 sessions. This is the default analog window.",
    depth: "Full four-pillar memo. Weight historical analogs and tension equally with the current tape.",
    analogHorizon: "5d",
    framing: "Multi-session swing briefing evaluating historical 5-day analog ranges and key invalidation levels into next week.",
  },
  event: {
    label: "Event-driven / macro",
    desk: "Around a catalyst",
    horizon: "The event window, including weekend and after-hours rToken trade.",
    depth: "Lead with catalysts, guidance language, and macro headlines. Use analogs as a distribution around similar post-event tapes, not as a directional call.",
    analogHorizon: "5d",
    framing: "Catalyst and macro briefing separating confirmed filings from what the 7×24 venue can reprice before the cash session.",
  },
  position: {
    label: "Position",
    desk: "Weeks to a quarter",
    horizon: "20–60 sessions. Multi-quarter filings matter more than one RSI print.",
    depth: "Lead with filings, earnings trajectory, and 10-day analog bands. Technicals as regime, not as a trigger.",
    analogHorizon: "10d",
    framing: "Longer-horizon position assessment stress-testing multi-week analog distribution against fundamental SEC filing trends.",
  },
};

export const DEMO_TASK = {
  style: "swing" as TradingStyle,
  symbol: "AAPL",
  question:
    "I'm a swing trader. Stress-test the current AAPL rToken setup into next week — especially the 7×24 window versus the cash session. What did historically similar charts do next, and where do the pillars disagree?",
};

/**
 * Normalize a free-typed question so the demo fast path matches the intended
 * walkthrough instead of demanding a byte-identical string. The demo question is
 * filled by a UI control, so a drifted em dash, an ASCII "x" for "×", collapsed
 * whitespace, or a curly apostrophe would otherwise silently fall through to the
 * live pipeline — which is slower and, for a judge, indistinguishable from the
 * fast path simply being broken.
 *
 * Folding is deliberately conservative: it normalizes typography and spacing but
 * never wording, so an ordinary research question still runs live.
 */
export function normalizeQuestion(question: string): string {
  return question
    // Curly quotes/apostrophes -> ASCII, and the various Unicode dashes -> "-".
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    // Multiplication/cross signs -> "x" so "7×24" and "7x24" are the same.
    .replace(/[\u00D7\u2715\u2716\u2A2F]/g, "x")
    // Ellipsis and non-breaking/hair spaces -> a single space.
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2007\u202F\u2009]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
