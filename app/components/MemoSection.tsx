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
      className={`border-t border-[#121614]/12 px-6 py-9 sm:px-10 sm:py-11 transition-colors ${
        shaded ? "bg-[#ece6dd]" : "bg-[#f5f0e6]"
      }`}
    >
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#425828]/10 font-mono text-xs font-bold text-[#425828]">
            {number}
          </span>
          <h3 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[#121614]">
            {title}
          </h3>
        </div>

        {badge && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#55694b] border border-[#425828]/20 px-2.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>

      <div className="relative text-[#1b221d]">{children}</div>
    </section>
  );
}
