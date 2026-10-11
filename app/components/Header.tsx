"use client";

import { useEffect, useRef } from "react";
import { animate, utils } from "animejs";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";

interface HeaderProps {
  onLoadDemo: () => void;
  onStartTour?: () => void;
  universeMeta: { source: "live" | "cached" | "fallback"; count: number; asOf: string | null };
  animateEntrance?: boolean;
  busy?: boolean;
  isDemoRunning?: boolean;
}

export function Header({
  onLoadDemo,
  onStartTour,
  universeMeta,
  animateEntrance = false,
  busy = false,
  isDemoRunning = false,
}: HeaderProps) {
  const arrowRef = useRef<HTMLSpanElement | null>(null);
  const demoBtnRef = useRef<HTMLButtonElement | null>(null);
  const demoProgressRef = useRef<HTMLSpanElement | null>(null);

  const { rootRef } = useAnimeScope<HTMLElement>(
    ({ root, revealAllStatic }) => {
      if (!animateEntrance) {
        revealAllStatic();
        return;
      }
      const headerRow = root.querySelectorAll("[data-anim='intake-header']");
      if (headerRow.length > 0) {
        animate(headerRow, {
          opacity: [0, 1],
          translateY: [-4, 0],
          duration: 280,
          ease: MOTION_EASE.default,
        });
      }
    },
    [],
  );

  useEffect(() => {
    const bar = demoProgressRef.current;
    const btn = demoBtnRef.current;
    if (!bar) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      utils.set(bar, { opacity: isDemoRunning ? 1 : 0, scaleX: isDemoRunning ? 1 : 0 });
      return;
    }

    if (isDemoRunning) {
      if (btn) {
        animate(btn, {
          scale: [0.97, 1],
          duration: MOTION_DURATION.micro,
          ease: MOTION_EASE.default,
        });
      }
      utils.set(bar, { opacity: 1, scaleX: 0 });
      const anim = animate(bar, {
        scaleX: [0, 0.98],
        duration: 1580,
        ease: MOTION_EASE.expo,
      });
      return () => {
        anim.pause();
      };
    }

    utils.set(bar, { opacity: 0, scaleX: 0 });
  }, [isDemoRunning]);

  const handleDemoEnter = () => {
    if (
      busy ||
      !arrowRef.current ||
      (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      return;
    }
    animate(arrowRef.current, {
      translateX: 2.5,
      translateY: -2,
      duration: MOTION_DURATION.microFast,
      ease: MOTION_EASE.default,
    });
  };

  const handleDemoLeave = () => {
    if (
      !arrowRef.current ||
      (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      return;
    }
    animate(arrowRef.current, {
      translateX: 0,
      translateY: 0,
      duration: MOTION_DURATION.microFast,
      ease: MOTION_EASE.default,
    });
  };

  const universeHealthy = universeMeta.source !== "fallback";
  const universeLabel =
    universeMeta.source === "live"
      ? `${universeMeta.count.toLocaleString("en-US")} rTokens Live`
      : universeMeta.source === "cached"
        ? `${universeMeta.count.toLocaleString("en-US")} rTokens · cached`
        : "Built-in list · discovery offline";
  const universeTitle =
    universeMeta.source === "live"
      ? `Bitget rToken universe refreshed ${universeMeta.asOf ? new Date(universeMeta.asOf).toLocaleString() : "recently"}`
      : universeMeta.source === "cached"
        ? `Live Bitget discovery is unreachable. Showing the last successfully fetched universe from ${universeMeta.asOf ? new Date(universeMeta.asOf).toLocaleString() : "an earlier session"}.`
        : "Live Bitget discovery is unavailable and no earlier universe was cached; showing the built-in fallback list.";
  return (
    <header
      ref={rootRef}
      data-anim-cloak={animateEntrance ? "true" : undefined}
      className="sticky top-0 z-40 border-b border-white/[0.08] bg-blot/85 backdrop-blur-xl"
    >
      <div
        data-anim="intake-header"
        className="mx-auto flex max-w-[1520px] items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3.5 lg:px-8"
      >
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0" data-tour="tour-brand">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-lime to-lime-alt font-mono text-xs font-black text-blot shadow-[0_0_18px_rgba(212,255,63,0.35)]">
            P
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-white">
                Precedent
              </span>
              <span className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-text">
                Research Desk
              </span>
            </div>
            <div className="hidden sm:block text-[11px] text-slate-line truncate">
              Institutional Intelligence for Tokenized US Equities & Assets
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-5 font-mono text-[11px] uppercase tracking-[0.14em] shrink-0">
          <span className="hidden items-center gap-1.5 text-slate-line lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-slate" />
            Pure Research · Non-Execution
          </span>

          <div
            data-tour="tour-universe"
            className={`flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 py-1 sm:px-3 sm:py-1 ${
              universeHealthy
                ? "border-white/[0.09] bg-white/[0.03] text-slate-pale"
                : "border-amber/30 bg-amber/[0.06] text-gold"
            }`}
            title={universeTitle}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${universeHealthy ? "bg-lime" : "bg-amber"}`} />
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${universeHealthy ? "bg-lime" : "bg-amber"}`} />
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-[0.12em]">
              {universeLabel}
            </span>
          </div>

          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="hidden min-h-[44px] items-center rounded-md border border-white/15 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-mid transition hover:border-lime/50 hover:text-white sm:inline-flex"
              title="Explain every control on this screen"
            >
              Quick tour
            </button>
          )}

          <button
            ref={demoBtnRef}
            type="button"
            data-tour="tour-demo"
            disabled={busy}
            onClick={onLoadDemo}
            onMouseEnter={handleDemoEnter}
            onMouseLeave={handleDemoLeave}
            className={`group relative overflow-hidden flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-xs font-bold transition ${
              isDemoRunning
                ? "border border-lime/70 bg-ink text-lime shadow-[0_0_24px_rgba(212,255,63,0.35)]"
                : "bg-lime text-blot shadow-[0_0_18px_rgba(212,255,63,0.35)] hover:bg-white disabled:opacity-60"
            }`}
            title="Load and run the recommended demo walkthrough (AAPL swing stress-test)"
          >
            {isDemoRunning ? (
              <>
                <span className="h-2 w-2 rounded-full bg-lime animate-pulse" />
                <span>Converging AAPL Demo…</span>
              </>
            ) : (
              <>
                <span>Load recommended demo</span>
                <span ref={arrowRef} data-anim="header-demo-arrow" className="inline-block">
                  ↗
                </span>
              </>
            )}
            <span
              ref={demoProgressRef}
              style={{ transformOrigin: "left center", transform: "scaleX(0)", opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] bg-lime"
            />
          </button>
        </div>
      </div>
      {onStartTour && (
        <div className="border-t border-white/[0.06] px-3.5 py-2 sm:hidden">
          <button
            type="button"
            onClick={onStartTour}
            className="flex min-h-[40px] w-full items-center justify-center rounded-md border border-white/15 bg-white/[0.04] font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-lime"
          >
            Quick tour · explain this screen
          </button>
        </div>
      )}
    </header>
  );
}
