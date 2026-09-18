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
      <div className="mb-8 text-center sm:mb-12">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#d4ff3f]/25 bg-[#d4ff3f]/[0.04] px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d4ff3f] backdrop-blur-md sm:text-[11px] sm:tracking-[0.22em] shadow-[0_0_16px_rgba(212,255,63,0.08)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff3f] shrink-0 shadow-[0_0_8px_#d4ff3f]" />
          <span className="truncate">✦ Institutional Research Workbench · Bitget rTokens</span>
        </div>

        <h1 className="mt-5 font-display text-3xl sm:text-5xl md:text-6xl font-normal leading-[1.12] tracking-[-0.03em] text-white">
          Turn market curiosity into clarity. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-[#e7ebef] via-[#d4ff3f]/90 to-[#a3d924] bg-clip-text text-transparent font-medium">
            Craft your institutional research memo.
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-xs sm:text-sm md:text-[15px] leading-relaxed text-[#8a9aa8]">
          Harmonize corporate fundamentals, live 24/7 venue order flow, social discourse, and 10-year historical precedents into one beautifully structured memo — keeping your judgment sovereign.
        </p>
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
