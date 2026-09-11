"use client";

import { useState } from "react";
import { ResearchMemo } from "./ResearchMemo";
import { PILLARS, PillarState } from "./PipelineSidebar";
import { STYLES } from "@/lib/style-profiles";
import type { Briefing, PillarBundle, TradingStyle } from "@/lib/types";

interface ResultsViewProps {
  briefing: Briefing;
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
  const [showTelemetryTray, setShowTelemetryTray] = useState(false);
  const readyCount = PILLARS.filter((p) => statuses[p.id] === "ready").length;
  const degradedCount = PILLARS.filter((p) => statuses[p.id] === "degraded").length;

  return (
    <div className="mx-auto max-w-[1360px] py-6 sm:py-10">
      {/* Top Action & Navigation Strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        {/* Left: Return to Intake Button */}
        <button
          type="button"
          onClick={onBackToIntake}
          className="group flex items-center gap-2.5 rounded-sm border border-white/[0.12] bg-[#0c1015] px-4 py-2 text-xs font-medium text-[#c8d4df] transition hover:border-[#d4ff3f] hover:bg-white/[0.04] hover:text-white"
        >
          <span className="font-mono text-sm transition-transform duration-200 group-hover:-translate-x-1">
            ←
          </span>
          <span className="font-mono uppercase tracking-wider text-[11px]">
            Return to Intake Console
          </span>
        </button>

        {/* Center: Target Instrument & Venue context */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-sm border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 font-mono text-xs text-[#a0b0bf]">
            <span className="font-bold text-white">{meta?.native ?? symbol}</span>
            <span className="text-[#556472]">·</span>
            <span className="truncate max-w-[180px]">{meta?.name ?? "Asset"}</span>
            <span className="text-[#556472]">·</span>
            <span className="rounded bg-[#d4ff3f]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#d4ff3f]">
              Bitget 7×24
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-[#a0b0bf]">
            <span className="text-[#718190]">Regime:</span>
            <span className="font-semibold text-white">{meta?.regime ?? briefing.regime ?? "Normal"}</span>
          </div>
        </div>

        {/* Right: Evidence Verification Tray Toggle */}
        <button
          type="button"
          onClick={() => setShowTelemetryTray((prev) => !prev)}
          className="flex items-center gap-2 rounded-sm border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-[#a0b0be] transition hover:border-white/20 hover:text-white"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff3f]" />
          <span>
            Pipeline: {readyCount}/5 Ready {degradedCount > 0 ? `(${degradedCount} Degraded)` : ""}
          </span>
          <span className="text-xs text-[#718090]">{showTelemetryTray ? "▲ Hide" : "▼ Audit"}</span>
        </button>
      </div>

      {/* Expandable Evidence Stream Telemetry Tray */}
      {showTelemetryTray && (
        <div className="mb-8 rounded-sm border border-white/[0.08] bg-[#0c1015]/95 p-5 shadow-2xl backdrop-blur-xl transition-all">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#a0b0be]">
              Evidence Stream Telemetry & Disaggregation
            </div>
            <span className="font-mono text-[10px] text-[#617180]">
              All 5 models polled in parallel
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            {PILLARS.map((pillar, idx) => {
              const status = statuses[pillar.id];
              return (
                <div
                  key={pillar.id}
                  className="rounded border border-white/[0.06] bg-black/25 p-3"
                >
                  <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-[#637382]">
                    <span>0{idx + 1}</span>
                    <span
                      className={`font-semibold ${
                        status === "ready"
                          ? "text-[#d4ff3f]"
                          : status === "degraded"
                          ? "text-[#f59e0b]"
                          : "text-[#75b8ff]"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-[#d3dce4]">{pillar.label}</div>
                  <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-[#60707e]">
                    {pillar.short}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] text-[#637382]">
            <span className="font-semibold text-[#8b9aa8]">Separation of Sources: </span>
            Bitget venue order tape is segregated from the underlying cash market. Missing or unavailable sources are flagged as explicit caveats rather than estimated.
          </div>
        </div>
      )}

      {/* In-Place Style Frame Re-weighting Selector */}
      <div className="mb-8 rounded-sm border border-white/[0.07] bg-[#0c1016]/80 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8e9ca8]">
              Operating Frame Re-weighting
            </div>
            <div className="text-xs text-[#637382]">
              Switching perspective adapts the briefing considerations and analog horizons without re-running data feeds.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(STYLES) as TradingStyle[]).map((st) => {
              const isSelected = style === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStyleChange(st)}
                  className={`rounded-sm border px-3.5 py-1.5 font-mono text-xs font-medium transition ${
                    isSelected
                      ? "border-[#d4ff3f] bg-[#d4ff3f]/10 text-white shadow-[0_0_12px_rgba(212,255,63,0.15)]"
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
      <div className="mt-10 flex items-center justify-between border-t border-white/[0.08] pt-6">
        <button
          type="button"
          onClick={onBackToIntake}
          className="group flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#d4ff3f] transition hover:text-white"
        >
          <span className="transition-transform group-hover:-translate-x-1">←</span>
          <span>Return to Research Intake Console</span>
        </button>

        <div className="text-right text-[11px] text-[#637382]">
          Precedent Research Desk · All empirical distributions strictly non-directional
        </div>
      </div>
    </div>
  );
}
