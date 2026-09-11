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
    framing: "Write as a pre-open / session brief. Emphasize gap risk while US cash is closed and the 7×24 rToken window is still live.",
  },
  swing: {
    label: "Swing trader",
    desk: "Several sessions to two weeks",
    horizon: "5–10 sessions. This is the default analog window.",
    depth: "Full four-pillar memo. Weight historical analogs and tension equally with the current tape.",
    analogHorizon: "5d",
    framing: "Write as a swing briefing. Translate analog 5d/10d excess ranges into what would have to happen for the thesis to fail over the next week.",
  },
  event: {
    label: "Event-driven / macro",
    desk: "Around a catalyst",
    horizon: "The event window, including weekend and after-hours rToken trade.",
    depth: "Lead with catalysts, guidance language, and macro headlines. Use analogs as a distribution around similar post-event tapes, not as a directional call.",
    analogHorizon: "5d",
    framing: "Write as an event brief. Separate what is known in filings/headlines from what the 7×24 market can reprice before cash opens.",
  },
  position: {
    label: "Position",
    desk: "Weeks to a quarter",
    horizon: "20–60 sessions. Multi-quarter filings matter more than one RSI print.",
    depth: "Lead with filings, earnings trajectory, and 10-day analog bands. Technicals as regime, not as a trigger.",
    analogHorizon: "10d",
    framing: "Write as an investment-committee style note. Stress-test whether the analog range is wide enough to invalidate a longer-dated thesis.",
  },
};

export const DEMO_TASK = {
  style: "swing" as TradingStyle,
  symbol: "AAPL",
  question:
    "I'm a swing trader. Stress-test the current AAPL rToken setup into next week — especially the 7×24 window versus the cash session. What did historically similar charts do next, and where do the pillars disagree?",
};
