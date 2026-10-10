"use client";

import React from "react";

interface MemoSectionProps {
  number: string;
  title: string;
  children: React.ReactNode;
  shaded?: boolean;
  badge?: string;
}

export function MemoSection({ number, title, children, shaded = false, badge }: MemoSectionProps) {
  return (
    <section
      className={`border-t border-shell/12 px-4 py-6 sm:px-10 sm:py-11 transition-colors ${
        shaded ? "bg-paper-deep" : "bg-paper-alt"
      }`}
    >
      <div className="mb-5 sm:mb-7 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-moss font-mono text-[11px] font-bold text-paper-alt [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]">
            {number}
          </span>
          <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-shell">
            {title}
          </h3>
        </div>

        {badge && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute-faint border border-moss/20 px-2.5 py-0.5 rounded shrink-0">
            {badge}
          </span>
        )}
      </div>
      {/* Hairline gradient rule under the section header to anchor the block */}
      <div aria-hidden="true" className="mb-5 sm:mb-7 -mt-3 sm:-mt-4 flex items-center gap-2">
        <span className="h-0.5 w-6 bg-moss" />
        <span className="h-px flex-1 bg-gradient-to-r from-moss/30 to-transparent" />
      </div>

      <div className="relative text-ink-strong">{children}</div>
    </section>
  );
}
