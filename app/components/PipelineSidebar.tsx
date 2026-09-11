"use client";

import { useState } from "react";
import type { PillarId } from "@/lib/types";

export type PillarStatus = "idle" | "running" | "ready" | "degraded";
export type PillarState = Record<PillarId, PillarStatus>;

export const PILLARS: { id: PillarId; label: string; short: string; description: string }[] = [
  {
    id: "marketStructure",
    label: "Market Structure",
    short: "RMT eigenstructure & regime",
    description: "Random matrix theory filter to separate market mode from asset-specific signals.",
  },
  {
    id: "analogs",
    label: "Historical Analogs",
    short: "Base rates stress test",
    description: "Multi-session trajectory matching with unsigned excess return distributions.",
  },
  {
    id: "technicals",
    label: "Venue Tape",
    short: "Cash vs Bitget 7×24",
    description: "Bitget rToken order flow, 24h delta, and cash session basis spread.",
  },
  {
    id: "news",
    label: "Discourse & Social",
    short: "News / X / YouTube",
    description: "Multi-channel sentiment and volume density without algorithmic direction.",
  },
  {
    id: "fundamentals",
    label: "Fundamentals",
    short: "SEC filings & catalysts",
    description: "Reported earnings, revenue surprises, and calendar corporate catalysts.",
  },
];

interface PipelineSidebarProps {
  statuses: PillarState;
  meta: { native: string; name: string; regime: string } | null;
  hasResults?: boolean;
  busy?: boolean;
}

export function PipelineSidebar({ statuses, meta, hasResults = false, busy = false }: PipelineSidebarProps) {
  const [expanded, setExpanded] = useState(!hasResults);

  const readyCount = PILLARS.filter((p) => statuses[p.id] === "ready").length;
  const runningCount = PILLARS.filter((p) => statuses[p.id] === "running").length;
  const degradedCount = PILLARS.filter((p) => statuses[p.id] === "degraded").length;

  return (
    <aside
      className={`rounded-sm border border-white/[0.08] bg-[#0c1015]/85 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 ${
        hasResults ? "mb-8" : ""
      }`}
    >
      {/* Header with expand/collapse control when results exist */}
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                busy
                  ? "animate-pulse bg-[#75b8ff]"
                  : readyCount === 5
                  ? "bg-[#d4ff3f]"
                  : degradedCount > 0
                  ? "bg-[#f59e0b]"
                  : "bg-[#52616f]"
              }`}
            />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#a0b0be]">
              Evidence Pipeline
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-[#617180]">
            {meta ? (
              <span>
                {meta.native} ({meta.name}) · <span className="text-[#9ab0c2]">{meta.regime}</span>
              </span>
            ) : busy ? (
              <span className="text-[#75b8ff]">Synthesizing across 5 streams...</span>
            ) : (
              "Standing by for research intake"
            )}
          </div>
        </div>

        {hasResults ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-2 rounded border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase text-[#a0b0be] transition hover:border-white/20 hover:text-white"
          >
            <span>
              {readyCount}/5 Ready
              {degradedCount > 0 ? ` (${degradedCount} Degraded)` : ""}
            </span>
            <span className="text-xs">{expanded ? "▴" : "▾"}</span>
          </button>
        ) : (
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#617180]">
            {runningCount > 0 ? (
              <span className="text-[#75b8ff]">{runningCount} active</span>
            ) : (
              <span>{readyCount}/5 streams</span>
            )}
          </div>
        )}
      </div>

      {/* Main Pillar Rows - Collapsible if results are already rendered to reduce clutter */}
      {expanded && (
        <>
          <div className="divide-y divide-white/[0.05] px-3 py-2">
            {PILLARS.map((pillar, index) => {
              const status = statuses[pillar.id];
              return (
                <div
                  key={pillar.id}
                  className="group flex items-center justify-between px-3 py-3 transition hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-mono text-[10px] text-[#526270]">
                      0{index + 1}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        status === "ready"
                          ? "bg-[#d4ff3f] shadow-[0_0_6px_#d4ff3f]"
                          : status === "degraded"
                          ? "bg-[#f59e0b] shadow-[0_0_6px_#f59e0b]"
                          : status === "running"
                          ? "animate-ping bg-[#75b8ff]"
                          : "bg-[#35404d]"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#d3dce4] group-hover:text-white">
                        {pillar.label}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-[#637382]">
                        {pillar.short}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded ${
                      status === "ready"
                        ? "bg-[#d4ff3f]/10 text-[#d4ff3f]"
                        : status === "degraded"
                        ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                        : status === "running"
                        ? "bg-[#75b8ff]/10 text-[#75b8ff]"
                        : "text-[#556472]"
                    }`}
                  >
                    {status === "idle" ? "Queued" : status === "running" ? "Polling" : status}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/[0.06] bg-black/20 px-5 py-3 text-[11px] leading-relaxed text-[#657685]">
            <span className="font-semibold text-[#8b9ba8]">Methodology:</span> Bitget venue tape is kept strictly isolated from the cash market. Missing sources are flagged as explicit caveats rather than estimated.
          </div>
        </>
      )}
    </aside>
  );
}
