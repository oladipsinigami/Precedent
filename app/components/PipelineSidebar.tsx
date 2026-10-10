"use client";

import { useEffect, useRef, useState } from "react";
import { animate, createDrawable, stagger, utils } from "animejs";
import { MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";
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

const C3_WITNESS_NODES = [
  {
    index: 0,
    id: "technicals" as const,
    label: "Live Tape & Basis",
    sub: "Bitget 24/7 Venue",
    posClass: "left-2.5 top-2.5",
    x1: 124,
    y1: 36,
  },
  {
    index: 1,
    id: "analogs" as const,
    label: "10-Yr Analogs",
    sub: "Empirical Precedents",
    posClass: "right-2.5 top-2.5",
    x1: 476,
    y1: 36,
  },
  {
    index: 2,
    id: "news" as const,
    label: "News & Social",
    sub: "Multi-Channel Flow",
    posClass: "left-2.5 bottom-2.5",
    x1: 124,
    y1: 148,
  },
  {
    index: 3,
    id: "fundamentals" as const,
    label: "Fundamentals & RMT",
    sub: "SEC Filings + Peers",
    posClass: "right-2.5 bottom-2.5",
    x1: 476,
    y1: 148,
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
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-lime">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-lime/15 text-[10px]">
            ✓
          </span>
          <span>Ready</span>
        </span>
      );
    case "degraded":
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-amber">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber/15 text-[10px]">
            ▲
          </span>
          <span>Degraded</span>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-alert">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-alert/15 text-[10px]">
            ✕
          </span>
          <span>Failed</span>
        </span>
      );
    case "running":
      return (
        <span className="inline-flex items-center gap-2 font-mono text-[11px] text-sky">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky" />
          </span>
          <span className="truncate max-w-[220px] sm:max-w-[280px]">{runningText}</span>
        </span>
      );
    case "pending":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate">
          <span className="h-2 w-2 rounded-full border border-slate/60" />
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
  symbol,
  style,
  isDemoRunning = false,
}: {
  statuses: PillarState;
  messages?: Record<string, string>;
  stage?: "idle" | "pillars" | "synthesis" | "complete";
  busy?: boolean;
  symbol?: string;
  style?: string;
  isDemoRunning?: boolean;
}) {
  const [manualMinimized, setManualMinimized] = useState(false);
  const drawnWitnessesRef = useRef<Record<number, boolean>>({});
  const drawnPillarsRef = useRef<Record<string, boolean>>({});
  const hubAnimatedRef = useRef(false);
  const isSynthesis = stage === "synthesis";

  const readyCount = PILLARS.filter((p) => statuses[p.id] === "ready").length;
  const runningCount = PILLARS.filter((p) => statuses[p.id] === "running").length;
  const degradedCount = PILLARS.filter((p) => statuses[p.id] === "degraded").length;

  const { rootRef } = useAnimeScope<HTMLDivElement>(
    ({ root }) => {
      drawnWitnessesRef.current = {};
      drawnPillarsRef.current = {};
      hubAnimatedRef.current = false;

      animate(root, {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 240,
        ease: MOTION_EASE.default,
      });

      const frame = root.querySelectorAll<SVGGeometryElement>("[data-anim='c3-frame']");
      if (frame.length > 0) {
        const drawableFrame = createDrawable(frame, 0, 0);
        animate(drawableFrame, {
          draw: "0 1",
          duration: 380,
          ease: MOTION_EASE.expo,
        });
      }

      const lines = root.querySelectorAll<SVGGeometryElement>("[data-anim='c3-line']");
      if (lines.length > 0) {
        createDrawable(lines, 0, 0);
      }

      const rows = root.querySelectorAll<HTMLElement>("[data-anim='c3-row']");
      if (rows.length > 0) {
        utils.set(rows, { opacity: 0, translateY: 5 });
        animate(rows, {
          opacity: [0, 1],
          translateY: [5, 0],
          duration: 220,
          delay: stagger(35, { start: 60 }),
          ease: MOTION_EASE.default,
        });
      }
    },
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const isResolved = (st: PillarStatus | undefined) =>
      st === "ready" || st === "degraded" || st === "failed";

    const witnessResolved = [
      isResolved(statuses.technicals),
      isResolved(statuses.analogs),
      isResolved(statuses.news),
      isResolved(statuses.fundamentals) && isResolved(statuses.marketStructure),
    ];

    let batchOrder = 0;
    witnessResolved.forEach((resolved, idx) => {
      if (!resolved || drawnWitnessesRef.current[idx]) return;
      drawnWitnessesRef.current[idx] = true;

      const nodeMeta = C3_WITNESS_NODES[idx];
      const lineEl = root.querySelector<SVGGeometryElement>(`[data-c3-line="${idx}"]`);
      const dotEl = root.querySelector<SVGCircleElement>(`[data-c3-dot="${idx}"]`);
      const nodeEl = root.querySelector<HTMLElement>(`[data-c3-node="${idx}"]`);
      const barEl = root.querySelector<HTMLElement>(`[data-c3-bar="${idx}"]`);
      const delayMs = 70 + batchOrder * 190;
      batchOrder += 1;

      if (reduceMotion) {
        if (lineEl) createDrawable(lineEl, 0, 1);
        if (nodeEl) utils.set(nodeEl, { opacity: 1, scale: 1 });
        if (barEl) utils.set(barEl, { scaleX: 1, opacity: 1 });
        return;
      }

      if (nodeEl) {
        animate(nodeEl, {
          scale: [0.96, 1.02, 1],
          translateY: [2, 0],
          duration: 260,
          delay: delayMs,
          ease: MOTION_EASE.default,
        });
      }

      if (barEl) {
        utils.set(barEl, { scaleX: 0, opacity: 1, transformOrigin: "left center" });
        animate(barEl, {
          scaleX: [0, 1],
          duration: 320,
          delay: delayMs,
          ease: MOTION_EASE.expo,
        });
      }

      if (lineEl) {
        const drawable = createDrawable(lineEl, 0, 0);
        animate(drawable, {
          draw: "0 1",
          duration: 380,
          delay: delayMs + 30,
          ease: MOTION_EASE.expo,
        });
      }

      if (dotEl && nodeMeta) {
        const dx = 300 - nodeMeta.x1;
        const dy = 92 - nodeMeta.y1;
        utils.set(dotEl, { translateX: 0, translateY: 0, opacity: 0 });
        animate(dotEl, {
          translateX: [0, dx],
          translateY: [0, dy],
          opacity: [0, 1, 0],
          duration: 380,
          delay: delayMs + 30,
          ease: MOTION_EASE.expo,
        });
      }
    });

    PILLARS.forEach((pillar, idx) => {
      if (!isResolved(statuses[pillar.id]) || drawnPillarsRef.current[pillar.id]) return;
      drawnPillarsRef.current[pillar.id] = true;
      const pBar = root.querySelector<HTMLElement>(`[data-pillar-bar="${pillar.id}"]`);
      if (!pBar) return;
      if (reduceMotion) {
        utils.set(pBar, { scaleX: 1, opacity: 1 });
        return;
      }
      utils.set(pBar, { scaleX: 0, opacity: 1, transformOrigin: "left center" });
      animate(pBar, {
        scaleX: [0, 1],
        duration: 300,
        delay: 60 + idx * 140,
        ease: MOTION_EASE.expo,
      });
    });

    const allResolved = witnessResolved.every(Boolean) || isSynthesis;
    if (allResolved && !hubAnimatedRef.current) {
      hubAnimatedRef.current = true;
      const hubEl = root.querySelector<HTMLElement>("[data-anim='c3-hub']");
      const hubBar = root.querySelector<HTMLElement>("[data-anim='c3-hub-bar']");
      const hubDelay = batchOrder > 0 ? 90 + batchOrder * 185 : 0;

      if (reduceMotion) {
        if (hubEl) utils.set(hubEl, { opacity: 1, scale: 1 });
        if (hubBar) utils.set(hubBar, { scaleX: 1, opacity: 1 });
        return;
      }

      if (hubEl) {
        animate(hubEl, {
          scale: [0.94, 1.03, 1],
          opacity: [0.78, 1],
          duration: 320,
          delay: hubDelay,
          ease: MOTION_EASE.default,
        });
      }
      if (hubBar) {
        utils.set(hubBar, { scaleX: 0, opacity: 1, transformOrigin: "left center" });
        animate(hubBar, {
          scaleX: [0, 1],
          duration: 380,
          delay: hubDelay + 40,
          ease: MOTION_EASE.expo,
        });
      }
    }
  }, [
    statuses,
    isSynthesis,
    rootRef,
  ]);

  if (manualMinimized) {
    return (
      <div
        ref={rootRef}
        data-anim="pipeline-handoff"
        className="mt-5 rounded-sm border border-lime/35 bg-ink/95 px-4 py-3 shadow-lg backdrop-blur-xl transition-all"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
            </span>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-white">
              Evidence Streams Verified ({readyCount}/{PILLARS.length} Ready) · Synthesizing Research Memo…
            </span>
          </div>
          <button
            type="button"
            onClick={() => setManualMinimized(false)}
            className="font-mono text-[10px] uppercase tracking-wider text-lime hover:text-white transition text-left sm:text-right"
          >
            ▼ Show Convergence
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-anim="pipeline-handoff"
      className="mt-5 rounded-sm border border-lime/30 bg-ink/95 p-4 sm:p-5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all"
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${
              isSynthesis || readyCount === PILLARS.length
                ? "bg-lime animate-pulse"
                : busy || runningCount > 0
                ? "bg-sky animate-pulse"
                : degradedCount > 0
                ? "bg-amber"
                : "bg-slate"
            }`}
          />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white">
            {isSynthesis
              ? "Witness Convergence Complete · Synthesizing Desk Note"
              : isDemoRunning
              ? `Recommended Demo Convergence · ${symbol || "AAPL"} (${style || "swing"})`
              : `Witness Convergence Progress (${readyCount}/${PILLARS.length} Verified)`}
          </span>
          {isDemoRunning && (
            <span className="rounded-sm border border-lime/35 bg-lime/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-lime">
              AAPL Swing Benchmark
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-slate-line">
            {isSynthesis
              ? "Converging evidence streams into Desk Note…"
              : busy
              ? "Cross-examining 4 parallel witnesses"
              : "Ready"}
          </span>
          <button
            type="button"
            onClick={() => setManualMinimized(true)}
            className="font-mono text-[10px] uppercase text-lime hover:text-white transition"
          >
            ▲ Minimize
          </button>
        </div>
      </div>

      {/* C3: Four Witness Convergence Diagram */}
      <div className="relative mt-3.5 h-44 sm:h-48 w-full overflow-hidden rounded-sm border border-white/[0.08] bg-blot/90 p-3">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 600 184"
          preserveAspectRatio="none"
        >
          <rect
            data-anim="c3-frame"
            x="4"
            y="4"
            width="592"
            height="176"
            rx="2"
            fill="none"
            stroke="rgba(212, 255, 63, 0.16)"
            strokeWidth="1"
          />
          <line
            x1="300"
            y1="14"
            x2="300"
            y2="170"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <line
            x1="30"
            y1="92"
            x2="570"
            y2="92"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          {C3_WITNESS_NODES.map((w) => (
            <line
              key={`guide-${w.index}`}
              x1={w.x1}
              y1={w.y1}
              x2="300"
              y2="92"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ))}
          {C3_WITNESS_NODES.map((w) => {
            const st = statuses[w.id];
            const strokeColor =
              st === "degraded"
                ? "rgba(245, 158, 11, 0.8)"
                : st === "failed"
                ? "rgba(248, 113, 113, 0.8)"
                : "rgba(212, 255, 63, 0.88)";
            return (
              <g key={`active-${w.index}`}>
                <line
                  data-anim="c3-line"
                  data-c3-line={w.index}
                  x1={w.x1}
                  y1={w.y1}
                  x2="300"
                  y2="92"
                  stroke={strokeColor}
                  strokeWidth="1.8"
                />
                <circle
                  data-c3-dot={w.index}
                  cx={w.x1}
                  cy={w.y1}
                  r="3.2"
                  fill="#d4ff3f"
                  opacity="0"
                />
              </g>
            );
          })}
        </svg>

        {C3_WITNESS_NODES.map((w) => {
          const st =
            w.id === "fundamentals" && statuses.fundamentals === "ready" && statuses.marketStructure === "degraded"
              ? "degraded"
              : statuses[w.id];
          const isReady = st === "ready";
          const isDegraded = st === "degraded";
          return (
            <div
              key={w.id}
              data-c3-node={w.index}
              className={`absolute ${w.posClass} overflow-hidden rounded-sm border px-2.5 py-1.5 font-mono text-[10px] transition-colors ${
                isReady
                  ? "border-lime/55 bg-ink/95 text-white shadow-[0_0_16px_rgba(212,255,63,0.12)]"
                  : isDegraded
                  ? "border-amber/50 bg-ink/95 text-amber"
                  : "border-white/[0.1] bg-ink/90 text-slate-text"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isReady
                      ? "bg-lime shadow-[0_0_8px_var(--c-lime)]"
                      : isDegraded
                      ? "bg-amber"
                      : "bg-sky animate-pulse"
                  }`}
                />
                <span className="font-semibold">{w.label}</span>
                {isReady && (
                  <span className="ml-0.5 text-[9px] text-lime font-bold">✓</span>
                )}
              </div>
              <div className="mt-0.5 hidden sm:block text-[9px] text-slate-line">
                {w.sub}
              </div>
              <span
                aria-hidden="true"
                data-c3-bar={w.index}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-lime opacity-0"
              />
            </div>
          );
        })}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            data-anim="c3-hub"
            className={`relative overflow-hidden rounded-sm border px-4 py-2 text-center shadow-[0_0_28px_rgba(0,0,0,0.85)] transition-colors ${
              isSynthesis || readyCount === PILLARS.length
                ? "border-lime/65 bg-ink text-lime"
                : "border-white/15 bg-ink/95 text-slate-pale"
            }`}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-lime">
              Clerk of Evidence
            </div>
            <div className="mt-0.5 font-display text-xs sm:text-sm font-medium text-white">
              {isSynthesis || readyCount === PILLARS.length
                ? `Synthesizing ${symbol || "AAPL"} Desk Note…`
                : `${readyCount}/${PILLARS.length} Streams Converged`}
            </div>
            <span
              aria-hidden="true"
              data-anim="c3-hub-bar"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-lime opacity-0"
            />
          </div>
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
              data-anim="c3-row"
              className={`relative flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between py-2 px-2 overflow-hidden transition-colors ${
                isRunning ? "bg-white/[0.02] rounded-sm" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[10px] text-slate">0{idx + 1}</span>
                <span className="text-xs font-medium text-slate-mid truncate">
                  {pillar.label}
                </span>
                <span className="hidden md:inline text-[10px] text-slate-line truncate">
                  · {pillar.short}
                </span>
              </div>

              <div className="pl-6 sm:pl-0 shrink-0">
                <StatusIndicator status={status} runningText={runningMsg} />
              </div>

              <span
                aria-hidden="true"
                data-pillar-bar={pillar.id}
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] origin-left scale-x-0 bg-lime/45 opacity-0"
              />
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
        className="flex w-full sm:w-auto min-h-[44px] sm:min-h-0 items-center justify-between sm:justify-start gap-2 rounded-sm border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-text transition hover:border-white/20 hover:text-white"
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              failedCount > 0
                ? "bg-alert"
                : degradedCount > 0
                ? "bg-amber"
                : "bg-lime"
            }`}
          />
          <span>
            Pipeline Summary: {readyCount}/{PILLARS.length} Ready
            {degradedCount > 0 ? ` (${degradedCount} Degraded)` : ""}
            {failedCount > 0 ? ` (${failedCount} Failed)` : ""}
          </span>
        </div>
        <span className="text-xs text-slate-line">{expanded ? "▲ Hide" : "▼ Audit"}</span>
      </button>

      {expanded && (
        <div className="mt-3 rounded-sm border border-white/[0.08] bg-ink/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-slate-text">
              Pipeline Verification Summary
            </div>
            <span className="font-mono text-[10px] text-slate-line">Five Evidence Streams</span>
          </div>

          <div className="mt-3 divide-y divide-white/[0.04]">
            {PILLARS.map((p, idx) => {
              const st = statuses[p.id] ?? "pending";
              return (
                <div key={p.id} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate">0{idx + 1}</span>
                    <span className="font-medium text-slate-mid">{p.label}</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                      st === "ready"
                        ? "bg-lime/10 text-lime"
                        : st === "degraded"
                        ? "bg-amber/10 text-amber"
                        : st === "failed"
                        ? "bg-alert/10 text-alert"
                        : "text-slate"
                    }`}
                  >
                    {st}
                  </span>
                </div>
              );
            })}
          </div>

          {caveats.length > 0 ? (
            <div className="mt-3.5 rounded border border-amber/25 bg-amber/[0.05] p-3">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber">
                Degradation Caveats ({caveats.length})
              </div>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-amber">
                {caveats.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="font-semibold text-amber shrink-0">[{c.pillar}]:</span>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-3 border-t border-white/[0.06] pt-2 text-[11px] text-slate-line">
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
