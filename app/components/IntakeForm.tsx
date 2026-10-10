"use client";

import { FormEvent } from "react";
import { TokenSearchCombobox } from "./TokenSearchCombobox";
import { StyleSelector } from "./StyleSelector";
import type { TradingStyle } from "@/lib/types";

export type Instrument = { native: string; rToken: string; name: string; sector: string };
export type UniverseMeta = { source: "live" | "fallback"; count: number; asOf: string | null };

interface IntakeFormProps {
  style: TradingStyle;
  onStyleChange: (style: TradingStyle) => void;
  symbol: string;
  onInstrumentChange: (symbol: string) => void;
  instruments: Instrument[];
  universeMeta: UniverseMeta;
  selectedInstrument: Instrument | undefined;
  question: string;
  onQuestionChange: (question: string) => void;
  busy: boolean;
  onSubmit: (event?: FormEvent) => void;
  onLoadDemo?: () => void;
  onFillDemo?: () => void;
}

export function IntakeForm({
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
  onLoadDemo,
  onFillDemo,
}: IntakeFormProps) {
  const isDemoMatched =
    symbol === "AAPL" &&
    style === "swing" &&
    question.trim().toLowerCase().includes("stress-test the current aapl rtoken setup");
  const PRESET_PROMPTS = [
    "hold $15,000 of TSLA for 10 sessions, can lose $400",
    "long $40k rAAPL for 2 weeks, 5% max loss",
    "short 8k AMD until Friday, stop me at 400",
  ];

  const POPULAR_TOKENS = ["NVDA", "TSLA", "AAPL", "MSTU", "VOO", "SMH", "SGOV", "MSFT"];

  return (
    <form
      onSubmit={onSubmit}
      className="relative overflow-hidden rounded-sm border border-white/[0.1] bg-ink/95 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl"
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-white/[0.02] px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_8px_var(--c-lime)] shrink-0" />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] sm:tracking-[0.22em] text-slate-pale">
            ✦ Institutional Intake & Context Framing
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] text-slate-line">
          <span className="hidden sm:inline">5 Parallel Evidence Streams</span>
          <span className="hidden sm:inline text-white/20">|</span>
          <span className="truncate">POST /api/research · SSE Live</span>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:space-y-6 sm:p-8">
        {/* Operating Frame (Style) */}
        <StyleSelector currentStyle={style} onStyleChange={onStyleChange} disabled={busy} />

        {/* Instrument Selection & Metadata */}
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="token-search-trigger"
                  className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-slate-mid"
                >
                  <svg aria-hidden="true" className="h-2 w-2 shrink-0 text-lime" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M5 0L10 5L5 10L0 5Z" />
                  </svg>
                  Target Asset · Tokenized US Equity
                </label>
                <span className="font-mono text-[10px] text-slate" title={universeMeta.asOf ? `Universe refreshed ${new Date(universeMeta.asOf).toLocaleString()}` : "Static fallback universe"}>
                  {instruments.length.toLocaleString("en-US")} Assets · {universeMeta.source === "live" ? "Live Bitget" : "Static Fallback"}
                </span>
              </div>

              <div className="mt-2" data-tour="tour-asset">
                <TokenSearchCombobox
                  instruments={instruments}
                  selectedSymbol={symbol}
                  onSelectSymbol={onInstrumentChange}
                  disabled={busy}
                />
              </div>
            </div>

            <div data-tour="tour-venue">
              <label className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-slate-mid">
                <svg aria-hidden="true" className="h-2 w-2 shrink-0 text-lime/70" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M5 0L10 5L5 10L0 5Z" />
                </svg>
                Venue & Tape Context
              </label>
              <div className="mt-2 flex min-h-[48px] items-center justify-between rounded-sm border border-white/[0.08] bg-blot/70 px-3 py-2 sm:px-4">
                <div className="min-w-0 pr-2">
                  <div className="truncate text-xs font-medium text-slate-mid">
                    {selectedInstrument?.name ?? "Asset"} · {selectedInstrument?.sector ?? "Equity"}
                  </div>
                  <div className="font-mono text-[10px] text-slate-line truncate">
                    Native: <span className="text-slate-text">{selectedInstrument?.native ?? symbol}</span>
                    <span className="mx-1.5 text-white/10">|</span>
                    rToken: <span className="text-lime">{selectedInstrument?.rToken ?? `r${symbol}`}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-l border-white/[0.08] pl-3 sm:pl-4 text-right shrink-0">
                  <span className="hidden sm:inline font-mono text-[10px] uppercase text-slate-line">Venue:</span>
                  <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                    universeMeta.source === "live"
                      ? "bg-lime/10 text-lime"
                      : "bg-amber/10 text-amber"
                  }`}>
                    {universeMeta.source === "live" ? "Bitget rToken Listed" : "Static Venue Metadata"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick-Pick Popular Tickers */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5" data-tour="tour-popular">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
              Popular Focus:
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
                  className={`flex min-h-[36px] sm:min-h-0 items-center justify-center rounded border px-2.5 py-1 sm:py-0.5 font-mono text-[11px] transition ${
                    isSelected
                      ? "border-lime/70 bg-lime/15 font-semibold text-lime shadow-[0_0_10px_rgba(212,255,63,0.15)]"
                      : "border-white/[0.07] bg-white/[0.02] text-slate-text hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                  } disabled:opacity-40`}
                >
                  {item?.rToken ?? `r${ticker}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Research Question */}
        <details className="group" data-tour="tour-question">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-slate-mid transition hover:text-lime">
            <svg
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rotate-90 text-lime transition-transform group-open:rotate-0"
              viewBox="0 0 10 10"
              fill="currentColor"
            >
              <path d="M5 0L10 5L5 10L0 5L0 5Z" />
            </svg>
            Optional: What to research alongside the size check
            <span className="font-normal normal-case tracking-normal text-slate">— leave closed to measure only the trade above</span>
          </summary>

          <textarea
            id="research-question"
            rows={4}
            value={question}
            disabled={busy}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="Explore what matters most to your trade — overnight basis spreads, upcoming corporate earnings catalysts, macro tension, or how past chart patterns unfolded..."
            className="mt-2 w-full rounded-sm border border-white/[0.12] bg-blot p-3.5 text-sm leading-relaxed text-slate-light placeholder:text-ink-mute transition focus:border-lime focus:outline-none focus:ring-1 focus:ring-lime/50 disabled:opacity-50"
          />

          {/* Quick prompt suggestions */}
          <div className="mt-3 flex flex-wrap items-center gap-2" data-tour="tour-angles">
            <span className="font-mono text-[10px] uppercase text-slate-line">Suggested Angles:</span>
            {(onFillDemo || onLoadDemo) && (
              <button
                type="button"
                disabled={busy}
                onClick={onFillDemo ?? onLoadDemo}
                className={`rounded border px-2.5 py-1.5 text-[11px] font-mono font-bold transition flex items-center gap-1.5 ${
                  isDemoMatched
                    ? "border-lime bg-lime/20 text-lime shadow-[0_0_12px_rgba(212,255,63,0.3)]"
                    : "border-lime/60 bg-lime/10 text-lime hover:bg-lime hover:text-blot"
                }`}
                title="Populate form with the recommended AAPL 7×24 Swing Setup question"
              >
                <span>⚡ {isDemoMatched ? "Recommended Demo Active (AAPL Swing)" : "Fill Recommended Demo (AAPL Swing)"}</span>
              </button>
            )}
            {PRESET_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => onQuestionChange(prompt)}
                className="rounded border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-slate-text transition hover:border-lime/40 hover:bg-lime/[0.04] hover:text-lime text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </details>

        {/* Submit & Guidance Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-white/[0.08] pt-5">
          <div className="max-w-md text-xs leading-relaxed text-slate-line">
            Precedent measures the round trip and the events inside your hold, then the memo cross-examines five evidence streams. Every claim is attributed. Nothing is a forecast.
          </div>

          <button
            type="submit"
            data-tour="tour-submit"
            disabled={busy || question.trim().length < 8}
            className={`group relative flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-sm border px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-all disabled:cursor-not-allowed disabled:opacity-30 min-h-[44px] ${
              isDemoMatched && !busy
                ? "border-lime/60 bg-lime/10 text-lime hover:border-lime hover:bg-lime/15"
                : "border-white/[0.14] bg-white/[0.03] text-slate-line hover:border-lime/50 hover:text-lime"
            }`}
          >
            {busy ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="10" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Consulting Evidence Feeds...</span>
              </>
            ) : (
              <>
                <span>Synthesize Research Memo</span>
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
