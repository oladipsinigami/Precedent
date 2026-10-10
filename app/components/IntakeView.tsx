"use client";

import { FormEvent } from "react";
import { TradeIntentBar } from "./TradeIntentBar";
import { IntakeForm, Instrument } from "./IntakeForm";
import { PipelineChecklist, PillarState } from "./PipelineSidebar";
import type { TradingStyle } from "@/lib/types";

interface IntakeViewProps {
  style: TradingStyle;
  onStyleChange: (style: TradingStyle) => void;
  symbol: string;
  onInstrumentChange: (symbol: string) => void;
  instruments: Instrument[];
  universeMeta: { source: "live" | "fallback"; count: number; asOf: string | null };
  selectedInstrument: Instrument | undefined;
  question: string;
  onQuestionChange: (question: string) => void;
  busy: boolean;
  onSubmit: (event?: FormEvent) => void;
  error: string;
  statuses: PillarState;
  hasPreviousBriefing: boolean;
  onViewPreviousResults: () => void;
  stage?: "idle" | "pillars" | "synthesis" | "complete";
  pillarMessages?: Record<string, string>;
  onLoadDemo?: () => void;
  onFillDemo?: () => void;
}

export function IntakeView({
  style,
  onStyleChange,
  symbol,
  onInstrumentChange,
  instruments,
  universeMeta,
  selectedInstrument,
  question,
  onQuestionChange,
  busy,
  onSubmit,
  error,
  statuses,
  hasPreviousBriefing,
  onViewPreviousResults,
  stage = "idle",
  pillarMessages = {},
  onLoadDemo,
  onFillDemo,
}: IntakeViewProps) {

  return (
    <div className="mx-auto max-w-4xl py-5 sm:py-12">
      {/* Shortcut to previous memo if one exists */}
      {hasPreviousBriefing && !busy && (
        <div className="mb-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-sm border border-lime/30 bg-lime/[0.05] px-4 py-3 sm:px-5 sm:py-3.5 text-xs text-lime backdrop-blur-md shadow-[0_0_24px_rgba(212,255,63,0.06)]">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-lime animate-pulse shrink-0" />
            <span className="font-medium text-lime-wash">Active research memo ready for review</span>
          </div>
          <button
            type="button"
            onClick={onViewPreviousResults}
            className="group flex min-h-[44px] sm:min-h-0 items-center justify-center sm:justify-start gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white hover:text-lime transition"
          >
            <span>View Research Memo</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>
        </div>
      )}

      {/* The trade question comes first, above the headline. */}
      <TradeIntentBar
        question={question}
        onQuestionChange={onQuestionChange}
        busy={busy}
        onSubmit={onSubmit}
        error={error || undefined}
      />

      {/* Hero Headline Area */}
      <div className="relative mb-10 text-center sm:mb-14">
        {/* Geometric corner ticks framing the hero */}
        <svg aria-hidden="true" className="pointer-events-none absolute -left-1 -top-2 hidden h-6 w-6 text-lime/40 sm:block" viewBox="0 0 24 24" fill="none">
          <path d="M2 22V2h20" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <svg aria-hidden="true" className="pointer-events-none absolute -right-1 -top-2 hidden h-6 w-6 text-lime/40 sm:block" viewBox="0 0 24 24" fill="none">
          <path d="M22 22V2H2" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-lime/25 bg-lime/[0.04] px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-lime backdrop-blur-md sm:text-[11px] sm:tracking-[0.22em] shadow-[0_0_16px_rgba(212,255,63,0.08)]">
          <span className="h-1.5 w-1.5 rounded-full bg-lime shrink-0 shadow-[0_0_8px_var(--c-lime)]" />
          <span className="truncate">✦ Institutional Research Workbench · Bitget rTokens</span>
        </div>

        {/* Line — diamond — line rule guiding the eye down to the headline */}
        <div className="mt-7 flex items-center justify-center gap-3" aria-hidden="true">
          <span className="h-px w-14 sm:w-20 bg-gradient-to-r from-transparent to-lime/50" />
          <svg className="h-2.5 w-2.5 text-lime" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 0L10 5L5 10L0 5Z" />
          </svg>
          <span className="h-px w-14 sm:w-20 bg-gradient-to-l from-transparent to-lime/50" />
        </div>

        <h1 className="mt-6 font-display tracking-[-0.03em]">
          <span className="block text-sm italic font-normal leading-snug text-slate-line sm:text-base">
            Turn market curiosity into clarity.
          </span>
          <span className="mt-2 block bg-gradient-to-r from-white via-lime to-lime-deep bg-clip-text text-xl font-semibold leading-tight text-transparent sm:text-2xl">
            Then cross-examine the evidence behind it.
          </span>
        </h1>

        <p className="mx-auto mt-3 max-w-2xl text-[11px] sm:text-xs leading-relaxed text-slate-text">
          Corporate fundamentals, 24/7 tokenized-venue context, social discourse, market structure and 10-year historical
          precedents — structured, attributed, and never a forecast.
        </p>

        {/* Prominent One-Click Recommended Demo Walkthrough */}
        {onLoadDemo && (
          <div className="mt-7 flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              onClick={onLoadDemo}
              disabled={busy}
              className="group inline-flex min-h-[44px] items-center gap-3 rounded-sm border border-lime/70 bg-lime/15 px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-lime shadow-[0_0_24px_rgba(212,255,63,0.25)] backdrop-blur-md transition-all hover:bg-lime hover:text-blot hover:shadow-[0_0_36px_rgba(212,255,63,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75 group-hover:bg-blot" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lime group-hover:bg-blot" />
              </span>
              <span>⚡ Load recommended demo (AAPL Swing Setup)</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </button>
            <span className="font-mono text-[10px] text-slate-line">
              Instant deterministic walkthrough · 5 evidence streams · Evaluated in &lt;8s
            </span>
          </div>
        )}

        {/* Subtle downward cue into the intake form */}
        <div className="mt-8 flex flex-col items-center gap-1.5" aria-hidden="true">
          <span className="h-8 w-px bg-gradient-to-b from-lime/50 to-transparent" />
          <svg className="h-2 w-2 rotate-45 text-lime/80" viewBox="0 0 10 10" fill="currentColor">
            <rect width="10" height="10" />
          </svg>
        </div>
      </div>

      {/* Main Intake Form */}
      <div className="relative">
        <IntakeForm
          style={style}
          onStyleChange={onStyleChange}
          symbol={symbol}
          onInstrumentChange={onInstrumentChange}
          instruments={instruments}
          universeMeta={universeMeta}
          selectedInstrument={selectedInstrument}
          question={question}
          onQuestionChange={onQuestionChange}
          busy={busy}
          onSubmit={onSubmit}
          onLoadDemo={onLoadDemo}
          onFillDemo={onFillDemo}
        />

        {/* Compact Vertical Checklist of the Five Evidence Streams */}
        {busy && (
          <PipelineChecklist
            statuses={statuses}
            messages={pillarMessages}
            stage={stage}
            busy={busy}
          />
        )}

        {/* Error Callout */}
        {error && (
          <div className="mt-6 rounded-sm border border-alert/40 bg-alert/[0.08] px-5 py-4 text-xs text-alert-wash shadow-sm">
            <span className="font-semibold uppercase tracking-wider text-alert">Intake Error: </span>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
