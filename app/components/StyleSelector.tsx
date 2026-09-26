"use client";

import { STYLES } from "@/lib/style-profiles";
import type { TradingStyle } from "@/lib/types";

interface StyleSelectorProps {
  currentStyle: TradingStyle;
  onStyleChange: (style: TradingStyle) => void;
  disabled?: boolean;
}

export function StyleSelector({ currentStyle, onStyleChange, disabled }: StyleSelectorProps) {
  const stylesList = Object.keys(STYLES) as TradingStyle[];

  return (
    <div data-tour="tour-style">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <label className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#c7d3de]">
          <svg aria-hidden="true" className="h-2 w-2 shrink-0 text-[#d4ff3f]" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 0L10 5L5 10L0 5Z" />
          </svg>
          Trader Operating Style & Time Horizon
        </label>
        <span className="hidden min-[380px]:inline font-mono text-[10px] text-[#637585]">
          Tailors the analytical lens
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-4">
        {stylesList.map((item) => {
          const isSelected = currentStyle === item;
          const profile = STYLES[item];

          return (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => onStyleChange(item)}
              className={`group relative flex min-h-[78px] flex-col justify-between rounded-sm border p-2.5 sm:p-3 text-left transition-all duration-150 ${
                isSelected
                  ? "scale-[1.03] border-[#d4ff3f] bg-[#d4ff3f]/[0.09] shadow-[0_0_26px_rgba(212,255,63,0.14)] ring-1 ring-[#d4ff3f]/40"
                  : "border-white/[0.08] bg-[#0b0e13]/80 hover:border-white/20 hover:bg-[#0e1218]"
              }`}
            >
              {isSelected && (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-px -top-px h-3.5 w-3.5 text-[#d4ff3f]"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path d="M1 13V1h12" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`tracking-tight ${
                      isSelected
                        ? "text-sm font-bold text-white"
                        : "text-xs font-medium text-[#c2cbd3] group-hover:text-white"
                    }`}
                  >
                    {profile.label}
                  </span>
                  <span
                    className={`shrink-0 ${
                      isSelected
                        ? "h-2 w-2 rotate-45 bg-[#d4ff3f] shadow-[0_0_10px_#d4ff3f]"
                        : "h-1.5 w-1.5 rounded-full bg-white/20 group-hover:bg-white/40"
                    }`}
                  />
                </div>
                <div className="mt-1 line-clamp-1 font-mono text-[10px] text-[#71808e]">
                  {profile.desk}
                </div>
              </div>

              <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[9px] uppercase tracking-wider text-[#526270]">
                <span>Analog:</span>
                <span className={isSelected ? "font-bold text-[#d4ff3f]" : "text-[#8394a4]"}>
                  {profile.analogHorizon}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
