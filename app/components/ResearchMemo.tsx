"use client";

import { STYLES } from "@/lib/style-profiles";
import { MemoSection } from "./MemoSection";
import { EvidenceSection } from "./EvidenceSection";
import { TensionSection } from "./TensionSection";
import { AnalogOverlay } from "./AnalogOverlay";
import { UnsignedRanges } from "./UnsignedRanges";
import { ConsiderationsSection } from "./ConsiderationsSection";
import { DecisionRecord } from "./DecisionRecord";
import type { Briefing, PillarBundle, TradingStyle } from "@/lib/types";

interface ResearchMemoProps {
  briefing: Briefing;
  style: TradingStyle;
  pillarData: PillarBundle | null;
  decisionNote: string;
  onDecisionNoteChange: (value: string) => void;
}

export function ResearchMemo({
  briefing,
  style,
  pillarData,
  decisionNote,
  onDecisionNoteChange,
}: ResearchMemoProps) {
  return (
    <article className="mt-6 sm:mt-12 overflow-hidden rounded-sm border border-white/[0.14] bg-[#f5f0e6] text-[#141918] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.75)]">
      {/* Editorial Document Header */}
      <header className="border-b border-[#141918]/15 bg-[#ece6dd] px-4 py-6 sm:px-10 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] sm:tracking-[0.22em] text-[#425828]">
                Institutional Research Record
              </span>
              <span className="text-[#88998a]">·</span>
              <span className="font-mono text-[10px] uppercase text-[#637566]">
                Engine: {briefing.model}
              </span>
            </div>

            <h2 className="mt-3 sm:mt-4 font-display text-2xl font-medium leading-[1.16] tracking-[-0.03em] text-[#111513] sm:text-4xl md:text-5xl">
              {briefing.title}
            </h2>

            {briefing.styleNote && (
              <p className="mt-2.5 sm:mt-3.5 text-xs leading-relaxed text-[#566657] font-medium max-w-2xl">
                {briefing.styleNote}
              </p>
            )}
          </div>

          <div className="w-full sm:w-auto sm:min-w-[200px] rounded border border-[#141918]/12 bg-[#f8f5ee] p-3.5 sm:p-4 text-left sm:text-right shadow-sm shrink-0">
            <div className="flex items-center justify-between sm:block">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#738375]">
                  Active Frame
                </div>
                <div className="mt-0.5 sm:mt-1 font-semibold text-sm text-[#18201a]">
                  {STYLES[style].label}
                </div>
              </div>
              <div className="sm:mt-2 sm:border-t sm:border-[#141918]/[0.08] sm:pt-2 text-right">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[#738375]">
                  Detected Regime
                </div>
                <div className="font-mono text-xs font-semibold text-[#425828]">
                  {briefing.regime ?? "Normal / Unclassified"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Section 01: Evidence */}
      <MemoSection number="01" title="Evidence Base" badge="5 Converged Streams">
        <EvidenceSection
          evidence={briefing.evidence}
          flags={briefing.flags}
          marketStructure={pillarData?.marketStructure}
          news={pillarData?.news}
        />
      </MemoSection>

      {/* Section 02: Tension */}
      <MemoSection number="02" title="Structural Tension" shaded badge="Disagreements Isolated">
        <TensionSection tension={briefing.tension} />
      </MemoSection>

      {/* Section 03: Historical Analog */}
      <MemoSection number="03" title="Historical Analogs" badge="Stress Test">
        <div className="space-y-6">
          <p className="max-w-4xl text-sm leading-relaxed text-[#232b25]">
            {briefing.historicalAnalog.setup}
          </p>

          {/* Historical Analogs Match Table */}
          <div className="overflow-x-auto rounded border border-[#141918]/12 bg-[#fcf9f2] shadow-sm">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-[#141918]/15 bg-[#141918]/[0.03] font-mono text-[10px] uppercase tracking-[0.14em] text-[#486326]">
                <tr>
                  <th className="py-3.5 pl-4 pr-3">Precedent Ticker</th>
                  <th className="py-3.5 px-3">Session Date</th>
                  <th className="py-3.5 px-3">Similarity Metric</th>
                  <th className="py-3.5 pr-4 pl-3">Empirical Follow-Through</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141918]/[0.06]">
                {briefing.historicalAnalog.analogs.slice(0, 5).map((item, index) => (
                  <tr key={index} className="transition hover:bg-[#141918]/[0.02]">
                    <td className="py-3.5 pl-4 pr-3 font-mono font-bold text-[#1a221c]">
                      {item.ticker}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[#617063]">{item.date}</td>
                    <td className="py-3.5 px-3 font-mono text-[#617063]">{item.similarity}</td>
                    <td className="py-3.5 pr-4 pl-3 text-[#222b24] font-medium">{item.followed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Base Rates Briefing Cards if present */}
          {briefing.historicalAnalog.baseRates?.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {briefing.historicalAnalog.baseRates.map((item) => (
                <div
                  key={item.horizon}
                  className="rounded-sm border border-[#141918]/12 bg-[#fcf9f2] p-3.5 sm:p-4 shadow-sm"
                >
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#486326]">
                    {item.horizon} · Sample n={item.n}
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-snug text-[#1a221c]">{item.range}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#637265]">{item.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Quantile Distribution Range Bar */}
          <UnsignedRanges ranges={pillarData?.analogs.ranges ?? []} />

          {/* Normalized SVG Trajectory Chart */}
          <AnalogOverlay overlays={pillarData?.analogs.overlay ?? []} />

          <p className="mt-4 max-w-4xl text-xs leading-relaxed text-[#637265] italic">
            {briefing.historicalAnalog.caveat}
          </p>
        </div>
      </MemoSection>

      {/* Section 04: Considerations */}
      <MemoSection number="04" title="Considerations for the Trader" shaded badge="Risk Matrix">
        <ConsiderationsSection considerations={briefing.considerations} />
      </MemoSection>

      {/* Human Decision Record */}
      <DecisionRecord decisionNote={decisionNote} onDecisionNoteChange={onDecisionNoteChange} />
    </article>
  );
}
