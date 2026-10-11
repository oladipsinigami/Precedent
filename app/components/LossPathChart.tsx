"use client";

import { useMemo, useState } from "react";
import { animate, createDrawable, stagger } from "animejs";
import { MOTION_EASE } from "@/lib/motion/tokens";
import { useAnimeScope } from "@/lib/motion/use-anime-scope";
import type { RiskPillar } from "@/lib/risk/risk-pillar";

interface LossPathChartProps {
  risk: RiskPillar;
  runId?: number;
  recalibrationKey?: number;
}

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 20, right: 24, bottom: 34, left: 72 };

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function money(value: number): string {
  const sign = value > 0 ? "$" : value < 0 ? "-$" : "$";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

export function LossPathChart({ risk, runId = 0, recalibrationKey = 0 }: LossPathChartProps) {
  const points = risk.path;
  const [hover, setHover] = useState<number | null>(null);

  const { rootRef } = useAnimeScope<HTMLDivElement>(
    ({ root }) => {
      const limitLine = root.querySelectorAll<SVGGeometryElement>("[data-anim='loss-limit-line']");
      const segs = root.querySelectorAll<SVGGeometryElement>("[data-anim='loss-segment']");

      if (limitLine.length > 0) {
        const drawableLimit = createDrawable(limitLine, 0, 0);
        animate(drawableLimit, {
          draw: "0 1",
          duration: 360,
          ease: MOTION_EASE.expo,
        });
      }

      if (segs.length > 0) {
        const drawableSegs = createDrawable(segs, 0, 0);
        animate(drawableSegs, {
          draw: "0 1",
          duration: 280,
          delay: stagger(45, { start: 80 }),
          ease: MOTION_EASE.expo,
        });
      }
    },
    [runId, recalibrationKey, points.length],
  );

  const limit = risk.maxLossUsd;
  const geometry = useMemo(() => {
    if (!points.length) return null;

    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const largest = Math.max(
      1,
      limit ?? 0,
      ...points.map((p) => Math.abs(p.cumulativeLossUsd)),
    );
    // Headroom above the worst point and the limit so neither is ever clipped,
    // rounded up to a tidy axis maximum.
    const yMax = niceCeil(largest * 1.2);
    const x = (i: number) => PAD.left + (innerW * i) / Math.max(1, points.length - 1);
    const y = (v: number) => PAD.top + innerH - (Math.min(Math.abs(v), yMax) / yMax) * innerH;

    const segments: Array<{ d: string; breach: boolean; from: number; to: number }> = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (!a || !b) continue;
      segments.push({
        d: `M${x(i - 1).toFixed(1)},${y(Math.abs(a.cumulativeLossUsd)).toFixed(1)} L${x(i).toFixed(1)},${y(Math.abs(b.cumulativeLossUsd)).toFixed(1)}`,
        breach: a.breach || b.breach,
        from: i - 1,
        to: i,
      });
    }

    const limitY = limit !== null ? y(limit) : null;

    return { innerW, innerH, x, y, segments, limitY, yMax };
  }, [points, limit]);

  if (!geometry || !points.length) {
    return (
      <div className="rounded-sm border border-rule/25 bg-shell/30 px-4 py-6 text-center">
        <p className="text-xs text-mute-dim">
          No measured path for this hold. The chart is drawn from the same measured distribution as the verdict, so it
          disappears with it rather than being estimated.
        </p>
      </div>
    );
  }

  const { x, y, segments, limitY } = geometry;
  const breachPoint = risk.firstBreach;
  const active = hover !== null ? points[hover] : null;
  const yTicks = geometry ? Array.from({ length: 5 }, (_, i) => (geometry.yMax * i) / 4) : [];

  return (
    <div ref={rootRef} className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={
          breachPoint
            ? `Measured cumulative loss across the hold. Your loss limit is crossed on ${breachPoint.label}.`
            : "Measured cumulative loss across the hold. The full hold stays inside your loss limit."
        }
        onMouseLeave={() => setHover(null)}
      >
        <title>
          {breachPoint
            ? `Cumulative measured loss against your limit; crossed on ${breachPoint.label}`
            : "Cumulative measured loss against your limit; never crossed"}
        </title>

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-shell"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text x={PAD.left - 10} y={y(tick) + 4} textAnchor="end" className="fill-mute-dim text-[11px] font-mono">
              {money(tick)}
            </text>
          </g>
        ))}

        {limit !== null && limitY !== null && (
          <g>
            <line
              data-anim="loss-limit-line"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={limitY}
              y2={limitY}
              className="stroke-alert"
              strokeWidth={2}
            />
            <text
              x={WIDTH - PAD.right}
              y={limitY - 7}
              textAnchor="end"
              className="fill-alert text-[11px] font-mono font-bold"
            >
              your limit {money(limit)}
            </text>
          </g>
        )}

        {segments.map((segment) => (
          <line
            key={`${segment.from}-${segment.to}`}
            data-anim="loss-segment"
            x1={x(segment.from)}
            y1={y(Math.abs(points[segment.from]?.cumulativeLossUsd ?? 0))}
            x2={x(segment.to)}
            y2={y(Math.abs(points[segment.to]?.cumulativeLossUsd ?? 0))}
            className={segment.breach ? "stroke-alert" : "stroke-lime"}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}

        {points.map((point, i) => (
          <g key={point.date}>
            <rect
              x={x(i) - 12}
              y={PAD.top}
              width={24}
              height={HEIGHT - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              role="presentation"
              aria-label={`${point.label}: ${money(point.cumulativeLossUsd)}`}
            />
            {point.eventKind && (
              <circle
                cx={x(i)}
                cy={y(Math.abs(point.cumulativeLossUsd))}
                r={4}
                className={point.breach ? "fill-alert" : "fill-moss"}
              />
            )}
            {(points.length <= 12 || i % 2 === 0) && (
              <text
                x={x(i)}
                y={HEIGHT - PAD.bottom + 18}
                textAnchor="middle"
                className={
                  point.breach ? "fill-alert text-[10px] font-mono font-bold" : "fill-mute-dim text-[10px] font-mono"
                }
              >
                {point.label}
              </text>
            )}
          </g>
        ))}

        {breachPoint && (
          <line
            x1={x(breachPoint.index)}
            x2={x(breachPoint.index)}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            className="stroke-alert"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {active && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              className="stroke-mute"
              strokeWidth={1}
            />
            <circle
              cx={x(hover)}
              cy={y(active.cumulativeLossUsd)}
              r={4}
              className={active.breach ? "fill-alert" : "fill-lime"}
            />
          </g>
        )}
      </svg>

      {breachPoint ? (
        <p className="text-xs leading-relaxed text-paper">
          You pass your <span className="font-semibold text-alert">{money(limit ?? 0)}</span> limit around{" "}
          <span className="font-semibold text-alert">{breachPoint.label}</span>
          {breachPoint.eventLabel ? (
            <>
              , on <span className="font-semibold">{breachPoint.eventLabel}</span>
            </>
          ) : null}
          .
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-paper">
          The measured path stays inside your <span className="font-semibold text-moss">{money(limit ?? 0)}</span> limit
          across all {points.length} sessions of this hold.
        </p>
      )}

      <p className="text-[11px] italic leading-relaxed text-mute-dim">
        Each step is that session&apos;s measured move at your size; event sessions are marked. The final step includes the
        round-trip cost. This is a measured distribution, not a prediction of what the stock will do.
      </p>
    </div>
  );
}
