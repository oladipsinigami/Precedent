"use client";

import { useState } from "react";
import type { PillarBundle, PillarId, PillarStatus } from "@/lib/types";

export type { PillarStatus };
export type PillarState = Record<PillarId, PillarStatus>;

export const PILLARS: {
  id: PillarId;
  label: string;
  short: string;
  description: string;
  runningMessage: string;
}[] = [
  {
    id: "fundamentals",
    label: "Fundamentals",
    short: "SEC Filings & SimFin Statements",
    description: "Reported corporate financials, SEC XBRL revenue & EPS filings, and verified catalysts.",
    runningMessage: "Examining SEC filings & corporate financials…",
  },
  {
    id: "technicals",
    label: "Technicals & Tape",
    short: "24/7 Venue Tape & Price Structure",
    description: "Live Bitget rToken order flow, 24/7 basis spread, and multi-timeframe quantitative indicators.",
    runningMessage: "Calibrating 24/7 tape & multi-source indicators…",
  },
  {
    id: "news",
    label: "News & Macro",
    short: "Multi-Channel News & Social Discourse",
    description: "Alpha Vantage institutional news, Adanos Reddit/X BuzzScore, and macro headlines.",
    runningMessage: "Scanning verified news & social discourse…",
  },
  {
    id: "analogs",
    label: "Historical Analogs",
    short: "10-Year Historical Pattern Precedents",
    description: "Empirical chart trajectory matching with unsigned historical outcome distributions.",
    runningMessage: "Matching 10-year historical chart patterns…",
  },
  {
    id: "marketStructure",
    label: "Market Structure",
    short: "RMT Peer Communities",
    description: "Precomputed peer communities from market-mode-removed co-movement, with a Marcenko-Pastur signal-versus-noise diagnostic.",
    runningMessage: "Resolving RMT peer communities…",
  },
];

function StatusIndicator({
  status,
  runningText,
}: {
  status: PillarStatus;
  runningText: string;
}) {
  switch (status) {
    case "ready":
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#d4ff3f]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#d4ff3f]/15 text-[10px]">
            ✓
          </span>
          <span>Ready</span>
        </span>
      );
    case "degraded":
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#f59e0b]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f59e0b]/15 text-[10px]">
            ▲
          </span>
          <span>Degraded</span>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#f07867]">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f07867]/15 text-[10px]">
            ✕
          </span>
          <span>Failed</span>
        </span>
      );
    case "running":
      return (
        <span className="inline-flex items-center gap-2 font-mono text-[11px] text-[#75b8ff]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#75b8ff] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#75b8ff]" />
          </span>
          <span className="truncate max-w-[220px] sm:max-w-[280px]">{runningText}</span>
        </span>
      );
    case "pending":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#556472]">
          <span className="h-2 w-2 rounded-full border border-[#556472]/60" />
          <span>Pending</span>
        </span>
      );
  }
}

