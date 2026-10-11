"use client";

import { useEffect, useLayoutEffect, useRef, type DependencyList, type RefObject } from "react";
import { createScope, utils, type Scope } from "animejs";
import { MOTION_DURATION, MOTION_EASE } from "./tokens";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface ScopedMotionContext {
  scope: Scope;
  root: HTMLElement;
  reduceMotion: boolean;
  /**
   * Immediately reveals all `[data-anim]` elements inside the scope root without animation.
   */
  revealAllStatic: () => void;
}

/**
 * Client-only hook that binds an Anime.js v4 Scope to a root element ref,
 * registers `prefers-reduced-motion: reduce` through the Scope mediaQueries API,
 * skips animations (making hidden `[data-anim]` elements visible) when reduced motion
 * is active, and reverts the scope on unmount so React 19 Strict Mode never double-runs.
 */
export function useAnimeScope<T extends HTMLElement = HTMLDivElement>(
  setup: (ctx: ScopedMotionContext) => void | (() => void),
  deps: DependencyList = [],
): { rootRef: RefObject<T | null>; scopeRef: RefObject<Scope | null> } {
  const rootRef = useRef<T | null>(null);
  const scopeRef = useRef<Scope | null>(null);

  useIsomorphicLayoutEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;

    const scope = createScope({
      root: rootRef,
      defaults: {
        ease: MOTION_EASE.default,
        duration: MOTION_DURATION.section,
      },
      mediaQueries: {
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
    });

    scopeRef.current = scope;

    const revealAllStatic = () => {
      const nodes = rootEl.querySelectorAll<HTMLElement | SVGElement>("[data-anim]");
      if (nodes.length > 0) {
        utils.set(nodes, {
          opacity: 1,
          translateX: 0,
          translateY: 0,
          scale: 1,
          scaleX: 1,
          scaleY: 1,
        });
      }
      rootEl.removeAttribute("data-anim-cloak");
    };

    scope.add((self) => {
      const reduceMotion = Boolean(self?.matches?.reduceMotion);
      if (reduceMotion) {
        revealAllStatic();
        return;
      }
      rootEl.removeAttribute("data-anim-cloak");
      return setup({
        scope: self ?? scope,
        root: rootEl,
        reduceMotion: false,
        revealAllStatic,
      });
    });

    return () => {
      scope.revert();
      scopeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { rootRef, scopeRef };
}
