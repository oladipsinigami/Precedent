import { realizedVol } from "./indicators";
import { loadMarketStructureStore } from "./pillars/market-structure";
import { yahooChart } from "./providers/yahoo";
import type { Regime } from "./types";
import type { NameCard } from "./universe";

// Lightweight classifier that runs ONCE per research run, before the pillars.
// Labels describe market structure (tape shape, systemic intensity) — never a
// call on what happens next, and never one of the forbidden verdict words.
//
// Rules (documented thresholds, all falsifiable):
//   - marketModeStrength >= 0.55                -> high-systemic (systemic leg first)
//   - vol20 < 15% and marketMode < 0.30 (or store missing) -> low-systemic
//   - 20-session move > +4%                     -> trending-up
//   - 20-session move < -4%                     -> trending-down
//   - otherwise                                 -> range-bound
//   - inputs unavailable                        -> normal (explicit fallback)

const LOOKBACK = 21; // ~20 sessions of move + room for the vol window

export async function detectRegime(name: NameCard): Promise<{ regime: Regime; detail: string }> {
  const fallback: { regime: Regime; detail: string } = {
    regime: "normal",
    detail: "Regime inputs unavailable; defaulting to the neutral label.",
  };
  try {
    const [target, store] = await Promise.all([
      yahooChart(name.native, "3mo", "1d").catch(() => null),
      loadMarketStructureStore(),
    ]);
    if (!target || target.bars.length < LOOKBACK) return fallback;
    const closes = target.bars.map((b) => b.c);
    const recent = closes.slice(-LOOKBACK);
    const movePct = ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100;
    const vol20 = realizedVol(closes.slice(-21), 20);
    const marketMode = store?.marketModeStrength;

    if (marketMode !== undefined && marketMode >= 0.55) {
      return {
        regime: "high-systemic",
        detail: `Market-mode share ${(marketMode * 100).toFixed(1)}% of eigenstructure; systemic leg dominates the tape.`,
      };
    }
    if (vol20 !== undefined && vol20 < 15 && (marketMode === undefined || marketMode < 0.3)) {
      return {
        regime: "low-systemic",
        detail: `Realized 20d vol ${vol20.toFixed(1)}% with weak market mode; idiosyncratic tape.`,
      };
    }
    if (movePct > 4) {
      return {
        regime: "trending-up",
        detail: `+${movePct.toFixed(1)}% over the last 20 sessions describes the tape shape, not a call.`,
      };
    }
    if (movePct < -4) {
      return {
        regime: "trending-down",
        detail: `${movePct.toFixed(1)}% over the last 20 sessions describes the tape shape, not a call.`,
      };
    }
    return {
      regime: "range-bound",
      detail: `${movePct >= 0 ? "+" : ""}${movePct.toFixed(1)}% over 20 sessions sits inside the range band.`,
    };
  } catch {
    return fallback;
  }
}