export function PipelineChecklist({
  statuses,
  messages = {},
  stage = "pillars",
  busy = false,
}: {
  statuses: PillarState;
  messages?: Record<string, string>;
  stage?: "idle" | "pillars" | "synthesis" | "complete";
  busy?: boolean;
}) {
  const [manualExpanded, setManualExpanded] = useState(false);
  const isSynthesis = stage === "synthesis";

  const readyCount = PILLARS.filter((p) => statuses[p.id] === "ready").length;
  const runningCount = PILLARS.filter((p) => statuses[p.id] === "running").length;
  const degradedCount = PILLARS.filter((p) => statuses[p.id] === "degraded").length;

  // When synthesis starts, collapse/minimize the checklist so the focus transitions smoothly
  const isMinimized = isSynthesis && !manualExpanded;

  if (isMinimized) {
    return (
      <div className="mt-6 rounded-sm border border-[#75b8ff]/30 bg-[#0a1017]/90 px-4 py-3 shadow-lg backdrop-blur-xl transition-all">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#75b8ff] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#75b8ff]" />
            </span>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Evidence Streams Verified ({readyCount}/{PILLARS.length} Ready) · Synthesizing Research Memo…
            </span>
          </div>
          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            className="font-mono text-[10px] uppercase tracking-wider text-[#75b8ff] hover:text-white transition text-left sm:text-right"
          >
            ▼ Show Checklist
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-sm border border-[#75b8ff]/25 bg-[#0a1017]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl transition-all">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${
              isSynthesis
                ? "bg-[#75b8ff] animate-pulse"
                : busy || runningCount > 0
                ? "bg-[#75b8ff] animate-pulse"
                : readyCount === PILLARS.length
                ? "bg-[#d4ff3f]"
                : degradedCount > 0
                ? "bg-[#f59e0b]"
                : "bg-[#556472]"
            }`}
          />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white">
            {isSynthesis
              ? "Synthesis in progress · Preparing Memo"
              : `Verification Pipeline Progress (${readyCount}/${PILLARS.length} Verified)`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#718090]">
            {isSynthesis ? "Synthesizing..." : busy ? "Polling parallel feeds" : "Ready"}
          </span>
          {isSynthesis && (
            <button
              type="button"
              onClick={() => setManualExpanded(false)}
              className="font-mono text-[10px] uppercase text-[#75b8ff] hover:text-white transition"
            >
              ▲ Minimize
            </button>
          )}
        </div>
      </div>

      {/* Compact Vertical Checklist of the Five Evidence Streams */}
      <div className="mt-3 divide-y divide-white/[0.05]">
        {PILLARS.map((pillar, idx) => {
          const status = statuses[pillar.id] ?? "pending";
          const isRunning = status === "running";
          const runningMsg = messages[pillar.id] || pillar.runningMessage;

          return (
            <div
              key={pillar.id}
              className={`flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between py-2.5 px-2 transition-colors ${
                isRunning ? "bg-white/[0.02] rounded-sm" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[10px] text-[#556472]">0{idx + 1}</span>
                <span className="text-xs font-medium text-[#d3dce4] truncate">
                  {pillar.label}
                </span>
                <span className="hidden md:inline text-[10px] text-[#617180] truncate">
                  · {pillar.short}
                </span>
              </div>

              <div className="pl-6 sm:pl-0 shrink-0">
                <StatusIndicator status={status} runningText={runningMsg} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineSummary({
  statuses,
  pillarData,
}: {
  statuses: PillarState;
  pillarData: PillarBundle | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const readyCount = PILLARS.filter((p) => statuses[p.id] === "ready").length;
  const degradedCount = PILLARS.filter((p) => statuses[p.id] === "degraded").length;
  const failedCount = PILLARS.filter((p) => statuses[p.id] === "failed").length;

  const caveats: { pillar: string; text: string }[] = [];
  if (pillarData?.fundamentals && !pillarData.fundamentals.ok) {
    caveats.push({
      pillar: "Fundamentals",
      text: pillarData.fundamentals.error || "SEC filings or company financials data degraded.",
    });
  }
  if (pillarData?.technicals && !pillarData.technicals.ok) {
    caveats.push({
      pillar: "Technicals & Tape",
      text: pillarData.technicals.error || "Live technical indicator or venue order flow degraded.",
    });
  }
  if (pillarData?.news && !pillarData.news.ok) {
    caveats.push({
      pillar: "News & Macro",
      text: pillarData.news.error || "News coverage or social discourse streams degraded.",
    });
  } else if (pillarData?.news?.caveats?.length) {
    pillarData.news.caveats.forEach((c) => caveats.push({ pillar: "News & Macro", text: c }));
  }
  if (pillarData?.analogs && !pillarData.analogs.ok) {
    caveats.push({
      pillar: "Historical Analogs",
      text: pillarData.analogs.error || "Historical pattern comparison feeds degraded.",
    });
  } else if (pillarData?.analogs?.caveats?.length) {
    pillarData.analogs.caveats.forEach((c) => caveats.push({ pillar: "Historical Analogs", text: c }));
  }
  if (pillarData?.marketStructure) {
    if (!pillarData.marketStructure.ok) {
      caveats.push({
        pillar: "Market Structure",
        text: pillarData.marketStructure.error || "RMT peer-community snapshot degraded.",
      });
    } else if (pillarData.marketStructure.stale) {
      caveats.push({
        pillar: "Market Structure",
        text: `Snapshot computed ${pillarData.marketStructure.computedAt ?? "at an unknown time"} is stale; refresh the scheduled precompute.`,
      });
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full sm:w-auto min-h-[44px] sm:min-h-0 items-center justify-between sm:justify-start gap-2 rounded-sm border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-[#a0b0be] transition hover:border-white/20 hover:text-white"
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              failedCount > 0
                ? "bg-[#f07867]"
                : degradedCount > 0
                ? "bg-[#f59e0b]"
                : "bg-[#d4ff3f]"
            }`}
          />
          <span>
            Pipeline Summary: {readyCount}/{PILLARS.length} Ready
            {degradedCount > 0 ? ` (${degradedCount} Degraded)` : ""}
            {failedCount > 0 ? ` (${failedCount} Failed)` : ""}
          </span>
        </div>
        <span className="text-xs text-[#718090]">{expanded ? "▲ Hide" : "▼ Audit"}</span>
      </button>

      {expanded && (
        <div className="mt-3 rounded-sm border border-white/[0.08] bg-[#0c1015]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#a0b0be]">
              Pipeline Verification Summary
            </div>
            <span className="font-mono text-[10px] text-[#617180]">Five Evidence Streams</span>
          </div>

          <div className="mt-3 divide-y divide-white/[0.04]">
            {PILLARS.map((p, idx) => {
              const st = statuses[p.id] ?? "pending";
              return (
                <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#556472]">0{idx + 1}</span>
                    <span className="font-medium text-[#c8d4e0]">{p.label}</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                      st === "ready"
                        ? "bg-[#d4ff3f]/10 text-[#d4ff3f]"
                        : st === "degraded"
                        ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                        : st === "failed"
                        ? "bg-[#f07867]/10 text-[#f07867]"
                        : "text-[#556472]"
                    }`}
                  >
                    {st}
                  </span>
                </div>
              );
            })}
          </div>

          {caveats.length > 0 ? (
            <div className="mt-3.5 rounded border border-[#f59e0b]/25 bg-[#f59e0b]/[0.05] p-3">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#f59e0b]">
                Degradation Caveats ({caveats.length})
              </div>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-[#d97706]">
                {caveats.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="font-semibold text-[#f59e0b] shrink-0">[{c.pillar}]:</span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-3 border-t border-white/[0.06] pt-2 text-[11px] text-[#637382]">
              All five evidence streams converged with full source verification and zero degradation caveats.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineSidebar(props: {
  statuses: PillarState;
  meta?: { native: string; name: string; regime: string } | null;
  hasResults?: boolean;
  busy?: boolean;
}) {
  return <PipelineChecklist statuses={props.statuses} busy={props.busy} />;
}
