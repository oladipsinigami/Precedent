"use client";

import { FormEvent } from "react";
import { IntakeForm, Instrument } from "./IntakeForm";
import { PILLARS, PillarState } from "./PipelineSidebar";
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
}: IntakeViewProps) {
  const readyCount = PILLARS.filter((p) => statuses[p.id] === "ready").length;

  return (
    <div className="mx-auto max-w-4xl py-5 sm:py-12">
      {/* Shortcut to previous memo if one exists */}
      {hasPreviousBriefing && !busy && (
        <div className="mb-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-sm border border-[#d4ff3f]/25 bg-[#d4ff3f]/[0.04] px-4 py-3 sm:px-5 sm:py-3 text-xs text-[#d4ff3f] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff3f] animate-pulse shrink-0" />
            <span>Active research record available in memory</span>
          </div>
          <button
            type="button"
            onClick={onViewPreviousResults}
            className="group flex min-h-[44px] sm:min-h-0 items-center justify-center sm:justify-start gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-white hover:text-[#d4ff3f] transition"
          >
            <span>Return to Memo</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
      )}

      {/* Hero Headline Area */}
      <div className="mb-6 text-center sm:mb-12">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d4ff3f] backdrop-blur-sm sm:px-3.5 sm:text-[11px] sm:tracking-[0.2em]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff3f] shrink-0" />
          <span className="truncate">Decision Stress Testing · Step 01: Formulation</span>
        </div>

        <h1 className="mt-4 font-display text-3xl font-medium leading-[1.14] tracking-[-0.03em] text-white sm:text-5xl md:text-6xl">
          Turn a market question <br className="hidden sm:inline" />
          <span className="text-[#8e9fae]">into an institutional research record.</span>
        </h1>

        <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-xs sm:text-sm leading-relaxed text-[#758594]">
          Five continuous evidence streams synthesized into one dispassionate memo. The trader’s judgment remains sovereign.
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

        {/* Live Parallel Telemetry Chamber (visible while synthesis is running) */}
        {busy && (
          <div className="mt-6 rounded-sm border border-[#75b8ff]/30 bg-[#0a1017]/90 p-4 sm:p-6 shadow-[0_16px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#75b8ff] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#75b8ff]" />
                </span>
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-white">
                  Executing Parallel Streams ({readyCount}/5 Converged)
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#75b8ff]">
                Live SSE Stream
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
              {PILLARS.map((p, idx) => {
                const st = statuses[p.id];
                const isReady = st === "ready";
                const isRunning = st === "running";
                return (
                  <div
                    key={p.id}
                    className={`rounded border p-3 transition-all ${
                      isReady
                        ? "border-[#d4ff3f]/40 bg-[#d4ff3f]/[0.06] text-white"
                        : isRunning
                        ? "border-[#75b8ff]/40 bg-[#75b8ff]/[0.06] text-[#c0d8f0]"
                        : "border-white/[0.06] bg-black/20 text-[#607080]"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
                      <span>0{idx + 1}</span>
                      <span className={isReady ? "text-[#d4ff3f]" : isRunning ? "text-[#75b8ff]" : "text-[#556472]"}>
                        {isReady ? "✓ Ready" : isRunning ? "Polling..." : "Queued"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium truncate">{p.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
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
