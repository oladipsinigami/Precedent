"use client";

import type { AnalogsPillar, Briefing, StructureFlags } from "@/lib/types";
import type { PillarScore } from "@/lib/pillar-scores";

interface ConsiderationsSectionProps {
  considerations: Briefing["considerations"];
  scores: { sentiment: PillarScore; fundamentals: PillarScore; technicals: PillarScore };
  analogs?: AnalogsPillar;
  analogQuality?: StructureFlags["analogQuality"];
}

export function ConsiderationsSection({ considerations, scores, analogs, analogQuality }: ConsiderationsSectionProps) {
  const available = Object.values(scores).filter((score) => score.value !== null);
  // No aggregate verdict here. The pillars describe how much evidence each
  // stream returned; combining them into one adjective ("broadly constructive")
  // read as a directional call the data does not support.
  const trajectory = analogs?.ranges.length
    ? `Analog bands remain available across ${analogs.ranges.length} horizon${analogs.ranges.length === 1 ? "" : "s"} and are ${analogQuality?.clustered ? "clustered" : "scattered"} in the available sample; ${analogs.informative?.note ?? "dispersion should be read as historical context rather than a forecast."}`
    : "Analog trajectory context was unavailable for this run.";
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
      {/* Column 1: Operating Frame Considerations */}
      <div className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-shell/10 pb-3">
          <span className="h-2 w-2 rounded-full bg-moss" />
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-moss">
            ✦ Horizon Considerations
          </h4>
        </div>
        <ul className="mt-4 space-y-3.5">
          {considerations.forStyle.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-body">
              <span className="font-mono text-[11px] font-bold text-moss">0{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Column 2: Invalidation Criteria */}
      <div className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-shell/10 pb-3">
          <span className="h-2 w-2 rounded-full bg-alert-alt" />
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-warn">
            ✦ Invalidation Triggers
          </h4>
        </div>
        <ul className="mt-4 space-y-3.5">
          {considerations.invalidation.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-body">
              <span className="font-mono text-[11px] font-bold text-warn">✕</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Column 3: Deliberative Questions */}
      <div className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-shell/10 pb-3">
          <span className="h-2 w-2 rounded-full bg-slate" />
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-slate">
            ✦ Deliberative Questions
          </h4>
        </div>
        <ul className="mt-4 space-y-3.5">
          {considerations.questions.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-body">
              <span className="font-mono text-[11px] font-bold text-slate">?</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </div>
  );
}
