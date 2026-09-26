"use client";

import { useState } from "react";
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
  const [downloadMode, setDownloadMode] = useState<"executive" | "full" | null>(null);
  const bitgetTapeAvailable = Boolean(pillarData?.technicals?.rToken);

  async function handleDownload(mode: "executive" | "full") {
    if (downloadMode) return;
    setDownloadMode(mode);
    try {
      // Lazy-import so pptxgenjs is only loaded when the trader asks for it.
      const { downloadBriefingPptx } = await import("@/lib/export-pptx");
      await downloadBriefingPptx({
        briefing,
        style,
        symbol: meta?.native ?? symbol,
        regime: meta?.regime ?? briefing.regime,
        decisionNote,
        mode,
      });
    } catch (err) {
      console.error("[PPTX] export failed:", err);
    } finally {
      setDownloadMode(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1360px] py-4 sm:py-10">
      {/* Top Action & Navigation Strip */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 border-b border-white/[0.08] pb-5">
        {/* Left: Return to Intake Button */}
        <button
          type="button"
          onClick={onBackToIntake}
          data-tour="tour-back"
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
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${
              bitgetTapeAvailable
                ? "bg-[#d4ff3f]/10 text-[#d4ff3f]"
                : "bg-[#f59e0b]/10 text-[#f59e0b]"
            }`}>
              {bitgetTapeAvailable ? "Bitget 24/7 Tape" : "Bitget Tape Partial"}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-[#a0b0bf]">
            <span className="text-[#718190]">Regime:</span>
            <span className="font-semibold text-white">{meta?.regime ?? briefing.regime ?? "Normal"}</span>
          </div>
        </div>

        {/* Right: Decision Record jump + Dual Download + Pipeline Summary */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() =>
              document.getElementById("decision-record")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            data-tour="tour-journal-jump"
            className="group flex min-h-[40px] sm:min-h-0 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-sm border border-white/[0.14] bg-[#0c1015] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#c8d4df] transition hover:border-[#d4ff3f] hover:bg-[#d4ff3f]/[0.05] hover:text-white shadow-sm"
            title="Jump to the Trader Decision Record at the end of the memo"
          >
            <span className="text-[#d4ff3f] transition-transform duration-200 group-hover:translate-y-0.5">↓</span>
            <span>Journal</span>
          </button>

          {/* Dual Export Actions */}
          <div className="flex flex-wrap items-center gap-2" data-tour="tour-exports">
          <button
            type="button"
            onClick={() => handleDownload("executive")}
            disabled={downloadMode !== null}
            className="group flex min-h-[40px] sm:min-h-0 flex-1 sm:flex-none items-center justify-center gap-2 rounded-sm border border-[#d4ff3f]/60 bg-[#d4ff3f]/[0.10] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#d4ff3f] transition hover:bg-[#d4ff3f] hover:text-[#080b0e] hover:shadow-[0_0_15px_rgba(212,255,63,0.3)] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            title="Download concise 4-slide Executive Briefing (.pptx) with key takeaways and plan considerations"
          >
            {downloadMode === "executive" ? (
              <>
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Building…</span>
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M4 21h16" />
                </svg>
                <span>Summary .pptx</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleDownload("full")}
            disabled={downloadMode !== null}
            className="group flex min-h-[40px] sm:min-h-0 flex-1 sm:flex-none items-center justify-center gap-2 rounded-sm border border-white/[0.18] bg-[#0c1015] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#c8d4df] transition hover:border-[#d4ff3f] hover:text-[#d4ff3f] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
            title="Download complete institutional Quantitative Dossier (.pptx) with all trajectory charts and deep telemetry"
          >
            {downloadMode === "full" ? (
              <>
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Building…</span>
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Quant Dossier .pptx</span>
              </>
            )}
          </button>
          </div>

          <PipelineSummary statuses={statuses} pillarData={pillarData} />
        </div>
      </div>


      <div data-tour="tour-reweight" className="mb-6 sm:mb-8 rounded-sm border border-white/[0.08] bg-[#0c1016]/85 p-3.5 sm:p-4 shadow-sm backdrop-blur-md">
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
      <div data-tour="tour-memo">
      <ResearchMemo
        briefing={briefing}
        style={style}
        pillarData={pillarData}
        decisionNote={decisionNote}
        onDecisionNoteChange={onDecisionNoteChange}
      />
      </div>

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
