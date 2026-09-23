"use client";

import { FormEvent } from "react";
import { IntakeForm, Instrument } from "./IntakeForm";
import { PipelineChecklist, PillarState } from "./PipelineSidebar";
import type { TradingStyle } from "@/lib/types";

interface IntakeViewProps {
  style: TradingStyle;
  onStyleChange: (style: TradingStyle) => void;
  symbol: string;
  onInstrumentChange: (symbol: string) => void;
  instruments: Instrument[];
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
        <div className="mb-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-sm border border-[#d4ff3f]/30 bg-[#d4ff3f]/[0.05] px-4 py-3 sm:px-5 sm:py-3.5 text-xs text-[#d4ff3f] backdrop-blur-md shadow-[0_0_24px_rgba(212,255,63,0.06)]">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-[#d4ff3f] animate-pulse shrink-0" />
            <span className="font-medium text-[#eef7d5]">Active research memo ready for review</span>
          </div>
          <button
            type="button"
            onClick={onViewPreviousResults}
            className="group flex min-h-[44px] sm:min-h-0 items-center justify-center sm:justify-start gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white hover:text-[#d4ff3f] transition"
          >
            <span>View Research Memo</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>
        </div>
      )}

      {/* Hero Headline Area */}
      <div className="relative mb-10 text-center sm:mb-14">
        {/* Geometric corner ticks framing the hero */}
        <svg aria-hidden="true" className="pointer-events-none absolute -left-1 -top-2 hidden h-6 w-6 text-[#d4ff3f]/40 sm:block" viewBox="0 0 24 24" fill="none">
          <path d="M2 22V2h20" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <svg aria-hidden="true" className="pointer-events-none absolute -right-1 -top-2 hidden h-6 w-6 text-[#d4ff3f]/40 sm:block" viewBox="0 0 24 24" fill="none">
          <path d="M22 22V2H2" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#d4ff3f]/25 bg-[#d4ff3f]/[0.04] px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d4ff3f] backdrop-blur-md sm:text-[11px] sm:tracking-[0.22em] shadow-[0_0_16px_rgba(212,255,63,0.08)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff3f] shrink-0 shadow-[0_0_8px_#d4ff3f]" />
          <span className="truncate">✦ Institutional Research Workbench · Bitget rTokens</span>
        </div>

        {/* Line — diamond — line rule guiding the eye down to the headline */}
        <div className="mt-7 flex items-center justify-center gap-3" aria-hidden="true">
          <span className="h-px w-14 sm:w-20 bg-gradient-to-r from-transparent to-[#d4ff3f]/50" />
          <svg className="h-2.5 w-2.5 text-[#d4ff3f]" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 0L10 5L5 10L0 5Z" />
          </svg>
          <span className="h-px w-14 sm:w-20 bg-gradient-to-l from-transparent to-[#d4ff3f]/50" />
        </div>

        <h1 className="mt-6 font-display tracking-[-0.03em]">
          <span className="block text-lg italic font-normal leading-snug text-[#7d8d9b] sm:text-2xl">
            Turn market curiosity into clarity.
          </span>
          <span className="mt-3 block bg-gradient-to-r from-white via-[#d4ff3f] to-[#a3d924] bg-clip-text text-4xl font-semibold leading-[1.06] text-transparent sm:text-6xl md:text-7xl">
            Craft your institutional research memo.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-xs sm:text-sm md:text-[15px] leading-relaxed text-[#8a9aa8]">
          Harmonize corporate fundamentals, live 24/7 venue order flow, social discourse, and 10-year historical precedents into one beautifully structured memo — keeping your judgment sovereign.
        </p>

        {/* Prominent One-Click Recommended Demo Walkthrough */}
        {onLoadDemo && (
          <div className="mt-7 flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              onClick={onLoadDemo}
              disabled={busy}
              className="group inline-flex min-h-[44px] items-center gap-3 rounded-sm border border-[#d4ff3f]/70 bg-[#d4ff3f]/15 px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#d4ff3f] shadow-[0_0_24px_rgba(212,255,63,0.25)] backdrop-blur-md transition-all hover:bg-[#d4ff3f] hover:text-[#080b0e] hover:shadow-[0_0_36px_rgba(212,255,63,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4ff3f] opacity-75 group-hover:bg-[#080b0e]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d4ff3f] group-hover:bg-[#080b0e]" />
              </span>
              <span>⚡ Load recommended demo (AAPL Swing Setup)</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </button>
            <span className="font-mono text-[10px] text-[#718292]">
              Instant deterministic walkthrough · 5 evidence streams · Evaluated in &lt;8s
            </span>
          </div>
        )}

        {/* Subtle downward cue into the intake form */}
        <div className="mt-8 flex flex-col items-center gap-1.5" aria-hidden="true">
          <span className="h-8 w-px bg-gradient-to-b from-[#d4ff3f]/50 to-transparent" />
          <svg className="h-2 w-2 rotate-45 text-[#d4ff3f]/80" viewBox="0 0 10 10" fill="currentColor">
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
          selectedInstrument={selectedInstrument}
          question={question}
          onQuestionChange={onQuestionChange}
          busy={busy}
          onSubmit={onSubmit}
          onLoadDemo={onLoadDemo}
          onFillDemo={onFillDemo}
        />

        {/* Compact Vertical Checklist of the Four Pillars */}
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
          <div className="mt-6 rounded-sm border border-[#f07867]/40 bg-[#f07867]/[0.08] px-5 py-4 text-xs text-[#ffb1a6] shadow-sm">
            <span className="font-semibold uppercase tracking-wider text-[#f07867]">Intake Error: </span>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
