"use client";

import { STYLES } from "@/lib/style-profiles";
import { MemoSection } from "./MemoSection";
import { EvidenceSection } from "./EvidenceSection";
import { TensionSection } from "./TensionSection";
import { AnalogOverlay } from "./AnalogOverlay";
import { UnsignedRanges } from "./UnsignedRanges";
import { ConsiderationsSection } from "./ConsiderationsSection";
import { DecisionRecord } from "./DecisionRecord";
import { aggregatePillarScore, fundamentalsScore, sentimentScore, technicalsScore, type PillarScore } from "@/lib/pillar-scores";
import type { Briefing, PillarBundle, TradingStyle } from "@/lib/types";

interface ResearchMemoProps {
  briefing: Briefing;
  style: TradingStyle;
  pillarData: PillarBundle | null;
  decisionNote: string;
  onDecisionNoteChange: (value: string) => void;
}

function getUnverifiedCaveats(briefing: Briefing, pillarData: PillarBundle | null): string[] {
  const list: string[] = [];

  if (briefing.unverified && Array.isArray(briefing.unverified)) {
    briefing.unverified.forEach((item) => {
      if (typeof item === "string" && item.trim() && !list.includes(item.trim())) {
        list.push(item.trim());
      }
    });
  }

  if (pillarData) {
    if (!pillarData.fundamentals || !pillarData.fundamentals.ok) {
      const err = pillarData.fundamentals?.error;
      const msg = err && /cik/i.test(err)
        ? `Fundamentals partial — ${err}`
        : err
        ? `Fundamentals partial — ${err}`
        : "Fundamentals partial — no SEC CIK available for this rToken.";
      if (!list.some((c) => c.toLowerCase().includes("fundamentals"))) {
        list.push(msg);
      }
    }

    if (!pillarData.technicals || !pillarData.technicals.ok) {
      const err = pillarData.technicals?.error;
      const msg = err
        ? `Technicals & Tape partial — ${err}`
        : "Technicals & Tape partial — Bitget venue order flow or cash session spread unavailable.";
      if (!list.some((c) => c.toLowerCase().includes("technicals"))) {
        list.push(msg);
      }
    }

    if (!pillarData.news || !pillarData.news.ok) {
      const err = pillarData.news?.error;
      const msg = err
        ? `News & Macro partial — ${err}`
        : "News & Macro partial — multi-channel news flow was incomplete.";
      if (!list.some((c) => c.toLowerCase().includes("news"))) {
        list.push(msg);
      }
    } else if (pillarData.news.caveats?.length) {
      pillarData.news.caveats.forEach((c) => {
        if (!list.some((item) => item.includes(c))) {
          list.push(`News & Macro note — ${c}`);
        }
      });
    }

    const n = pillarData.analogs?.sample?.n ?? briefing.historicalStressTest?.sampleSize ?? 0;
    if (!pillarData.analogs || !pillarData.analogs.ok || n === 0) {
      if (!list.some((c) => c.toLowerCase().includes("analog"))) {
        list.push("Historical analog matches unavailable — 0 past cases found.");
      }
    } else if (n > 0 && n < 30) {
      if (!list.some((c) => c.toLowerCase().includes("analog sample is limited"))) {
        list.push(`Historical analog sample is limited (${n} cases).`);
      }
    }
  } else {
    const n = briefing.historicalStressTest?.sampleSize ?? 0;
    if (n === 0 && !list.some((c) => c.toLowerCase().includes("analog"))) {
      list.push("Historical analog matches unavailable — 0 past cases found.");
    } else if (n > 0 && n < 30 && !list.some((c) => c.toLowerCase().includes("analog sample is limited"))) {
      list.push(`Historical analog sample is limited (${n} cases).`);
    }
  }

  return list;
}

