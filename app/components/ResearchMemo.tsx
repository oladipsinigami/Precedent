"use client";

import { STYLES } from "@/lib/style-profiles";
import { MemoSection } from "./MemoSection";
import { EvidenceSection } from "./EvidenceSection";
import { RiskSection } from "./RiskSection";
import { TensionSection } from "./TensionSection";
import { AnalogOverlay } from "./AnalogOverlay";
import { UnsignedRanges } from "./UnsignedRanges";
import { ConsiderationsSection } from "./ConsiderationsSection";
import { DecisionRecord } from "./DecisionRecord";
import { fundamentalsScore, sentimentScore, summarizePillarCoverage, technicalsScore, type PillarScore } from "@/lib/pillar-scores";
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

    if (!pillarData.marketStructure || !pillarData.marketStructure.ok) {
      const msg = pillarData.marketStructure?.error
        ? `Market Structure partial — ${pillarData.marketStructure.error}`
        : "Market Structure partial — RMT peer-community snapshot unavailable.";
      if (!list.some((c) => c.toLowerCase().includes("market structure"))) list.push(msg);
    } else if (pillarData.marketStructure.stale) {
      const msg = `Market Structure stale — snapshot computed ${pillarData.marketStructure.computedAt ?? "at an unknown time"}; refresh the scheduled precompute.`;
      if (!list.some((c) => c.toLowerCase().includes("market structure"))) list.push(msg);
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
  const coverage = summarizePillarCoverage([
    scores.sentiment.value !== null,
    scores.fundamentals.value !== null,
    scores.technicals.value !== null,
    Boolean(pillarData?.analogs?.ok),
    Boolean(pillarData?.marketStructure?.ok && !pillarData.marketStructure.stale),
  ]);
  const unverifiedCaveats = getUnverifiedCaveats(briefing, pillarData);

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

  return (
    <article className="mt-6 sm:mt-12 overflow-hidden rounded-sm border border-white/[0.14] bg-paper-alt text-shell shadow-[0_30px_90px_-20px_rgba(0,0,0,0.75)]">
      {/* Editorial Document Header */}
      <header className="border-b border-shell/15 bg-paper-deep px-4 py-6 sm:px-10 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {briefing.isSample ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-1.5 rounded-sm border border-alert-deep/40 bg-alert-deep/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-alert-deep" />
                  Sample data · Not live market data
                </span>
              ) : null}
              {briefing.isFallback ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-amber-deep/30 bg-amber-deep/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                  Quantitative Research Memo · Empirical Baseline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-moss/30 bg-moss/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-moss-deep">
                  <span className="h-1.5 w-1.5 rounded-full bg-moss" />
                  ✦ Institutional Desk Note · Clerk of Evidence
                </span>
              )}
              <span className="text-mute">·</span>
              <span className="font-mono text-[10px] uppercase text-mute-dim">
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

            <h2 className="mt-3 sm:mt-4 font-display text-2xl font-medium leading-[1.16] tracking-[-0.03em] text-shell sm:text-4xl md:text-5xl">
              {briefing.title}
            </h2>

            {briefing.styleNote && (
              <p className="mt-2.5 sm:mt-3.5 text-xs leading-relaxed text-mute-faint font-medium max-w-2xl">
                {briefing.styleNote}
              </p>
            )}
          </div>

          <div className="w-full sm:w-auto sm:min-w-[200px] rounded border border-shell/12 bg-paper p-3.5 sm:p-4 text-left sm:text-right shadow-sm shrink-0">
            <div className="flex items-center justify-between sm:block">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Trading style
                </div>
                <div className="mt-0.5 sm:mt-1 font-semibold text-sm text-shell">
                  {STYLES[style].label}
                </div>
              </div>
              <div className="sm:mt-2 sm:border-t sm:border-shell/[0.08] sm:pt-2 text-right">
                <div className="font-mono text-[9px] uppercase tracking-wider text-ink-faint">
                  Market context
                </div>
                <div className="font-mono text-xs font-semibold text-moss">
                  {briefing.regime ? "Shown for context only" : "Not available"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* The fit verdict is the first thing after the header: the one number the
          tool exists to produce, at the top of the first screen. */}
      {pillarData?.risk && (
        <section className="border-b-2 border-lime/35 bg-paper px-4 py-6 sm:px-10 sm:py-8" data-tour="tour-risk-verdict">
          <RiskSection risk={pillarData.risk} />
        </section>
      )}

      {/* TOP SECTION: Executive Research Summary & Takeaways */}
      <section className="border-b border-shell/15 bg-paper px-4 py-6 sm:px-10 sm:py-8">
        {/* Dedicated "What we could not fully verify" block */}
        {unverifiedCaveats.length > 0 && (
          <div className="mb-6 rounded-sm border border-amber/40 bg-paper p-4 sm:p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber/20 font-mono text-[10px] font-bold text-amber-deep">
                  !
                </span>
                <h4 className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-amber-deep">
                  ✦ Data Availability & Verification Caveats
                </h4>
              </div>
              <span className="font-mono text-[10px] text-warn">
                {unverifiedCaveats.length} caveat{unverifiedCaveats.length > 1 ? "s" : ""} on record
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-warn">
              {unverifiedCaveats.map((caveat, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-deep font-bold select-none">•</span>
                  <span>{caveat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Executive Summary Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-moss">
                ✦ Clerk of Evidence · Desk Briefing
              </div>
              <h3 className="mt-2 font-display text-2xl font-medium text-shell sm:text-3xl">
                Evidence cross-examination & setup briefing
              </h3>
            </div>
            <a
              href="#advanced-precedents"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("advanced-precedents")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1.5 rounded-sm border border-moss/30 bg-moss/10 px-3.5 py-2 font-mono text-xs font-semibold text-moss-deep transition hover:bg-moss/20 self-start sm:self-auto shrink-0 shadow-sm"
            >
              <span>View Full Trajectory Charts & Deep Telemetry</span>
              <span aria-hidden="true">↓</span>
            </a>
          </div>
          {briefing.whatWeDid && (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-moss-alt font-medium">
              {briefing.whatWeDid}
            </p>
          )}
        </div>

        {/* Precedent Quick Snapshot */}
        <div className="mb-6 rounded-sm border border-moss/25 bg-paper p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-moss/20 font-mono text-[10px] font-bold text-moss-deep">
                ✦
              </span>
              <h4 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-moss">
                10-Year Historical Rhyme & Dispersion
              </h4>
            </div>
            <span className="inline-flex items-center rounded bg-moss/10 px-2.5 py-1 font-mono text-xs font-semibold text-moss-deep">
              {briefing.historicalStressTest.sampleSize > 0
                ? `${briefing.historicalStressTest.sampleSize} historical cases matched`
                : "0 past cases matched"}
            </span>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-body">
            {briefing.historicalStressTest.summary}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-shell/[0.08] pt-3 text-xs text-mute-faint">
            <span>Detailed trajectory overlays, quantile ranges, and matching episodes are organized at the bottom.</span>
            <a
              href="#advanced-precedents"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("advanced-precedents")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="font-mono text-[11px] font-semibold text-moss underline hover:text-moss-deep"
            >
              Jump to charts ↓
            </a>
          </div>
        </div>

        {/* 3-Column Core Takeaways Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1: Core Verified Takeaways */}
          <div className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-moss">
                  ✦ Core Verified Takeaways
                </h4>
                <span className="font-mono text-[10px] text-ink-faint">01 / Takeaways</span>
              </div>
              <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-ink-body">
                {briefing.simpleTakeAways.slice(0, 4).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-moss font-bold select-none">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Card 2: Witness Clashes & Divergences */}
          <div className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-deep">
                  ✦ Witness Clashes & Divergences
                </h4>
                <span className="font-mono text-[10px] text-ink-faint">02 / Divergences</span>
              </div>
              {briefing.whereThingsDoNotAgree.length > 0 ? (
                <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-ink-body">
                  {briefing.whereThingsDoNotAgree.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-deep font-bold select-none">•</span>
                      <div>
                        <span className="font-semibold text-ink-strong">{item.conflict}: </span>
                        <span className="text-ink-mute">{item.whyItMatters}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-mute-dim">
                  No direct witness contradictions detected across tape, analog, filing, and discourse streams.
                </p>
              )}
            </div>
          </div>

          {/* Card 3: Pre-Mortem & Invalidation Boundaries */}
          <div className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-moss-deep">
                  ✦ Pre-Mortem & Invalidation
                </h4>
                <span className="font-mono text-[10px] text-ink-faint">03 / Invalidation</span>
              </div>
              <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-ink-body">
                {briefing.questionsOnlyYouCanAnswer.slice(0, 3).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-moss font-bold select-none">?</span>
                    <span className="font-medium text-ink-strong">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Cross-Pillar Checked Streams */}
        {briefing.otherThingsWeChecked?.length > 0 && (
          <div className="mt-4 rounded-sm border border-shell/10 bg-paper p-3.5 text-xs text-ink-mute">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-mute-dim mr-2">
              Cross-Pillar Streams Checked:
            </span>
            {briefing.otherThingsWeChecked.join(" · ")}
          </div>
        )}
      </section>

      {/* COLLAPSIBLE MIDDLE: Empirical Evidence & Cross-Pillar Signals */}
      <details className="border-b border-shell/15 bg-paper-alt">
        <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-moss-deep sm:px-10">
          <svg aria-hidden="true" className="h-2 w-2 shrink-0 text-moss" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 0L10 5L5 10L0 5Z" />
          </svg>
          Empirical Evidence & Cross-Pillar Signals
        </summary>
        <div className="border-t border-shell/10">
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

      {/* COLLAPSIBLE MIDDLE: Diagnostic Scores, Invalidation Triggers & Plan Questions */}
      <details className="border-b border-shell/15 bg-paper-alt">
        <summary className="flex cursor-pointer items-center gap-2.5 px-4 py-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-moss-deep sm:px-10">
          <svg aria-hidden="true" className="h-2 w-2 shrink-0 text-moss" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 0L10 5L5 10L0 5Z" />
          </svg>
          Diagnostic Scores, Invalidation Triggers & Plan Boundaries
        </summary>
        <MemoSection number="03" title="Quantitative Scoring & Plan Boundaries" shaded badge="Governance">
          <ConsiderationsSection
            considerations={briefing.considerations}
            scores={scores}
            coverage={coverage}
            analogs={pillarData?.analogs}
            analogQuality={briefing.flags?.analogQuality}
          />
        </MemoSection>
      </details>

      {/* BOTTOM SECTION: Deep Quantitative Telemetry & Historical Precedents */}
      <div id="advanced-precedents" className="scroll-mt-6 border-b border-shell/15">
        <MemoSection
          number="04"
          title="Historical Analogs & Quantitative Telemetry"
          badge="Deep Telemetry"
        >
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <p className="max-w-3xl text-sm leading-relaxed text-ink-body">
                {briefing.historicalAnalog.setup ||
                  "Normalized historical analog trajectory overlay (rebased to T₀), return dispersion ranges, and matching historical episodes."}
              </p>
              <span className="inline-flex items-center rounded bg-moss/10 px-2.5 py-1 font-mono text-xs font-semibold text-moss-deep self-start sm:self-auto shrink-0">
                {briefing.historicalStressTest.sampleSize > 0
                  ? `${briefing.historicalStressTest.sampleSize} historical precedents matched`
                  : "0 past cases matched"}
              </span>
            </div>

            {/* Normalized SVG Trajectory Chart */}
            {(pillarData?.analogs?.overlay?.length ?? 0) > 0 && (
              <div className="rounded-sm border border-moss/20 bg-paper p-4 sm:p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-moss">
                    Normalized Historical Trajectory Overlay
                  </h4>
                  <span className="font-mono text-[10px] text-mute-dim">
                    Rebased to 100.0 at trigger state (T₀)
                  </span>
                </div>
                <AnalogOverlay overlays={pillarData?.analogs.overlay ?? []} />
              </div>
            )}

            {/* Quantile Distribution Range Bar */}
            {(pillarData?.analogs?.ranges?.length ?? 0) > 0 && (
              <div className="rounded-sm border border-moss/20 bg-paper p-4 sm:p-5 shadow-sm">
                <UnsignedRanges ranges={pillarData?.analogs.ranges ?? []} />
              </div>
            )}

            {/* Empirical Outcome Cards */}
            {briefing.historicalStressTest.results.length > 0 ? (
              <div className="rounded-sm border border-moss/20 bg-paper p-4 sm:p-5 shadow-sm">
                <h4 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-moss mb-3">
                  Historical Outcome Medians & Dispersion
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  {briefing.historicalStressTest.results.map((result) => {
                    const wentUpText = result.wentUp.replace(/^went up/i, "Went up");
                    const typicalMoveText = result.typicalMove.startsWith("Typical move: ")
                      ? result.typicalMove
                      : `Typical move: ${result.typicalMove.replace(/^typical move:\s*/i, "")}`;
                    const medianText = result.median.replace(/^middle result:\s*/i, "");
                    const periodLabel = result.period === "Next day" ? "Next 1 trading day" : result.period;

                    return (
                      <div
                        key={result.period}
                        className="rounded-sm border border-moss/25 bg-white/70 p-3.5 shadow-sm sm:p-4"
                      >
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-moss">
                          {periodLabel}
                        </div>
                        <p className="mt-2 text-base font-bold leading-snug text-ink-strong">{wentUpText}</p>
                        <p className="mt-1 text-xs text-ink-mute">{typicalMoveText}</p>
                        <p className="mt-1 text-xs text-mute-dim">Middle result: {medianText}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs italic leading-relaxed text-mute-dim">
                  Historical results are past occurrences only, not predictions.
                </p>
              </div>
            ) : null}

            {briefing.historicalStressTest.sampleSize > 0 && briefing.historicalStressTest.sampleSize < 30 && (
              <div className="flex items-center gap-2 rounded border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-warn">
                <span className="font-bold">Caution:</span>
                <span>
                  Sample size is below 30 ({briefing.historicalStressTest.sampleSize} past cases matched). Historical patterns with fewer than 30 matches carry higher variance and lower statistical reliability.
                </span>
              </div>
            )}

            {/* Past Examples */}
            {validExamples.length > 0 && (
              <div className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-5 shadow-sm">
                <h5 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-moss">
                  A few past verified occurrences
                </h5>
                <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-moss-alt">
                  {validExamples.map((example) => {
                    const isCross = /cross[- ]ticker|similar chart|different stock/i.test(example.when);
                    return (
                      <li key={`${example.when}-${example.whatHappened}`}>
                        <span className="font-semibold">{example.when}:</span> {example.whatHappened}
                        {isCross && !example.when.includes("cross-ticker") && (
                          <span className="ml-2 rounded bg-shell/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase text-mute-dim">
                            cross-ticker
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Historical Analogs Match Table */}
            <div className="rounded-sm border border-shell/12 bg-paper p-4 sm:p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-moss">
                  Closest Historical Analog Matches
                </h4>
                <span className="font-mono text-[10px] text-mute-dim">Top verified historical chart matches</span>
              </div>

              <div className="overflow-x-auto rounded border border-shell/12 bg-white/70">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-shell/15 bg-shell/[0.03] font-mono text-[10px] uppercase tracking-[0.14em] text-moss">
                    <tr>
                      <th className="py-3.5 pl-4 pr-3">Historical Setup</th>
                      <th className="py-3.5 px-3">Date / Episode</th>
                      <th className="py-3.5 px-3">Pattern Similarity</th>
                      <th className="py-3.5 pr-4 pl-3">Follow-Through Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-shell/[0.06]">
                    {briefing.historicalAnalog.analogs.slice(0, 5).map((item, index) => (
                      <tr key={index} className="transition hover:bg-shell/[0.02]">
                        <td className="py-3.5 pl-4 pr-3 font-mono font-bold text-ink-strong">
                          {item.ticker}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-mute-dim">{item.date}</td>
                        <td className="py-3.5 px-3 font-mono text-mute-dim">{item.similarity}</td>
                        <td className="py-3.5 pr-4 pl-3 text-ink-body font-medium">{item.followed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Base Rates Briefing Cards if present */}
              {briefing.historicalAnalog.baseRates?.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {briefing.historicalAnalog.baseRates.map((item) => (
                    <div
                      key={item.horizon}
                      className="rounded-sm border border-shell/12 bg-white/70 p-3.5 sm:p-4 shadow-sm"
                    >
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-moss">
                        {item.horizon} · Sample n={item.n}
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-snug text-ink-strong">{item.range}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-mute-dim">{item.note}</p>
                    </div>
                  ))}
                </div>
              )}

              {briefing.historicalAnalog.caveat && (
                <p className="mt-4 max-w-4xl text-xs leading-relaxed text-mute-dim italic">
                  {briefing.historicalAnalog.caveat}
                </p>
              )}
            </div>
          </div>
        </MemoSection>
      </div>

      {/* Human Decision Record */}
      <DecisionRecord decisionNote={decisionNote} onDecisionNoteChange={onDecisionNoteChange} />
    </article>
  );
}
