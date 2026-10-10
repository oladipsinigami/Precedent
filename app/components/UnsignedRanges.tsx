"use client";

import type { AnalogRange } from "@/lib/types";

interface UnsignedRangesProps {
  ranges: AnalogRange[];
}

export function UnsignedRanges({ ranges }: UnsignedRangesProps) {
  if (!ranges.length) {
    return (
      <div className="mt-6 rounded border border-shell/10 bg-shell/[0.02] p-4 text-xs text-mute-dim">
        Historical excess return range unavailable for this run.
      </div>
    );
  }

  return (
    <div className="mt-7">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
          ✦ Historical Excess Return Distributions · Empirical Base Rates
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
          Empirical Quantile Spreads
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ranges.map((item) => {
          // Calculate scale for horizontal range bar
          const maxAbs = Math.max(Math.abs(item.p10), Math.abs(item.p90), 5);
          const getPosPct = (val: number) => ((val + maxAbs) / (maxAbs * 2)) * 100;
          const leftPct = Math.max(0, Math.min(100, getPosPct(item.p10)));
          const rightPct = Math.max(0, Math.min(100, getPosPct(item.p90)));
          const medianPct = Math.max(0, Math.min(100, getPosPct(item.p50)));
          const zeroPct = getPosPct(0);

          return (
            <div
              key={item.horizon}
              className="flex flex-col justify-between rounded-sm border border-shell/12 bg-paper p-4 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between border-b border-shell/[0.08] pb-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-moss-deep">
                    {item.horizon} Horizon
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">n = {item.n} matches</span>
                </div>

                <div className="mt-3.5 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-mute-faint">
                    <span>p10 (Tail Down):</span>
                    <span className="font-semibold text-warn">{item.p10 >= 0 ? "+" : ""}{item.p10.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-ink-strong font-medium">
                    <span>Median (p50):</span>
                    <span className="font-bold">{item.p50 >= 0 ? "+" : ""}{item.p50.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-mute-faint">
                    <span>p90 (Tail Up):</span>
                    <span className="font-semibold text-moss">{item.p90 >= 0 ? "+" : ""}{item.p90.toFixed(2)}%</span>
                  </div>
                </div>

                {/* Visual Distribution Range Bar */}
                <div className="mt-4 pt-2">
                  <div className="relative h-2 w-full rounded-full bg-shell/[0.08]">
                    {/* Zero reference marker */}
                    <div
                      className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-mute"
                      style={{ left: `${zeroPct}%` }}
                      title="0.0% Baseline"
                    />

                    {/* p10 to p90 Spread band */}
                    <div
                      className="absolute top-0 bottom-0 rounded-full bg-moss/30"
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(4, rightPct - leftPct)}%`,
                      }}
                    />

                    {/* Median p50 tick */}
                    <div
                      className="absolute top-[-2px] bottom-[-2px] w-1 rounded-sm bg-moss-deep"
                      style={{ left: `${medianPct}%` }}
                      title={`Median: ${item.p50.toFixed(2)}%`}
                    />
                  </div>

                  <div className="mt-1 flex justify-between font-mono text-[9px] text-mute">
                    <span>-{maxAbs.toFixed(0)}%</span>
                    <span>0%</span>
                    <span>+{maxAbs.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {item.pUp !== undefined && (
                <div className="mt-3.5 border-t border-shell/[0.08] pt-2 text-right font-mono text-[10px] text-mute-dim">
                  <span>Historical Positive Follow: </span>
                  <span className="font-bold text-ink-body">{(item.pUp * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-mute-dim">
        ✦ Empirical Methodological Note: These quantile bands characterize the dispersion of excess returns following historically comparable market regimes. They reflect historical sample distributions and do not constitute directional advice or return guarantees.
      </p>
    </div>
  );
}
