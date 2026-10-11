"use client";

import { animate, type JSAnimation } from "animejs";
import { MOTION_DURATION, MOTION_EASE } from "./tokens";

export interface CountUpOptions {
  from?: number;
  to: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  useLocale?: boolean;
  /**
   * When true (e.g., degraded/stale/unverified data or reduced-motion),
   * sets the final textContent immediately without animating.
   */
  skipAnimation?: boolean;
}

export function formatCountValue(
  value: number,
  decimals: number,
  prefix = "",
  suffix = "",
  useLocale = false,
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = useLocale
    ? safe.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : safe.toFixed(decimals);
  return `${prefix}${formatted}${suffix}`;
}

function isReducedMotionPreferred(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Animates a numeric value into an element's `textContent` with a fixed number of decimals.
 * Respects `prefers-reduced-motion` and `skipAnimation` (for caveat/degraded states).
 */
export function animateCountUp(
  element: HTMLElement | null,
  options: CountUpOptions,
): JSAnimation | null {
  if (!element) return null;

  const {
    from = 0,
    to,
    decimals = 0,
    duration = MOTION_DURATION.countUp,
    delay = 0,
    prefix = "",
    suffix = "",
    useLocale = false,
    skipAnimation = false,
  } = options;

  if (skipAnimation || isReducedMotionPreferred() || !Number.isFinite(to)) {
    element.textContent = formatCountValue(to, decimals, prefix, suffix, useLocale);
    return null;
  }

  const state = { val: from };
  element.textContent = formatCountValue(from, decimals, prefix, suffix, useLocale);

  return animate(state, {
    val: to,
    duration,
    delay,
    ease: MOTION_EASE.expo,
    onUpdate: () => {
      element.textContent = formatCountValue(state.val, decimals, prefix, suffix, useLocale);
    },
    onComplete: () => {
      element.textContent = formatCountValue(to, decimals, prefix, suffix, useLocale);
    },
  });
}

/**
 * Animates a "Went up X of Y..." phrase in place while preserving exact surrounding prose.
 */
export function animateWentUpPhrase(
  element: HTMLElement | null,
  fullText: string,
  skipAnimation = false,
  delay = 0,
): JSAnimation | null {
  if (!element) return null;
  if (skipAnimation || isReducedMotionPreferred()) {
    element.textContent = fullText;
    return null;
  }

  const match = fullText.match(
    /^(.*?(?:went up|beat the baseline|rose)\s+)(\d+)(\s+(?:times?\s+out\s+of|of)\s+)(\d+)(.*)$/i,
  );
  if (!match) {
    element.textContent = fullText;
    return null;
  }

  const [, lead, xStr, mid, yStr, tail] = match;
  const targetX = Number(xStr);
  const targetY = Number(yStr);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    element.textContent = fullText;
    return null;
  }

  const state = { x: 0, y: 0 };
  element.textContent = `${lead}0${mid}0${tail}`;

  return animate(state, {
    x: targetX,
    y: targetY,
    duration: MOTION_DURATION.countUp,
    delay,
    ease: MOTION_EASE.expo,
    onUpdate: () => {
      element.textContent = `${lead}${Math.round(state.x)}${mid}${Math.round(state.y)}${tail}`;
    },
    onComplete: () => {
      element.textContent = fullText;
    },
  });
}

/**
 * Animates the first signed or unsigned number inside a median/metric phrase while preserving exact surrounding text.
 */
export function animateEmbeddedNumber(
  element: HTMLElement | null,
  fullText: string,
  skipAnimation = false,
  delay = 0,
): JSAnimation | null {
  if (!element) return null;
  if (skipAnimation || isReducedMotionPreferred()) {
    element.textContent = fullText;
    return null;
  }

  const match = fullText.match(/^([^0-9+-]*[+-]?)(\d+(?:\.\d+)?)(.*)$/);
  if (!match) {
    element.textContent = fullText;
    return null;
  }

  const [, prefix, numStr, suffix] = match;
  const target = Number(numStr);
  if (!Number.isFinite(target)) {
    element.textContent = fullText;
    return null;
  }

  const dotIdx = numStr.indexOf(".");
  const decimals = dotIdx >= 0 ? numStr.length - dotIdx - 1 : 0;
  const state = { val: 0 };
  element.textContent = `${prefix}${(0).toFixed(decimals)}${suffix}`;

  return animate(state, {
    val: target,
    duration: MOTION_DURATION.countUp,
    delay,
    ease: MOTION_EASE.expo,
    onUpdate: () => {
      element.textContent = `${prefix}${state.val.toFixed(decimals)}${suffix}`;
    },
    onComplete: () => {
      element.textContent = fullText;
    },
  });
}
