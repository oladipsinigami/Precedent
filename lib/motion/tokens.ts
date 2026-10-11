/**
 * Shared institutional motion tokens for Precedent ("Clerk of Evidence").
 * Configured to the "Quiet" intensity preset by default:
 * - Total intake entrance <= 1.4s (hard cap <= 2.0s)
 * - Micro-interactions 150-320ms
 * - Default easings: outQuart or outExpo (no bounce, no overshoot springs)
 * - Stagger gaps: 35-65ms
 */

export type MotionIntensity = "quiet" | "moderate" | "showpiece";

export const MOTION_EASE = {
  default: "outQuart",
  expo: "outExpo",
  inOut: "inOutQuart",
  linear: "linear",
} as const;

export const MOTION_DURATION = {
  instant: 0,
  microFast: 160,
  micro: 210,
  microSlow: 320,
  section: 340,
  lineDraw: 360,
  countUp: 580,
  entranceStep: 340,
  maxEntranceTotal: 1400,
  minPipelineHold: 1200,
} as const;

export const MOTION_STAGGER = {
  tight: 35,
  normal: 45,
  relaxed: 60,
} as const;

export const MOTION_OFFSET = {
  liftPx: -3,
  riseSm: 6,
  riseMd: 8,
  nudgePx: 2.5,
} as const;

export const INTENSITY_SCALE: Record<
  MotionIntensity,
  { durationMult: number; staggerMult: number; risePx: number }
> = {
  quiet: { durationMult: 0.85, staggerMult: 0.8, risePx: 6 },
  moderate: { durationMult: 1.0, staggerMult: 1.0, risePx: 8 },
  showpiece: { durationMult: 1.15, staggerMult: 1.1, risePx: 10 },
};
