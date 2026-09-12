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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <label className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#8e9ca8]">
          Operating Frame · Synthesis Lens
        </label>
        <span className="hidden min-[380px]:inline font-mono text-[10px] text-[#556472]">
          Re-weights perspective
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
                  ? "border-[#d4ff3f]/80 bg-[#d4ff3f]/[0.07] shadow-[0_0_20px_rgba(212,255,63,0.06)]"
                  : "border-white/[0.08] bg-[#0b0e13]/80 hover:border-white/20 hover:bg-[#0e1218]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium tracking-tight ${
                      isSelected ? "text-white" : "text-[#c2cbd3] group-hover:text-white"
                    }`}
                  >
                    {profile.label}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      isSelected
                        ? "bg-[#d4ff3f] shadow-[0_0_8px_#d4ff3f]"
                        : "bg-white/20 group-hover:bg-white/40"
                    }`}
                  />
                </div>
                <div className="mt-1 line-clamp-1 font-mono text-[10px] text-[#71808e]">
                  {profile.desk}
                </div>
              </div>

              <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[9px] uppercase tracking-wider text-[#526270]">
                <span>Analog:</span>
                <span className={isSelected ? "text-[#d4ff3f]" : "text-[#8394a4]"}>
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
