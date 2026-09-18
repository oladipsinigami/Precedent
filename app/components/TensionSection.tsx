"use client";

import type { Briefing } from "@/lib/types";

interface TensionSectionProps {
  tension: Briefing["tension"];
}

export function TensionSection({ tension }: TensionSectionProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-[#59665a]">
          Cross-pillar divergences identify structural tensions where empirical streams contradict one another. Signal dispersion highlights where market uncertainty is highest and where risk parameters should be tightened.
        </p>
        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-[#637265] sm:inline">
          {tension.length} active divergence{tension.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {tension.map((item, index) => (
          <div
            key={index}
            className="flex flex-col justify-between rounded-sm border border-[#141918]/15 bg-[#fbf8f2] p-4 sm:p-5 shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#141918]/[0.08] pb-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#486326]">
                  Divergence Vector 0{index + 1}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#738275]">
                  Dual Signal Spectrum
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-xs leading-relaxed sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded border border-[#141918]/[0.06] bg-[#141918]/[0.02] p-3 text-[#1f2821]">
                  <div className="font-mono text-[9px] font-semibold uppercase text-[#738275] mb-1">Primary Observed Signal</div>
                  {item.left}
                </div>

                <div className="flex justify-center text-center font-mono text-[10px] font-bold uppercase text-[#738275]">
                  <span className="rounded-full bg-[#141918]/[0.06] px-2 py-1 tracking-wider text-[9px]">VS</span>
                </div>

                <div className="rounded border border-[#486326]/20 bg-[#486326]/[0.04] p-3 text-[#2a4515]">
                  <div className="font-mono text-[9px] font-semibold uppercase text-[#486326] mb-1">Countervailing Evidence</div>
                  {item.right || "Countervailing data points toward a divergent market regime."}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-[#141918]/10 pt-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#486326]">
                ✦ Strategic Implication for Trader:
              </span>
              <p className="mt-1 text-xs leading-relaxed text-[#4b594d]">{item.whyItMatters}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
