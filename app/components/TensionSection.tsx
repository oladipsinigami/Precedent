"use client";

import type { Briefing } from "@/lib/types";

interface TensionSectionProps {
  tension: Briefing["tension"];
}

export function TensionSection({ tension }: TensionSectionProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-mute-faint">
          Cross-pillar divergences identify structural tensions where empirical streams contradict one another. Signal dispersion highlights where market uncertainty is highest and where risk parameters should be tightened.
        </p>
        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-mute-dim sm:inline">
          {tension.length} active divergence{tension.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {tension.map((item, index) => (
          <div
            key={index}
            className="flex flex-col justify-between rounded-sm border border-shell/15 bg-paper p-4 sm:p-5 shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between border-b border-shell/[0.08] pb-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-moss">
                  Divergence Vector 0{index + 1}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                  Dual Signal Spectrum
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-xs leading-relaxed sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded border border-shell/[0.06] bg-shell/[0.02] p-3 text-ink-strong">
                  <div className="font-mono text-[9px] font-semibold uppercase text-ink-faint mb-1">Primary Observed Signal</div>
                  {item.left}
                </div>

                <div className="flex justify-center text-center font-mono text-[10px] font-bold uppercase text-ink-faint">
                  <span className="rounded-full bg-shell/[0.06] px-2 py-1 tracking-wider text-[9px]">VS</span>
                </div>

                <div className="rounded border border-moss/20 bg-moss/[0.04] p-3 text-moss-deep">
                  <div className="font-mono text-[9px] font-semibold uppercase text-moss mb-1">Countervailing Evidence</div>
                  {item.right || "Countervailing data points toward a divergent market regime."}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-shell/10 pt-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-moss">
                ✦ Strategic Implication for Trader:
              </span>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute">{item.whyItMatters}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