export function ResearchMemo({
  briefing,
  style,
  pillarData,
  decisionNote,
  onDecisionNoteChange,
}: ResearchMemoProps) {
  const scores = {
    sentiment: sentimentScore(pillarData?.news),
    fundamentals: fundamentalsScore(pillarData?.fundamentals),
    technicals: technicalsScore(pillarData?.technicals),
  };
  const aggregate = aggregatePillarScore(Object.values(scores));
  const unverifiedCaveats = getUnverifiedCaveats(briefing, pillarData);

  return (
    <article className="mt-6 sm:mt-12 overflow-hidden rounded-sm border border-white/[0.14] bg-[#f5f0e6] text-[#141918] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.75)]">
      {/* Editorial Document Header */}
      <header className="border-b border-[#141918]/15 bg-[#ece6dd] px-4 py-6 sm:px-10 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {briefing.isSample ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 rounded-sm border border-[#b91c1c]/40 bg-[#b91c1c]/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#991b1b]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
                  Sample data · Not live market data
                </span>
              ) : null}
              {briefing.isFallback ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#b45309]/30 bg-[#b45309]/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#92400e]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" />
                  Quantitative Research Memo · Empirical Baseline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#486326]/30 bg-[#486326]/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#36521a]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#486326]" />
                  ✦ Institutional Research Memo · Verified Streams
                </span>
              )}
              <span className="text-[#88998a]">·</span>
              <span className="font-mono text-[10px] uppercase text-[#637566]">
                {(() => {
                  let displayModel = briefing.model || "Precedent Quantitative Desk";
                  displayModel = displayModel.replace(/\s*\(fell back.*?\)/i, "").trim();
                  if (briefing.isFallback) {
                    displayModel = "Precedent Quantitative Desk (fallback)";
                  }
                  return `Engine: ${displayModel}`;
                })()}
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
                  Trading style
                </div>
                <div className="mt-0.5 sm:mt-1 font-semibold text-sm text-[#18201a]">
                  {STYLES[style].label}
                </div>
              </div>
              <div className="sm:mt-2 sm:border-t sm:border-[#141918]/[0.08] sm:pt-2 text-right">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[#738375]">
                  Market context
                </div>
                <div className="font-mono text-xs font-semibold text-[#425828]">
                  {briefing.regime ? "Shown for context only" : "Not available"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="border-b border-[#141918]/15 bg-[#f8f5ee] px-4 py-6 sm:px-10 sm:py-8">
        {/* Dedicated "What we could not fully verify" block */}
        {unverifiedCaveats.length > 0 && (
          <div className="mb-6 rounded-sm border border-[#d97706]/40 bg-[#fffbeb] p-4 sm:p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#d97706]/20 font-mono text-[10px] font-bold text-[#b45309]">
                  !
                </span>
                <h4 className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-[#b45309]">
                  ✦ Data Availability & Verification Caveats
                </h4>
              </div>
              <span className="font-mono text-[10px] text-[#92400e]">
                {unverifiedCaveats.length} caveat{unverifiedCaveats.length > 1 ? "s" : ""} on record
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-[#78350f]">
              {unverifiedCaveats.map((caveat, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#b45309] font-bold select-none">•</span>
                  <span>{caveat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-5">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#486326]">
            ✦ Empirical Precedent & Stress Test
          </div>
          <h3 className="mt-2 font-display text-2xl font-medium text-[#111513] sm:text-3xl">
            How did similar market patterns unfold in history?
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#3f4c41]">{briefing.whatWeDid}</p>
        </div>

        <div className="rounded-sm border border-[#486326]/25 bg-[#fcf9f2] p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#486326]">
              Historical Precedent Distribution
            </h4>
            <span className="inline-flex items-center rounded bg-[#486326]/10 px-2.5 py-1 font-mono text-xs font-semibold text-[#38521d]">
              {briefing.historicalStressTest.sampleSize > 0
                ? `${briefing.historicalStressTest.sampleSize} historical precedents matched`
                : "0 past cases matched"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#232b25]">
            {briefing.historicalStressTest.summary}
          </p>

          {/* Normalized SVG Trajectory Chart — visual centerpiece of the stress test */}
          {(pillarData?.analogs?.overlay?.length ?? 0) > 0 && (
            <AnalogOverlay overlays={pillarData?.analogs.overlay ?? []} />
          )}

          {/* Quantile Distribution Range Bar */}
          {(pillarData?.analogs?.ranges?.length ?? 0) > 0 && (
            <UnsignedRanges ranges={pillarData?.analogs.ranges ?? []} />
          )}

          {briefing.historicalStressTest.results.length > 0 ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {briefing.historicalStressTest.results.map((result) => {
                  const wentUpText = result.wentUp.replace(/^went up/i, "Went up");
                  const typicalMoveText = result.typicalMove.startsWith("Typical move: ")
                    ? result.typicalMove
                    : `Typical move: ${result.typicalMove.replace(/^typical move:\s*/i, "")}`;
                  const medianText = result.median.replace(/^middle result:\s*/i, "");
                  const periodLabel = result.period === "Next day" ? "Next 1 trading day" : result.period;

                  return (
                    <div key={result.period} className="rounded-sm border border-[#486326]/25 bg-[#fcf9f2] p-3.5 shadow-sm sm:p-4">
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#486326]">
                        {periodLabel}
                      </div>
                      <p className="mt-2 text-base font-bold leading-snug text-[#1a221c]">{wentUpText}</p>
                      <p className="mt-1 text-xs text-[#4f5e51]">{typicalMoveText}</p>
                      <p className="mt-1 text-xs text-[#637265]">Middle result: {medianText}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs italic leading-relaxed text-[#637265]">
                Historical results are past occurrences only, not predictions.
              </p>
            </>
          ) : (
            <div className="mt-4 rounded-sm border border-dashed border-[#141918]/20 bg-white/60 p-5 text-center">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#637265]">
                No historical matches found
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[#556457] max-w-lg mx-auto">
                No past chart patterns met verification standards for this setup. Historical base rates and outcome cards are unavailable for this run. Decisions should be grounded in live technical levels and fundamental catalysts.
              </p>
            </div>
          )}

          {briefing.historicalStressTest.sampleSize > 0 && briefing.historicalStressTest.sampleSize < 30 && (
            <div className="mt-3.5 flex items-center gap-2 rounded border border-[#d97706]/30 bg-[#d97706]/10 px-3 py-2 text-xs text-[#92400e]">
              <span className="font-bold">Caution:</span>
              <span>Sample size is below 30 ({briefing.historicalStressTest.sampleSize} past cases matched). Historical patterns with fewer than 30 matches carry higher variance and lower statistical reliability.</span>
            </div>
          )}

          {(() => {
            const validExamples = (briefing.historicalStressTest.examples ?? [])
              .filter(
                (example) =>
                  example?.when &&
                  example?.whatHappened &&
                  !/\b(n\/?a|null|undefined|moved\s+n\/?a)\b/i.test(example.whatHappened) &&
                  !/\b(n\/?a|null|undefined)\b/i.test(example.when) &&
                  /\d/.test(example.whatHappened),
              )
              .sort((a, b) => {
                const aCross = /cross[- ]ticker|similar chart|different stock/i.test(a.when) ? 1 : 0;
                const bCross = /cross[- ]ticker|similar chart|different stock/i.test(b.when) ? 1 : 0;
                return aCross - bCross;
              })
              .slice(0, 3);

            if (!validExamples.length) return null;

            return (
              <div className="mt-5">
                <h5 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#486326]">
                  A few past examples
                </h5>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[#3f4c41]">
                  {validExamples.map((example) => {
                    const isCross = /cross[- ]ticker|similar chart|different stock/i.test(example.when);
                    return (
                      <li key={`${example.when}-${example.whatHappened}`}>
                        <span className="font-semibold">{example.when}:</span> {example.whatHappened}
                        {isCross && !example.when.includes("cross-ticker") && (
                          <span className="ml-2 rounded bg-[#141918]/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#637265]">
                            cross-ticker
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded border border-[#141918]/10 bg-[#fcf9f2] p-4">
            <h4 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#486326]">✦ Cross-Pillar Observations</h4>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#3f4c41]">
              {briefing.otherThingsWeChecked.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded border border-[#141918]/10 bg-[#fcf9f2] p-4">
            <h4 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#486326]">✦ Core Executive Takeaways</h4>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#3f4c41]">
              {briefing.simpleTakeAways.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded border border-[#141918]/10 bg-[#fcf9f2] p-4">
            <h4 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#486326]">✦ Deliberative Trader Questions</h4>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#3f4c41]">
              {briefing.questionsOnlyYouCanAnswer.slice(0, 3).map((item) => <li key={item}>? {item}</li>)}
            </ul>
          </div>
        </div>

        {briefing.whereThingsDoNotAgree.length > 0 && (
          <div className="mt-5 rounded border border-[#141918]/10 bg-[#fcf9f2] p-4">
            <h4 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#486326]">✦ Signal Divergences & Tensions</h4>
            <ul className="mt-3 space-y-3 text-xs leading-relaxed text-[#3f4c41]">
              {briefing.whereThingsDoNotAgree.slice(0, 3).map((item) => (
                <li key={item.conflict}>
                  <span className="font-semibold">{item.conflict}</span> {item.whyItMatters}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <details className="border-b border-[#141918]/15 bg-[#f5f0e6]">
        <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#3c5522] sm:px-10">
          <svg aria-hidden="true" className="h-2 w-2 shrink-0 text-[#425828]" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 0L10 5L5 10L0 5Z" />
          </svg>
          Empirical Evidence & Cross-Pillar Signals
        </summary>
        <div className="border-t border-[#141918]/10">
          <MemoSection number="01" title="Verified Evidence & Source Attribution" badge="Primary Streams">
            <EvidenceSection
              evidence={briefing.evidence}
              flags={briefing.flags}
              marketStructure={pillarData?.marketStructure}
              news={pillarData?.news}
              scores={scores}
            />
          </MemoSection>
          <MemoSection number="02" title="Where the Signals Diverge" shaded badge="Active Tensions">
            <TensionSection tension={briefing.tension} />
          </MemoSection>
        </div>
      </details>

      <details className="border-b border-[#141918]/15 bg-[#f5f0e6]">
        <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#3c5522] sm:px-10">
          <svg aria-hidden="true" className="h-2 w-2 shrink-0 text-[#425828]" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 0L10 5L5 10L0 5Z" />
          </svg>
          Historical Chart Precedents & Empirical Ranges
        </summary>
        <MemoSection number="03" title="Historical Analogs & Trajectory Overlay" badge="Precedents">
        <div className="space-y-6">
          <p className="max-w-4xl text-sm leading-relaxed text-[#232b25]">
            {briefing.historicalAnalog.setup}
          </p>

          {/* Historical Analogs Match Table */}
          <div className="overflow-x-auto rounded border border-[#141918]/12 bg-[#fcf9f2] shadow-sm">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-[#141918]/15 bg-[#141918]/[0.03] font-mono text-[10px] uppercase tracking-[0.14em] text-[#486326]">
                <tr>
                  <th className="py-3.5 pl-4 pr-3">Historical Setup</th>
                  <th className="py-3.5 px-3">Date / Episode</th>
                  <th className="py-3.5 px-3">Pattern Similarity</th>
                  <th className="py-3.5 pr-4 pl-3">Follow-Through Return</th>
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

          {/* Trajectory overlay & quantile range bars are promoted into the
              Historical Precedent Distribution card above (the memo's star
              visual); this section keeps the tabular precedent detail. */}

          <p className="mt-4 max-w-4xl text-xs leading-relaxed text-[#637265] italic">
            {briefing.historicalAnalog.caveat}
          </p>
        </div>
        </MemoSection>
      </details>

      <details className="border-b border-[#141918]/15 bg-[#f5f0e6]">
        <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#3c5522] sm:px-10">
          <svg aria-hidden="true" className="h-2 w-2 shrink-0 text-[#425828]" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 0L10 5L5 10L0 5Z" />
          </svg>
          Diagnostic Scores, Invalidation Triggers & Plan Questions
        </summary>
        <MemoSection number="04" title="Quantitative Scoring & Plan Boundaries" shaded badge="Governance">
          <ConsiderationsSection
            considerations={briefing.considerations}
            scores={scores}
            aggregate={aggregate}
            analogs={pillarData?.analogs}
            analogQuality={briefing.flags?.analogQuality}
          />
        </MemoSection>
      </details>

      {/* Human Decision Record */}
      <DecisionRecord decisionNote={decisionNote} onDecisionNoteChange={onDecisionNoteChange} />
    </article>
  );
}
