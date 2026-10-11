"use client";

import React from "react";
import { animate, onScroll, utils } from "animejs";
import { MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";

interface MemoSectionProps {
  number: string;
  title: string;
  children: React.ReactNode;
  shaded?: boolean;
  badge?: string;
}

export function MemoSection({ number, title, children, shaded = false, badge }: MemoSectionProps) {
  const { rootRef } = useAnimeScope<HTMLElement>(({ root }) => {
    const diamond = root.querySelector<HTMLElement>("[data-anim='section-diamond']");
    const anchor = root.querySelector<HTMLElement>("[data-anim='section-anchor']");
    const hairline = root.querySelector<HTMLElement>("[data-anim='section-hairline']");
    const badgeEl = root.querySelector<HTMLElement>("[data-anim='section-badge']");

    let hasPlayed = false;
    const playHeaderReveal = () => {
      if (hasPlayed) return;
      hasPlayed = true;

      if (diamond) {
        utils.set(diamond, { opacity: 0, scale: 0.84 });
        animate(diamond, {
          opacity: [0, 1],
          scale: [0.84, 1],
          duration: 240,
          ease: MOTION_EASE.expo,
        });
      }

      if (anchor) {
        utils.set(anchor, { scaleX: 0, transformOrigin: "left center" });
        animate(anchor, {
          scaleX: [0, 1],
          duration: 220,
          ease: MOTION_EASE.expo,
        });
      }

      if (hairline) {
        utils.set(hairline, { scaleX: 0, transformOrigin: "left center" });
        animate(hairline, {
          scaleX: [0, 1],
          duration: 380,
          delay: 55,
          ease: MOTION_EASE.expo,
        });
      }

      if (badgeEl) {
        utils.set(badgeEl, { opacity: 0, translateX: 6 });
        animate(badgeEl, {
          opacity: [0, 1],
          translateX: [6, 0],
          duration: 240,
          delay: 90,
          ease: MOTION_EASE.default,
        });
      }
    };

    const parentDetails = root.closest("details");
    if (parentDetails && !parentDetails.open) {
      const onToggle = () => {
        if (parentDetails.open) {
          hasPlayed = false;
          playHeaderReveal();
        }
      };
      parentDetails.addEventListener("toggle", onToggle);
      return () => parentDetails.removeEventListener("toggle", onToggle);
    }

    onScroll({
      target: root,
      onEnterForward: () => {
        playHeaderReveal();
      },
    });
  }, []);

  return (
    <section
      ref={rootRef}
      className={`border-t border-shell/12 px-4 py-6 sm:px-10 sm:py-11 transition-colors ${
        shaded ? "bg-paper-deep" : "bg-paper-alt"
      }`}
    >
      <div className="mb-5 sm:mb-7 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <span
            data-anim="section-diamond"
            className="flex h-7 w-7 shrink-0 items-center justify-center bg-moss font-mono text-[11px] font-bold text-paper-alt [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]"
          >
            {number}
          </span>
          <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-shell">
            {title}
          </h3>
        </div>

        {badge && (
          <span
            data-anim="section-badge"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute-faint border border-moss/20 px-2.5 py-0.5 rounded shrink-0"
          >
            {badge}
          </span>
        )}
      </div>
      {/* Hairline gradient rule under the section header to anchor the block */}
      <div aria-hidden="true" className="mb-5 sm:mb-7 -mt-3 sm:-mt-4 flex items-center gap-2">
        <span data-anim="section-anchor" className="h-0.5 w-6 bg-moss origin-left" />
        <span
          data-anim="section-hairline"
          className="h-px flex-1 bg-gradient-to-r from-moss/30 to-transparent origin-left"
        />
      </div>

      <div className="relative text-ink-strong">{children}</div>
    </section>
  );
}
