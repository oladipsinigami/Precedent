"use client";

import { useState } from "react";
import { animate, createDrawable, stagger, utils } from "animejs";
import { MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";
import { STYLES } from "@/lib/style-profiles";
import type { PillarBundle, TradingStyle } from "@/lib/types";

interface MemoSchematicProps {
  style: TradingStyle;
  pillarData: PillarBundle | null;
  sampleSize: number;
  basisSpread?: number | null;
  runId?: number;
  recalibrationKey?: number;
  onSelectStyle?: (style: TradingStyle) => void;
}

const STYLE_ORDER: TradingStyle[] = ["day", "swing", "event", "position"];

const RULER_TICK_COUNT = 28;

export function MemoSchematic({
  style,
  pillarData,
  sampleSize,
  basisSpread,
  runId = 0,
  recalibrationKey = 0,
  onSelectStyle,
}: MemoSchematicProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const styleIndex = Math.max(0, STYLE_ORDER.indexOf(style));
  const activeTickIndex = Math.round(((styleIndex + 0.5) / STYLE_ORDER.length) * (RULER_TICK_COUNT - 1));

  const tapeOk = Boolean(pillarData?.technicals?.ok);
  const analogsOk = Boolean(pillarData?.analogs?.ok && sampleSize > 0);
  const newsOk = Boolean(pillarData?.news?.ok);
  const fundOk = Boolean(pillarData?.fundamentals?.ok);
  const rmtOk = Boolean(pillarData?.marketStructure?.ok && !pillarData?.marketStructure?.stale);
  const riskVerdict = pillarData?.risk?.verdict ?? "UNAVAILABLE";

  const leftCallouts = [
    {
      id: "tape",
      label: "01 · live tape",
      detail:
        tapeOk && basisSpread !== undefined && basisSpread !== null
          ? `basis ${basisSpread >= 0 ? "+" : ""}${basisSpread.toFixed(2)}%`
          : tapeOk
            ? "7×24 venue active"
            : "venue partial",
      verified: tapeOk,
      // Elbow path from left label to upper-leftschematic ring
      path: "M 148 34 L 232 34 L 272 58",
      dotX: 272,
      dotY: 58,
      y: 34,
    },
    {
      id: "analogs",
      label: "02 · 10y analogs",
      detail: analogsOk ? `n=${sampleSize} · ${STYLES[style].analogHorizon}` : "0 matches",
      verified: analogsOk && sampleSize >= 30,
      path: "M 148 76 L 222 76 L 264 88",
      dotX: 264,
      dotY: 88,
      y: 76,
    },
    {
      id: "discourse",
      label: "03 · discourse",
      detail: newsOk
        ? `${(pillarData?.news?.headlines?.length ?? 0) + (pillarData?.news?.social?.x?.length ?? 0)} sources`
        : "stream partial",
      verified: newsOk,
      path: "M 148 118 L 234 118 L 276 114",
      dotX: 276,
      dotY: 114,
      y: 118,
    },
  ];

  const rightCallouts = [
    {
      id: "filings",
      label: "sec filings · 04",
      detail: fundOk ? "XBRL verified" : "CIK / partial",
      verified: fundOk,
      path: "M 532 34 L 448 34 L 408 58",
      dotX: 408,
      dotY: 58,
      y: 34,
    },
    {
      id: "rmt",
      label: "rmt structure · 05",
      detail: rmtOk
        ? `${pillarData?.marketStructure?.communityMembers?.length ?? 0} peer cohort`
        : pillarData?.marketStructure?.stale
          ? "snapshot stale"
          : "no cohort",
      verified: rmtOk,
      path: "M 532 76 L 458 76 L 416 88",
      dotX: 416,
      dotY: 88,
      y: 76,
    },
    {
      id: "sizing",
      label: "sizing check · 06",
      detail:
        riskVerdict === "FITS"
          ? "fits loss limit"
          : riskVerdict === "DOES_NOT_FIT"
            ? "exceeds limit"
            : "limit ungraded",
      verified: riskVerdict === "FITS" || riskVerdict === "DOES_NOT_FIT",
      path: "M 532 118 L 446 118 L 404 114",
      dotX: 404,
      dotY: 114,
      y: 118,
    },
  ];

  const { rootRef } = useAnimeScope<HTMLDivElement>(
    ({ root }) => {
      const rings = root.querySelectorAll<SVGGeometryElement>("[data-anim='schematic-ring']");
      const leaders = root.querySelectorAll<SVGGeometryElement>("[data-anim='schematic-leader']");
      const labels = root.querySelectorAll<SVGElement>("[data-anim='schematic-label']");
      const dots = root.querySelectorAll<SVGCircleElement>("[data-anim='schematic-dot']");
      const ticks = root.querySelectorAll<HTMLElement>("[data-anim='schematic-tick']");

      if (rings.length > 0) {
        const drawableRings = createDrawable(rings, 0, 0);
        animate(drawableRings, {
          draw: "0 1",
          duration: 390,
          delay: stagger(35),
          ease: MOTION_EASE.expo,
        });
      }

      if (leaders.length > 0) {
        const drawableLeaders = createDrawable(leaders, 0, 0);
        animate(drawableLeaders, {
          draw: "0 1",
          duration: 340,
          delay: stagger(40, { start: 90 }),
          ease: MOTION_EASE.expo,
        });
      }

      if (dots.length > 0) {
        utils.set(dots, { opacity: 0, scale: 0.4 });
        animate(dots, {
          opacity: [0, 1],
          scale: [0.4, 1],
          duration: 240,
          delay: stagger(40, { start: 180 }),
          ease: MOTION_EASE.default,
        });
      }

      if (labels.length > 0) {
        utils.set(labels, { opacity: 0, translateY: 3 });
        animate(labels, {
          opacity: [0, 1],
          translateY: [3, 0],
          duration: 240,
          delay: stagger(35, { start: 120 }),
          ease: MOTION_EASE.default,
        });
      }

      if (ticks.length > 0) {
        utils.set(ticks, { scaleY: 0, opacity: 0, transformOrigin: "bottom center" });
        animate(ticks, {
          scaleY: [0, 1],
          opacity: [0, 1],
          duration: 220,
          delay: stagger(12, { start: 80 }),
          ease: MOTION_EASE.default,
        });
      }
    },
    [runId, recalibrationKey],
  );

  return (
    <div
      ref={rootRef}
      className="mt-6 rounded-sm border border-shell/15 bg-paper px-3.5 py-3.5 sm:px-5 sm:py-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-shell/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-moss" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-moss-deep">
            Witness Telemetry Schematic · {STYLES[style].label} ({STYLES[style].analogHorizon} Analog Lens)
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-mute-dim">
          6-Point Evidence Architecture
        </span>
      </div>

      {/* Isometric Blueprint & Callout Leader Diagram */}
      <div className="relative mt-2 overflow-hidden">
        <svg
          viewBox="0 0 680 152"
          className="h-auto w-full select-none"
          role="img"
          aria-label="Four-witness institutional telemetry schematic with callout leader lines"
        >
          {/* Subtle architectural blueprint baseline grid */}
          <line
            x1="340"
            y1="10"
            x2="340"
            y2="142"
            stroke="var(--c-shell)"
            strokeOpacity="0.14"
            strokeDasharray="2 3"
          />
          <line
            x1="210"
            y1="76"
            x2="470"
            y2="76"
            stroke="var(--c-shell)"
            strokeOpacity="0.12"
            strokeDasharray="2 3"
          />

          {/* Isometric Stacked Cylinder / Turbine Wireframe Assembly (inspired by animejs.com) */}
          <g transform="translate(340, 78) rotate(-14)">
            {/* Top Aperture Ring */}
            <ellipse
              data-anim="schematic-ring"
              cx="0"
              cy="-44"
              rx="42"
              ry="13"
              fill="none"
              stroke="var(--c-shell)"
              strokeOpacity="0.55"
              strokeWidth="1.1"
            />
            <ellipse
              data-anim="schematic-ring"
              cx="0"
              cy="-40"
              rx="34"
              ry="10"
              fill="none"
              stroke="var(--c-moss)"
              strokeOpacity="0.7"
              strokeWidth="1"
            />

            {/* Upper Struts */}
            <line
              data-anim="schematic-ring"
              x1="-34"
              y1="-40"
              x2="-28"
              y2="-18"
              stroke="var(--c-shell)"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <line
              data-anim="schematic-ring"
              x1="34"
              y1="-40"
              x2="28"
              y2="-18"
              stroke="var(--c-shell)"
              strokeOpacity="0.45"
              strokeWidth="1"
            />

            {/* Mid-Upper Analogs Collar */}
            <ellipse
              data-anim="schematic-ring"
              cx="0"
              cy="-16"
              rx="32"
              ry="10"
              fill="none"
              stroke="var(--c-shell)"
              strokeOpacity="0.5"
              strokeWidth="1.1"
            />

            {/* Central Active Calibration Drum */}
            <ellipse
              data-anim="schematic-ring"
              cx="0"
              cy="4"
              rx="48"
              ry="15"
              fill="none"
              stroke="var(--c-moss-deep)"
              strokeOpacity="0.85"
              strokeWidth="1.5"
            />
            <ellipse
              data-anim="schematic-ring"
              cx="0"
              cy="14"
              rx="48"
              ry="15"
              fill="none"
              stroke="var(--c-shell)"
              strokeOpacity="0.55"
              strokeWidth="1.1"
            />
            <line
              data-anim="schematic-ring"
              x1="-48"
              y1="4"
              x2="-48"
              y2="14"
              stroke="var(--c-moss-deep)"
              strokeOpacity="0.75"
              strokeWidth="1.3"
            />
            <line
              data-anim="schematic-ring"
              x1="48"
              y1="4"
              x2="48"
              y2="14"
              stroke="var(--c-moss-deep)"
              strokeOpacity="0.75"
              strokeWidth="1.3"
            />

            {/* Lower Base Assembly */}
            <ellipse
              data-anim="schematic-ring"
              cx="0"
              cy="34"
              rx="36"
              ry="11"
              fill="none"
              stroke="var(--c-shell)"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <ellipse
              data-anim="schematic-ring"
              cx="0"
              cy="48"
              rx="44"
              ry="13"
              fill="none"
              stroke="var(--c-shell)"
              strokeOpacity="0.6"
              strokeWidth="1.2"
            />
            <line
              data-anim="schematic-ring"
              x1="-36"
              y1="34"
              x2="-44"
              y2="48"
              stroke="var(--c-shell)"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <line
              data-anim="schematic-ring"
              x1="36"
              y1="34"
              x2="44"
              y2="48"
              stroke="var(--c-shell)"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
          </g>

          {/* Left Callout Leader Lines & Labels */}
          {leftCallouts.map((c) => {
            const isHovered = hoveredNode === c.id;
            return (
              <g
                key={c.id}
                onMouseEnter={() => setHoveredNode(c.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-default"
              >
                <path
                  data-anim="schematic-leader"
                  d={c.path}
                  fill="none"
                  stroke={c.verified ? "var(--c-moss-deep)" : "var(--c-shell)"}
                  strokeOpacity={isHovered ? "0.95" : c.verified ? "0.65" : "0.35"}
                  strokeWidth={isHovered ? "1.6" : "1.1"}
                />
                <circle
                  data-anim="schematic-dot"
                  cx={c.dotX}
                  cy={c.dotY}
                  r={2.8}
                  fill={c.verified ? "var(--c-moss)" : "var(--c-amber-deep)"}
                />
                <g data-anim="schematic-label">
                  <text
                    x="140"
                    y={c.y - 2}
                    textAnchor="end"
                    fontFamily="monospace"
                    fontSize="10"
                    fontWeight="bold"
                    fill="var(--c-shell)"
                  >
                    {c.label}
                  </text>
                  <text
                    x="140"
                    y={c.y + 11}
                    textAnchor="end"
                    fontFamily="monospace"
                    fontSize="9"
                    fill={c.verified ? "var(--c-moss-deep)" : "var(--c-warn)"}
                  >
                    {c.detail}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Right Callout Leader Lines & Labels */}
          {rightCallouts.map((c) => {
            const isHovered = hoveredNode === c.id;
            return (
              <g
                key={c.id}
                onMouseEnter={() => setHoveredNode(c.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-default"
              >
                <path
                  data-anim="schematic-leader"
                  d={c.path}
                  fill="none"
                  stroke={c.verified ? "var(--c-moss-deep)" : "var(--c-shell)"}
                  strokeOpacity={isHovered ? "0.95" : c.verified ? "0.65" : "0.35"}
                  strokeWidth={isHovered ? "1.6" : "1.1"}
                />
                <circle
                  data-anim="schematic-dot"
                  cx={c.dotX}
                  cy={c.dotY}
                  r={2.8}
                  fill={c.verified ? "var(--c-moss)" : "var(--c-amber-deep)"}
                />
                <g data-anim="schematic-label">
                  <text
                    x="540"
                    y={c.y - 2}
                    textAnchor="start"
                    fontFamily="monospace"
                    fontSize="10"
                    fontWeight="bold"
                    fill="var(--c-shell)"
                  >
                    {c.label}
                  </text>
                  <text
                    x="540"
                    y={c.y + 11}
                    textAnchor="start"
                    fontFamily="monospace"
                    fontSize="9"
                    fill={c.verified ? "var(--c-moss-deep)" : "var(--c-warn)"}
                  >
                    {c.detail}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Bar: Interactive Style Horizon Scrubber Ruler (modeled on animejs.com bottom-right pill) */}
      <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-t border-shell/10 pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-mute-dim">
          <span className="uppercase tracking-wider font-semibold text-ink-body">Active Lens:</span>
          {STYLE_ORDER.map((st) => {
            const active = st === style;
            return (
              <button
                key={st}
                type="button"
                onClick={() => onSelectStyle?.(st)}
                className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] transition ${
                  active
                    ? "border-moss bg-moss/15 font-bold text-moss-deep"
                    : "border-shell/15 bg-paper-alt text-mute-dim hover:border-shell/35 hover:text-shell"
                }`}
              >
                {STYLES[st].label} ({STYLES[st].analogHorizon})
              </button>
            );
          })}
        </div>

        {/* Dark Pill Tick Scrubber */}
        <div
          className="inline-flex items-center gap-3 self-start sm:self-auto rounded-full bg-shell px-3.5 py-1.5 shadow-inner"
          title="Active horizon & witness telemetry index"
        >
          <span className="font-mono text-[9px] uppercase tracking-widest text-slate-text">
            {STYLES[style].analogHorizon}
          </span>
          <div className="flex items-end gap-[3px] h-3">
            {Array.from({ length: RULER_TICK_COUNT }).map((_, idx) => {
              const isMarker = idx === activeTickIndex;
              const isNear = Math.abs(idx - activeTickIndex) === 1;
              return (
                <span
                  key={idx}
                  data-anim="schematic-tick"
                  className={`w-[1.5px] rounded-full transition-colors ${
                    isMarker
                      ? "h-3 bg-lime shadow-[0_0_6px_var(--c-lime)]"
                      : isNear
                        ? "h-2.5 bg-white/70"
                        : idx % 4 === 0
                          ? "h-2 bg-white/35"
                          : "h-1.5 bg-white/20"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
