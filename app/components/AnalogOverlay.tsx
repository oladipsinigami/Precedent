"use client";

import { useState } from "react";
import { animate, createDrawable, onScroll, stagger, utils } from "animejs";
import { MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";
import type { OverlaySeries } from "@/lib/types";

interface AnalogOverlayProps {
  overlays: OverlaySeries[];
  runId?: number;
  animateResult?: boolean;
  skipAnimation?: boolean;
}

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midpointX = (points[i].x + points[i + 1].x) / 2;
    const midpointY = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${midpointX.toFixed(1)} ${midpointY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  path += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return path;
}

export function AnalogOverlay({
  overlays,
  runId = 0,
  animateResult = false,
  skipAnimation = false,
}: AnalogOverlayProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [replayCount, setReplayCount] = useState(0);

  const { rootRef } = useAnimeScope<HTMLDivElement>(
    ({ root }) => {
      if ((!animateResult && replayCount === 0) || skipAnimation) return;

      const analogPaths = root.querySelectorAll<SVGGeometryElement>("[data-anim='analog-path']");
      const currentPath = root.querySelectorAll<SVGGeometryElement>("[data-anim='current-path']");
      const currentDot = root.querySelector<SVGGElement>("[data-anim='current-dot']");

      let hasPlayed = false;
      const playTrajectoryDraw = () => {
        if (hasPlayed) return;
        hasPlayed = true;

        if (analogPaths.length > 0) {
          const drawableAnalogs = createDrawable(analogPaths, 0, 0);
          animate(drawableAnalogs, {
            draw: "0 1",
            duration: 400,
            delay: stagger(45, { start: 80 }),
            ease: MOTION_EASE.expo,
          });
        }

        if (currentPath.length > 0) {
          const drawableCurrent = createDrawable(currentPath, 0, 0);
          animate(drawableCurrent, {
            draw: "0 1",
            duration: 420,
            delay: 180,
            ease: MOTION_EASE.expo,
          });
        }

        if (currentDot) {
          utils.set(currentDot, { opacity: 0 });
          animate(currentDot, {
            opacity: [0, 1],
            duration: 220,
            delay: 480,
            ease: MOTION_EASE.default,
          });
        }
      };

      if (replayCount > 0) {
        playTrajectoryDraw();
        return;
      }

      onScroll({
        target: root,
        onEnterForward: () => {
          playTrajectoryDraw();
        },
      });
    },
    [runId, replayCount, skipAnimation],
  );

  const width = 800;
  const height = 280;
  const padLeft = 45;
  const padRight = 55;
  const padTop = 30;
  const padBottom = 35;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const series = overlays.filter((overlay) => overlay.points.some((point) => point.value !== null));

  if (!series.length) {
    return (
      <div className="mt-6 rounded border border-shell/10 bg-shell/[0.02] p-4 text-xs text-mute-dim">
        Normalized analog paths unavailable for this run.
      </div>
    );
  }

  const values = series.flatMap((overlay) =>
    overlay.points.map((point) => point.value).filter((value): value is number => value !== null)
  );
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Add slight 8% padding around min/max
  const padding = (rawMax - rawMin) * 0.08 || 2;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;

  const getY = (val: number) => padTop + plotHeight - ((val - min) / span) * plotHeight;
  const baselineY = getY(100);

  // Separate current series and analog series
  const currentSeries = series.find((s) => s.kind === "current");
  const analogSeries = series.filter((s) => s.kind !== "current");
  const maxPoints = Math.max(...series.map((s) => s.points.length), 1);

  // Find last point of current series for pulse dot
  let currentLastPoint: { x: number; y: number; val: number } | null = null;
  if (currentSeries) {
    const validPts = currentSeries.points
      .map((p, idx) => ({ ...p, idx }))
      .filter((p) => p.value !== null);
    if (validPts.length) {
      const last = validPts[validPts.length - 1];
      const x = padLeft + (last.idx / Math.max(1, currentSeries.points.length - 1)) * plotWidth;
      const y = getY(last.value!);
      currentLastPoint = { x, y, val: last.value! };
    }
  }

  const activeStepIdx = hoverIdx !== null ? Math.min(maxPoints - 1, Math.max(0, hoverIdx)) : null;
  const activeX =
    activeStepIdx !== null
      ? padLeft + (activeStepIdx / Math.max(1, maxPoints - 1)) * plotWidth
      : null;
  const activeRelDay =
    activeStepIdx !== null
      ? (currentSeries?.points[activeStepIdx]?.t ??
        analogSeries[0]?.points[activeStepIdx]?.t ??
        activeStepIdx - Math.floor(maxPoints / 2))
      : null;
  const activeCurrentVal =
    activeStepIdx !== null ? (currentSeries?.points[activeStepIdx]?.value ?? null) : null;
  const activeAnalogVals =
    activeStepIdx !== null
      ? analogSeries
          .map((s) => s.points[activeStepIdx]?.value ?? null)
          .filter((v): v is number => v !== null)
      : [];
  const activeAnalogMean =
    activeAnalogVals.length > 0
      ? activeAnalogVals.reduce((acc, v) => acc + v, 0) / activeAnalogVals.length
      : null;

  return (
    <div ref={rootRef} className="mt-6 sm:mt-8 rounded-sm border border-shell/20 bg-paper p-4 sm:p-6 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-shell/10 pb-3">
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.16em] text-moss">
            ✦ Normalized Historical Analog Paths · Empirical Trajectory Overlay
          </div>
          <div className="mt-0.5 text-xs text-mute-dim">
            Rebased to 100.0 at trigger state (T₀). Trajectories depict actual historical post-setup paths.
          </div>
        </div>

        {/* Chart Legend & Replay Trigger */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 font-mono text-[10px] uppercase text-mute-dim">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-moss" />
            <span className="font-semibold text-ink-body">Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-mute" />
            <span>Historical analogs ({analogSeries.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-px w-3 border-b border-dashed border-alert-alt" />
            <span className="text-alert-alt">100.0 Rebase</span>
          </div>
          {!skipAnimation && (
            <button
              type="button"
              onClick={() => setReplayCount((c) => c + 1)}
              className="rounded border border-moss/30 bg-moss/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-moss-deep transition hover:bg-moss/20"
            >
              ↻ Redraw Paths
            </button>
          )}
        </div>
      </div>

      {/* Interactive Crosshair Telemetry Readout Strip */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-shell/10 bg-paper-deep px-3 py-1.5 font-mono text-[10px]">
        <div className="flex items-center gap-2 text-mute-dim">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-moss" />
          <span className="uppercase tracking-wider">
            {activeRelDay !== null
              ? `Session Probe: T${activeRelDay >= 0 ? `+${activeRelDay}` : activeRelDay}`
              : "Hover chart to inspect session-by-session rebased dispersion"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span>
            <span className="text-ink-faint">Current: </span>
            <span className="font-bold text-moss-deep">
              {activeCurrentVal !== null
                ? activeCurrentVal.toFixed(2)
                : currentLastPoint
                  ? currentLastPoint.val.toFixed(2)
                  : "—"}
            </span>
          </span>
          <span>
            <span className="text-ink-faint">Analog Mean: </span>
            <span className="font-bold text-shell">
              {activeAnalogMean !== null ? activeAnalogMean.toFixed(2) : "100.00 (T₀)"}
            </span>
          </span>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative mt-2.5 overflow-hidden rounded bg-paper-alt p-1 border border-shell/[0.08]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full select-none cursor-crosshair"
          role="img"
          aria-label="Normalized historical analog paths chart"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * width;
            const ratio = Math.min(1, Math.max(0, (relX - padLeft) / Math.max(1, plotWidth)));
            setHoverIdx(Math.round(ratio * Math.max(0, maxPoints - 1)));
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal Grid lines */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={width - padRight}
            y2={padTop}
            stroke="var(--c-shell)"
            strokeOpacity="0.08"
            strokeDasharray="2 4"
          />
          <text
            x={padLeft - 8}
            y={padTop + 4}
            textAnchor="end"
            fontSize="9"
            fontFamily="monospace"
            fill="var(--c-ink-faint)"
          >
            {max.toFixed(0)}
          </text>

          <line
            x1={padLeft}
            y1={padTop + plotHeight}
            x2={width - padRight}
            y2={padTop + plotHeight}
            stroke="var(--c-shell)"
            strokeOpacity="0.08"
            strokeDasharray="2 4"
          />
          <text
            x={padLeft - 8}
            y={padTop + plotHeight + 3}
            textAnchor="end"
            fontSize="9"
            fontFamily="monospace"
            fill="var(--c-ink-faint)"
          >
            {min.toFixed(0)}
          </text>

          {/* Baseline 100 Reference line */}
          {baselineY >= padTop && baselineY <= padTop + plotHeight && (
            <g>
              <line
                x1={padLeft}
                y1={baselineY}
                x2={width - padRight}
                y2={baselineY}
                stroke="var(--c-alert-alt)"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                strokeOpacity="0.75"
              />
              <text
                x={width - padRight + 8}
                y={baselineY + 3}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                fill="var(--c-alert-alt)"
              >
                100.0 (T₀)
              </text>
            </g>
          )}

          {/* Time axis ticks & labels */}
          <line
            x1={padLeft}
            y1={padTop + plotHeight}
            x2={width - padRight}
            y2={padTop + plotHeight}
            stroke="var(--c-shell)"
            strokeOpacity="0.2"
          />

          <g fontFamily="monospace" fontSize="9" fill="var(--c-ink-faint)">
            <text x={padLeft} y={height - 12} textAnchor="start">
              -20 Sessions
            </text>
            <text x={padLeft + plotWidth * 0.5} y={height - 12} textAnchor="middle">
              T₀ (Matched Window)
            </text>
            <text x={width - padRight} y={height - 12} textAnchor="end">
              +20 Sessions
            </text>
          </g>

          {/* Analog Series Paths */}
          {analogSeries.map((overlay, index) => {
            const points = overlay.points
              .map((point, pointIndex) => {
                if (point.value === null) return null;
                const x = padLeft + (pointIndex / Math.max(1, overlay.points.length - 1)) * plotWidth;
                const y = getY(point.value);
                return { x, y };
              })
              .filter((p): p is { x: number; y: number } => p !== null);

            const opacity = Math.max(0.3, 0.75 - index * 0.1);

            return (
              <path
                key={overlay.id}
                data-anim="analog-path"
                d={smoothPath(points)}
                fill="none"
                stroke="var(--c-ink-faint)"
                strokeWidth={1.8}
                strokeOpacity={opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all hover:stroke-ink-strong hover:stroke-width-2"
              />
            );
          })}

          {/* Current Target Series (Highlighted) */}
          {currentSeries && (
            <g>
              <path
                data-anim="current-path"
                d={smoothPath(currentSeries.points
                  .map((point, pointIndex) => {
                    if (point.value === null) return null;
                    const x = padLeft + (pointIndex / Math.max(1, currentSeries.points.length - 1)) * plotWidth;
                    const y = getY(point.value);
                    return { x, y };
                  })
                  .filter((p): p is { x: number; y: number } => p !== null))}
                fill="none"
                stroke="var(--c-moss-deep)"
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Pulse Terminal Dot on Current Series */}
              {currentLastPoint && (
                <g data-anim="current-dot">
                  <circle
                    cx={currentLastPoint.x}
                    cy={currentLastPoint.y}
                    r={5}
                    fill="var(--c-moss-deep)"
                    className="animate-pulse"
                  />
                  <circle
                    cx={currentLastPoint.x}
                    cy={currentLastPoint.y}
                    r={2.5}
                    fill="var(--c-paper)"
                  />
                  <text
                    x={currentLastPoint.x + 8}
                    y={currentLastPoint.y + 3}
                    fontFamily="monospace"
                    fontSize="9"
                    fontWeight="bold"
                    fill="var(--c-ink-body)"
                  >
                    {currentLastPoint.val.toFixed(1)}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Interactive Session Crosshair */}
          {activeX !== null && (
            <g>
              <line
                x1={activeX}
                y1={padTop}
                x2={activeX}
                y2={padTop + plotHeight}
                stroke="var(--c-moss-deep)"
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.65"
              />
              {activeCurrentVal !== null && (
                <circle
                  cx={activeX}
                  cy={getY(activeCurrentVal)}
                  r={4}
                  fill="var(--c-moss-deep)"
                  stroke="var(--c-paper)"
                  strokeWidth="1.5"
                />
              )}
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 text-[11px] leading-relaxed text-mute-dim">
        ✦ Empirical Trajectory Context: The prominent solid green line traces the current asset. Muted trajectories trace matched historical analogs aligned at their respective trigger points. Path dispersion reflects empirical market range rather than a deterministic forecast.
      </div>
    </div>
  );
}
