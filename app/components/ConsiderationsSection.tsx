"use client";

import type { AnalogsPillar, Briefing, StructureFlags } from "@/lib/types";
import type { PillarCoverage, PillarScore } from "@/lib/pillar-scores";

interface ConsiderationsSectionProps {
  considerations: Briefing["considerations"];
  scores: { sentiment: PillarScore; fundamentals: PillarScore; technicals: PillarScore };
  coverage: PillarCoverage;
  analogs?: AnalogsPillar;
  analogQuality?: StructureFlags["analogQuality"];
}

export function ConsiderationsSection({ considerations, scores, coverage, analogs, analogQuality }: ConsiderationsSectionProps) {
  const available = Object.values(scores).filter((score) => score.value !== null);
  const labels = available.map((score) => score.label);
  const agreement = labels.length > 1 && labels.every((label) => label === labels[0])
    ? `The available pillars are broadly ${labels[0]}.`
    : "The available pillars do not fully agree, so the setup remains mixed across evidence types.";
  const trajectory = analogs?.ranges.length
    ? `Analog bands remain available across ${analogs.ranges.length} horizon${analogs.ranges.length === 1 ? "" : "s"} and are ${analogQuality?.clustered ? "clustered" : "scattered"} in the available sample; ${analogs.informative?.note ?? "dispersion should be read as historical context rather than a forecast."}`
    : "Analog trajectory context was unavailable for this run.";
  return (
    <div className="space-y-5">
      <div className="rounded-sm border border-[#141918]/12 bg-[#fcf9f2] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#486326]">✦ Evidence Coverage Synthesis</h4>
          <span className="font-mono text-lg font-semibold text-[#1f2821]">{coverage.available} / {coverage.total} streams <span className="text-[10px] uppercase text-[#738275]">· {coverage.label}</span></span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#637265]">{coverage.basis}</p>
        <p className="mt-2 text-xs leading-relaxed text-[#222b24]"><span className="font-semibold text-[#486326]">✦ Synthesis Commentary:</span> {agreement} {trajectory} The unresolved questions below define what evidence would change the thesis.</p>
      </div>
      <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
      {/* Column 1: Operating Frame Considerations */}
      <div className="rounded-sm border border-[#141918]/12 bg-[#fcf9f2] p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#141918]/10 pb-3">
          <span className="h-2 w-2 rounded-full bg-[#486326]" />
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#486326]">
            ✦ Horizon Considerations
          </h4>
        </div>
        <ul className="mt-4 space-y-3.5">
          {considerations.forStyle.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5 text-xs leading-relaxed text-[#222b24]">
              <span className="font-mono text-[11px] font-bold text-[#486326]">0{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Column 2: Invalidation Criteria */}
      <div className="rounded-sm border border-[#141918]/12 bg-[#fcf9f2] p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#141918]/10 pb-3">
          <span className="h-2 w-2 rounded-full bg-[#a3442e]" />
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#8f3622]">
            ✦ Invalidation Triggers
          </h4>
        </div>
        <ul className="mt-4 space-y-3.5">
          {considerations.invalidation.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5 text-xs leading-relaxed text-[#222b24]">
              <span className="font-mono text-[11px] font-bold text-[#8f3622]">✕</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Column 3: Deliberative Questions */}
      <div className="rounded-sm border border-[#141918]/12 bg-[#fcf9f2] p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#141918]/10 pb-3">
          <span className="h-2 w-2 rounded-full bg-[#3d6075]" />
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#3d6075]">
            ✦ Deliberative Questions
          </h4>
        </div>
        <ul className="mt-4 space-y-3.5">
          {considerations.questions.map((item, index) => (
            <li key={index} className="flex items-start gap-2.5 text-xs leading-relaxed text-[#222b24]">
              <span className="font-mono text-[11px] font-bold text-[#3d6075]">?</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </div>
  );
}
