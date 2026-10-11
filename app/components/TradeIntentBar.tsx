"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate, stagger, utils } from "animejs";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion/tokens";
import { applyLossLimit, parseTradeIntent, type TradeIntent } from "@/lib/risk/parse-trade";

const EXAMPLE = "hold $20,000 of NVDA for 5 trading days and can lose at most $600";

export { EXAMPLE as DEFAULT_TRADE_QUESTION };

interface TradeIntentBarProps {
  question: string;
  onQuestionChange: (question: string) => void;
  busy: boolean;
  onSubmit: (event?: React.FormEvent) => void;
  error?: string;
  demoToken?: number;
}

const FIELD_LABEL: Record<keyof TradeIntent["fieldOrigins"], string> = {
  asset: "stock",
  notional: "size",
  hold: "hold",
  loss: "loss limit",
};

export function TradeIntentBar({
  question,
  onQuestionChange,
  busy,
  onSubmit,
  error,
  demoToken = 0,
}: TradeIntentBarProps) {
  const arrowRef = useRef<HTMLSpanElement | null>(null);
  const progressRef = useRef<HTMLSpanElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = question.trim();
  const parsed = useMemo(() => applyLossLimit(parseTradeIntent(trimmed)), [trimmed]);

  // The textarea doubles as the memo question, so it can hold prose that is not
  // a trade at all. Projecting a size from that prose would fabricate a number,
  // so the readouts only appear once the sentence actually reads as a trade.
  const looksLikeTrade =
    /(buy|sell|short|long|hold|holding|position|size|risk|stop|loss|per|days?|sessions?|weeks?|overnight)\b/i.test(
      trimmed,
    ) && (parsed.notionalUsd !== undefined || parsed.maxLossUsd !== undefined || parsed.holdSessions !== undefined);

  const intent = looksLikeTrade ? parsed : null;
  const complete = intent ? intent.missing.length === 0 : false;

  useEffect(() => {
    if (
      !demoToken ||
      !boxRef.current ||
      (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      return;
    }
    animate(boxRef.current, {
      scale: [0.99, 1],
      duration: 280,
      ease: MOTION_EASE.default,
    });
    if (textareaRef.current) {
      animate(textareaRef.current, {
        opacity: [0.25, 1],
        translateY: [5, 0],
        duration: 280,
        ease: MOTION_EASE.default,
      });
    }
    const readouts = boxRef.current.querySelectorAll<HTMLElement>("[data-anim='intent-readout']");
    if (readouts.length > 0) {
      animate(readouts, {
        opacity: [0, 1],
        translateY: [4, 0],
        duration: 240,
        delay: stagger(40),
        ease: MOTION_EASE.default,
      });
    }
  }, [demoToken]);

  useEffect(() => {
    const bar = progressRef.current;
    if (!bar) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      utils.set(bar, { opacity: busy ? 1 : 0, scaleX: busy ? 1 : 0 });
      return;
    }
    if (busy) {
      utils.set(bar, { opacity: 1, scaleX: 0 });
      const anim = animate(bar, {
        scaleX: [0, 0.96],
        duration: 1350,
        ease: MOTION_EASE.expo,
      });
      return () => {
        anim.pause();
      };
    }
    utils.set(bar, { opacity: 0, scaleX: 0 });
  }, [busy]);

  const handleCtaEnter = () => {
    if (
      busy ||
      !complete ||
      !arrowRef.current ||
      (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      return;
    }
    animate(arrowRef.current, {
      translateX: 2.5,
      translateY: -2,
      duration: MOTION_DURATION.microFast,
      ease: MOTION_EASE.default,
    });
  };

  const handleCtaLeave = () => {
    if (
      !arrowRef.current ||
      (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      return;
    }
    animate(arrowRef.current, {
      translateX: 0,
      translateY: 0,
      duration: MOTION_DURATION.microFast,
      ease: MOTION_EASE.default,
    });
  };

  return (
    <form
      data-anim="intake-intent"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete && !busy) onSubmit();
      }}
      className="mb-8 sm:mb-10"
    >
      <div className="mb-6 text-center">
        <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-3xl">
          How big can you be before this trade breaks your loss limit?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-line">
          Say the position size, the hold, and the most you can lose. Precedent reads the calendar, prices the round
          trip, and solves for size.
        </p>
      </div>

      <div
        ref={boxRef}
        className={`rounded-sm border bg-blot p-3 sm:p-4 transition-colors ${
          busy ? "border-lime/45 shadow-[0_0_24px_rgba(212,255,63,0.1)]" : "border-white/[0.12]"
        }`}
      >
        <label htmlFor="trade-intent" className="sr-only">
          Describe your trade
        </label>

        <textarea
          ref={textareaRef}
          id="trade-intent"
          rows={2}
          value={question}
          disabled={busy}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder="buy $10k rNVDA, holding 5 days, max loss $600"
          className="w-full resize-none bg-transparent px-1 py-1.5 text-base leading-relaxed text-white placeholder:text-mute-faint focus:outline-none disabled:opacity-75 sm:text-lg"
        />

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-t border-white/[0.08] px-1 pt-2.5 font-mono text-[11px]">
          <Readout label="STOCK" value={intent?.asset ?? intent?.rToken ?? (busy ? "AAPL" : undefined)} />
          <Readout label="SIDE" value={intent ? (intent.side === "LONG" ? "long" : "short") : busy ? "swing" : undefined} />
          <Readout label="SIZE" value={intent?.notionalUsd ? `$${intent.notionalUsd.toLocaleString("en-US")}` : undefined} />
          <Readout
            label="HOLD"
            value={
              intent?.holdSessions
                ? `${intent.holdSessions} session${intent.holdSessions === 1 ? "" : "s"}`
                : busy
                  ? "5d horizon"
                  : undefined
            }
          />
          <Readout
            label="MAX LOSS"
            value={
              intent?.maxLossUsd !== undefined && intent !== null
                ? `$${intent.maxLossUsd.toLocaleString("en-US")}`
                : intent?.maxLossPct !== undefined
                  ? `${intent.maxLossPct}%`
                  : undefined
            }
          />
          {intent && intent.missing.length > 0 && (
            <span className="ml-auto text-right text-mute-faint">
              still need <span className="text-amber">{intent.missing.map((m) => FIELD_LABEL[m]).join(", ")}</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md font-mono text-[11px] leading-relaxed text-mute-faint">
          Everything Precedent computes is measured. Nothing here is a forecast.
        </p>

        <div className="flex items-center gap-2">
          {trimmed !== EXAMPLE && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onQuestionChange(EXAMPLE)}
              className="rounded-sm border border-white/[0.1] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-line transition hover:border-lime/40 hover:text-lime disabled:opacity-40"
            >
              Use the example
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !complete}
            onMouseEnter={handleCtaEnter}
            onMouseLeave={handleCtaLeave}
            className="group relative overflow-hidden flex items-center gap-2 rounded-sm bg-lime px-5 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-blot transition hover:bg-lime-deep disabled:cursor-not-allowed disabled:border disabled:border-white/[0.12] disabled:bg-transparent disabled:text-mute-faint"
          >
            <span>{busy ? "Checking trade..." : complete ? "Check this trade" : "Complete the fields above"}</span>
            {complete && (
              <span ref={arrowRef} data-anim="intent-cta-arrow" className="inline-block">
                ↗
              </span>
            )}
            <span
              ref={progressRef}
              data-anim="intent-cta-progress"
              style={{ transformOrigin: "left center", transform: "scaleX(0)", opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-lime"
            />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Readout({ label, value }: { label: string; value: string | undefined }) {
  return (
    <span data-anim="intent-readout" className="flex items-baseline gap-1.5">
      <span className="font-semibold uppercase tracking-[0.14em] text-mute-faint">{label}</span>
      <span className={value ? "text-lime" : "text-mute-faint/60"}>{value ?? "—"}</span>
    </span>
  );
}