"use client";

import { FormEvent } from "react";
import { TokenSearchCombobox } from "./TokenSearchCombobox";
import { StyleSelector } from "./StyleSelector";
import type { TradingStyle } from "@/lib/types";

export type Instrument = { native: string; rToken: string; name: string; sector: string };

interface IntakeFormProps {
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
}

export function IntakeForm({
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
}: IntakeFormProps) {
  const PRESET_PROMPTS = [
    "Stress-test overnight rToken basis spread vs cash close",
    "Where do the historical analog distribution and current regime disagree?",
    "Catalyst drift risk into next week's session",
  ];

  const POPULAR_TOKENS = ["NVDA", "TSLA", "AAPL", "MSTU", "VOO", "SMH", "SGOV", "MSFT"];

  return (
    <form
      onSubmit={onSubmit}
      className="relative overflow-hidden rounded-sm border border-white/[0.09] bg-[#0c1016]/90 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#d4ff3f]/80" />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#a1b0be]">
            Research Intake & Frame
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-[#617180]">
          <span className="hidden sm:inline">5-Pillar Parallel Pipeline</span>
          <span className="text-white/20">|</span>
          <span>POST /api/research · SSE</span>
        </div>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {/* Operating Frame (Style) */}
        <StyleSelector currentStyle={style} onStyleChange={onStyleChange} disabled={busy} />

        {/* Instrument Selection & Metadata */}
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="token-search-trigger"
                  className="block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#8e9ca8]"
                >
                  Target Instrument (Searchable Bitget rToken)
                </label>
                <span className="font-mono text-[10px] text-[#556472]">
                  {instruments.length} Assets
                </span>
              </div>

              <div className="mt-2">
                <TokenSearchCombobox
                  instruments={instruments}
                  selectedSymbol={symbol}
                  onSelectSymbol={onInstrumentChange}
                  disabled={busy}
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#8e9ca8]">
                Market Structure Context
              </label>
              <div className="mt-2 flex h-12 items-center justify-between rounded-sm border border-white/[0.08] bg-[#090c10]/70 px-4">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-[#c4d0dc]">
                    {selectedInstrument?.name ?? "Asset"} · {selectedInstrument?.sector ?? "Equity"}
                  </div>
                  <div className="font-mono text-[10px] text-[#617180]">
                    Native: <span className="text-[#a1b0be]">{selectedInstrument?.native ?? symbol}</span>
                    <span className="mx-1.5 text-white/10">|</span>
                    rToken: <span className="text-[#d4ff3f]">{selectedInstrument?.rToken ?? `r${symbol}`}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-l border-white/[0.08] pl-4 text-right">
                  <span className="font-mono text-[10px] uppercase text-[#617180]">Venue:</span>
                  <span className="rounded bg-[#d4ff3f]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#d4ff3f]">
                    Bitget 7×24
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick-Pick Popular Tickers */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#556472]">
              Quick Pick:
            </span>
            {POPULAR_TOKENS.map((ticker) => {
              const item = instruments.find((i) => i.native === ticker);
              const isSelected = symbol.toUpperCase() === ticker.toUpperCase();
              return (
                <button
                  key={ticker}
                  type="button"
                  disabled={busy}
                  onClick={() => onInstrumentChange(ticker)}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] transition ${
                    isSelected
                      ? "border-[#d4ff3f]/60 bg-[#d4ff3f]/15 font-semibold text-[#d4ff3f]"
                      : "border-white/[0.07] bg-white/[0.02] text-[#8e9fae] hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                  } disabled:opacity-40`}
                >
                  {item?.rToken ?? `r${ticker}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Research Question */}
        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="research-question"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#8e9ca8]"
            >
              Research Question & Stress-Test Intent
            </label>
            <span className="font-mono text-[10px] text-[#556472]">
              Minimum 8 characters
            </span>
          </div>

          <textarea
            id="research-question"
            rows={4}
            value={question}
            disabled={busy}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="Ask about a catalyst, venue gap, regime alignment, or historical analog precedent..."
            className="mt-2 w-full rounded-sm border border-white/[0.12] bg-[#090c10] p-4 text-sm leading-relaxed text-[#e7ebef] placeholder:text-[#45505b] transition focus:border-[#d4ff3f] focus:outline-none focus:ring-1 focus:ring-[#d4ff3f]/50 disabled:opacity-50"
          />

          {/* Quick prompt suggestions */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-[#5a6875]">Quick Angles:</span>
            {PRESET_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => onQuestionChange(prompt)}
                className="rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-[#8a9aa8] transition hover:border-white/20 hover:bg-white/[0.05] hover:text-[#d4ff3f]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Submit & Guidance Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-5">
          <div className="max-w-md text-xs leading-relaxed text-[#687786]">
            The desk synthesizes fundamentals, venue tape, discourse, historical analogs, and RMT eigenstructure without taking a directional side.
          </div>

          <button
            type="submit"
            disabled={busy || question.trim().length < 8}
            className="group relative flex items-center gap-3 overflow-hidden rounded-sm bg-[#d4ff3f] px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#080b0e] transition-all hover:bg-white hover:shadow-[0_0_24px_rgba(212,255,63,0.4)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <>
                <svg className="h-4 w-4 animate-spin text-[#080b0e]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Synthesizing Streams...</span>
              </>
            ) : (
              <>
                <span>Run Desk Research</span>
                <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  ↗
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
