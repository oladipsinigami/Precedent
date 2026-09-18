"use client";

import { ResearchMemo } from "./ResearchMemo";
import { PipelineSummary } from "./PipelineSidebar";
import { STYLES } from "@/lib/style-profiles";
import type { Briefing, PillarBundle, PillarState, TradingStyle } from "@/lib/types";

interface ResultsViewProps {
  briefing: Briefing;
  error: string;
  style: TradingStyle;
  onStyleChange: (style: TradingStyle) => void;
  pillarData: PillarBundle | null;
  decisionNote: string;
  onDecisionNoteChange: (value: string) => void;
  onBackToIntake: () => void;
  symbol: string;
  meta: { native: string; name: string; regime: string } | null;
  statuses: PillarState;
}

export function ResultsView({
  briefing,
  error,
  style,
  onStyleChange,
  pillarData,
  decisionNote,
  onDecisionNoteChange,
  onBackToIntake,
  symbol,
  meta,
  statuses,
}: ResultsViewProps) {
  return (
    <div className="mx-auto max-w-[1360px] py-4 sm:py-10">
      {/* Top Action & Navigation Strip */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 border-b border-white/[0.08] pb-5">
        {/* Left: Return to Intake Button */}
        <button
          type="button"
          onClick={onBackToIntake}
          className="group flex w-full sm:w-auto min-h-[44px] sm:min-h-0 items-center justify-center sm:justify-start gap-2.5 rounded-sm border border-white/[0.14] bg-[#0c1015] px-4 py-2 text-xs font-semibold text-[#c8d4df] transition hover:border-[#d4ff3f] hover:bg-[#d4ff3f]/[0.05] hover:text-white shadow-sm"
        >
          <span className="font-mono text-sm transition-transform duration-200 group-hover:-translate-x-1 text-[#d4ff3f]">
            ←
          </span>
          <span className="font-mono uppercase tracking-wider text-[11px]">
            New Research Formulation
          </span>
        </button>

        {/* Center: Target Instrument & Venue context */}
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-[#a0b0bf] max-w-full">
            <span className="font-bold text-white shrink-0">{meta?.native ?? symbol}</span>
            <span className="text-[#556472]">·</span>
            <span className="truncate max-w-[120px] sm:max-w-[180px]">{meta?.name ?? "Asset"}</span>
            <span className="text-[#556472]">·</span>
            <span className="rounded bg-[#d4ff3f]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#d4ff3f] shrink-0">
              Bitget 24/7 Market
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-[#a0b0bf]">
            <span className="text-[#718190]">Regime:</span>
            <span className="font-semibold text-white">{meta?.regime ?? briefing.regime ?? "Normal"}</span>
          </div>
        </div>

        {/* Right: Small Expandable Pipeline Summary */}
        <PipelineSummary statuses={statuses} pillarData={pillarData} />
      </div>


      <div className="mb-6 sm:mb-8 rounded-sm border border-white/[0.08] bg-[#0c1016]/85 p-3.5 sm:p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9eb0bf]">
              ✦ Adaptive Perspective Re-weighting
            </div>
            <div className="text-xs text-[#718191] mt-0.5">
              Switching your operational style recalibrates the analytical lens, analog horizons, and invalidation rules instantly.
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            {(Object.keys(STYLES) as TradingStyle[]).map((st) => {
              const isSelected = style === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStyleChange(st)}
                  className={`flex min-h-[40px] sm:min-h-0 items-center justify-center rounded-sm border px-3 py-2 sm:px-3.5 sm:py-1.5 font-mono text-xs font-medium transition ${
                    isSelected
                      ? "border-[#d4ff3f] bg-[#d4ff3f]/10 text-white shadow-[0_0_14px_rgba(212,255,63,0.18)] font-semibold"
                      : "border-white/[0.08] bg-[#080b0f] text-[#8e9da9] hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={isSelected ? "text-[#d4ff3f]" : "text-[#556472]"}>
                      {isSelected ? "●" : "○"}
                    </span>
                    <span>{STYLES[st].label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* The Master Archival Paper Memo */}
      <ResearchMemo
        briefing={briefing}
        style={style}
        pillarData={pillarData}
        decisionNote={decisionNote}
        onDecisionNoteChange={onDecisionNoteChange}
      />

      {/* Bottom Footer Navigation */}
      <div className="mt-8 sm:mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/[0.08] pt-5 sm:pt-6">
        <button
          type="button"
          onClick={onBackToIntake}
          className="group flex min-h-[44px] sm:min-h-0 items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#d4ff3f] transition hover:text-white"
        >
          <span className="transition-transform group-hover:-translate-x-1">←</span>
          <span>Formulate Another Research Question</span>
        </button>

        <div className="text-left sm:text-right text-[11px] text-[#637382]">
          Precedent Quantitative Desk · Factual evidence streams & non-directional historical distributions
        </div>
      </div>
    </div>
  );
}
