"use client";

import type { OverlaySeries } from "@/lib/types";

interface AnalogOverlayProps {
  overlays: OverlaySeries[];
}

export function AnalogOverlay({ overlays }: AnalogOverlayProps) {
  const width = 800;
  const height = 240;
  const padLeft = 45;
  const padRight = 55;
  const padTop = 30;
  const padBottom = 35;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const series = overlays.filter((overlay) => overlay.points.some((point) => point.value !== null));

  if (!series.length) {
    return (
      <div className="mt-6 rounded border border-[#141918]/10 bg-[#141918]/[0.02] p-4 text-xs text-[#637265]">
        Normalized analog paths unavailable for this run.
      </div>
    );
  }

  const values = series.flatMap((overlay) =>
    overlay.points.map((point) => point.value).filter((value): value is number => value !== null)
  );
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Add slight 5% padding around min/max
  const padding = (rawMax - rawMin) * 0.08 || 2;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;

  const getY = (val: number) => padTop + plotHeight - ((val - min) / span) * plotHeight;
  const baselineY = getY(100);

  // Separate current series and analog series
  const currentSeries = series.find((s) => s.kind === "current");
  const analogSeries = series.filter((s) => s.kind !== "current");

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

  return (
    <div className="mt-8 rounded-sm border border-[#141918]/15 bg-[#fbf8f2] p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#141918]/10 pb-3">
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#486326]">
            Normalized Analog Paths · Trajectory Overlay
          </div>
          <div className="mt-0.5 text-xs text-[#637265]">
            Rebased to 100.0 at matched state (T₀). Follow-through illustrates historical dispersion.
          </div>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase text-[#637265]">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-[#3d5c22]" />
            <span className="font-semibold text-[#253816]">Current Target</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-[#839487]" />
            <span>Analog Precedents ({analogSeries.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-px w-3 border-b border-dashed border-[#a15530]" />
            <span className="text-[#a15530]">100.0 Rebase</span>
          </div>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div className="relative mt-4 overflow-hidden rounded bg-[#f5f1e8] p-1 border border-[#141918]/[0.08]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full select-none"
          role="img"
          aria-label="Normalized historical analog paths chart"
        >
          {/* Horizontal Grid lines */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={width - padRight}
            y2={padTop}
            stroke="#141918"
            strokeOpacity="0.08"
            strokeDasharray="2 4"
          />
          <text
            x={padLeft - 8}
            y={padTop + 4}
            textAnchor="end"
            fontSize="9"
            fontFamily="monospace"
            fill="#738275"
          >
            {max.toFixed(0)}
          </text>

          <line
            x1={padLeft}
            y1={padTop + plotHeight}
            x2={width - padRight}
            y2={padTop + plotHeight}
            stroke="#141918"
            strokeOpacity="0.08"
            strokeDasharray="2 4"
          />
          <text
            x={padLeft - 8}
            y={padTop + plotHeight + 3}
            textAnchor="end"
            fontSize="9"
            fontFamily="monospace"
            fill="#738275"
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
                stroke="#a15530"
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
                fill="#a15530"
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
            stroke="#141918"
            strokeOpacity="0.2"
          />

          <g fontFamily="monospace" fontSize="9" fill="#738275">
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

          {/* Analog Series Polylines */}
          {analogSeries.map((overlay, index) => {
            const points = overlay.points
              .map((point, pointIndex) => {
                if (point.value === null) return null;
                const x = padLeft + (pointIndex / Math.max(1, overlay.points.length - 1)) * plotWidth;
                const y = getY(point.value);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .filter((p): p is string => p !== null)
              .join(" ");

            const opacity = Math.max(0.3, 0.75 - index * 0.1);

            return (
              <polyline
                key={overlay.id}
                points={points}
                fill="none"
                stroke="#6b7c70"
                strokeWidth={1.3}
                strokeOpacity={opacity}
                className="transition-all hover:stroke-[#1d2720] hover:stroke-width-2"
              />
            );
          })}

          {/* Current Target Series (Highlighted) */}
          {currentSeries && (
            <g>
              <polyline
                points={currentSeries.points
                  .map((point, pointIndex) => {
                    if (point.value === null) return null;
                    const x = padLeft + (pointIndex / Math.max(1, currentSeries.points.length - 1)) * plotWidth;
                    const y = getY(point.value);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .filter((p): p is string => p !== null)
                  .join(" ")}
                fill="none"
                stroke="#38541e"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Pulse Terminal Dot on Current Series */}
              {currentLastPoint && (
                <g>
                  <circle
                    cx={currentLastPoint.x}
                    cy={currentLastPoint.y}
                    r={5}
                    fill="#38541e"
                    className="animate-pulse"
                  />
                  <circle
                    cx={currentLastPoint.x}
                    cy={currentLastPoint.y}
                    r={2.5}
                    fill="#ffffff"
                  />
                  <text
                    x={currentLastPoint.x + 8}
                    y={currentLastPoint.y + 3}
                    fontFamily="monospace"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#273d13"
                  >
                    {currentLastPoint.val.toFixed(1)}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 text-[11px] leading-relaxed text-[#637265]">
        The highlighted solid path represents the current target instrument. Thin muted trajectories display past analog precedents aligned at their matched market state. Divergence reflects empirical range rather than algorithmic projection.
      </div>
    </div>
  );
}
