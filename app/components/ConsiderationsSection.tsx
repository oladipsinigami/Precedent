"use client";

import type { Briefing } from "@/lib/types";

interface ConsiderationsSectionProps {
  considerations: Briefing["considerations"];
}

export function ConsiderationsSection({ considerations }: ConsiderationsSectionProps) {
  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
      {/* Column 1: Operating Frame Considerations */}
      <div className="rounded-sm border border-[#141918]/12 bg-[#fcf9f2] p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#141918]/10 pb-3">
          <span className="h-2 w-2 rounded-full bg-[#486326]" />
          <h4 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#486326]">
            Frame Considerations
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
            Invalidation Triggers
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
            Questions to Weigh
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
  );
}
