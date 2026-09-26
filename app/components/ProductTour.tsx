"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

export type TourView = "intake" | "results";

interface TourStep {
  id: string;
  title: string;
  body: string;
  view: TourView | "any";
}

const STEPS: TourStep[] = [
  {
    id: "tour-brand",
    title: "Welcome to Precedent",
    body: "This is an institutional research workbench for tokenized US equities (Bitget rTokens). It gathers evidence. It never places trades. Your judgment stays sovereign.",
    view: "any",
  },
  {
    id: "tour-universe",
    title: "Live rToken universe",
    body: "This badge shows how many Bitget rTokens are currently discoverable. Green means live venue discovery. Amber means the built-in fallback list is in use.",
    view: "any",
  },
  {
    id: "tour-demo",
    title: "Load recommended demo",
    body: "One click fills the AAPL swing stress-test and starts the research pipeline. Use this when you want the fastest walkthrough of a complete memo.",
    view: "any",
  },
  {
    id: "tour-style",
    title: "Operating style",
    body: "Day, Swing, Event-driven, or Position. This is not a label — it changes analog horizon, memo framing, and how evidence is re-weighted.",
    view: "intake",
  },
  {
    id: "tour-asset",
    title: "Target asset",
    body: "Search any listed rToken or underlying ticker. Selecting an instrument rewrites the research question so the ticker names stay consistent.",
    view: "intake",
  },
  {
    id: "tour-popular",
    title: "Popular focus chips",
    body: "Jump to frequently researched names (rAAPL, rNVDA, rTSLA, and others) without opening the search list.",
    view: "intake",
  },
  {
    id: "tour-venue",
    title: "Venue & tape context",
    body: "Shows the native cash ticker, the Bitget rToken ticker, sector, and whether the 24/7 venue listing is live. Research always contrasts overnight rails with the New York cash session.",
    view: "intake",
  },
  {
    id: "tour-question",
    title: "Research question",
    body: "Write the thesis you want stress-tested. Be specific: horizon, basis vs cash close, catalysts, or where you expect the pillars to disagree.",
    view: "intake",
  },
  {
    id: "tour-angles",
    title: "Suggested angles",
    body: "Preset prompts drop a focused question into the box. Use them as starting points, then edit to match your own setup.",
    view: "intake",
  },
  {
    id: "tour-submit",
    title: "Synthesize research memo",
    body: "Starts five parallel evidence streams over live SSE: fundamentals, tape/technicals, news, historical analogs, and market structure. The memo is attributed fact, not a buy/sell call.",
    view: "intake",
  },
  {
    id: "tour-back",
    title: "New research formulation",
    body: "Return to intake to change the instrument, rewrite the question, or start another run. The decision journal is kept in this browser.",
    view: "results",
  },
  {
    id: "tour-reweight",
    title: "Adaptive style re-weighting",
    body: "Switch style on the results page without re-running the pipeline. Horizon, analog window, and invalidation language update immediately.",
    view: "results",
  },
  {
    id: "tour-exports",
    title: "Export the briefing",
    body: "Summary .pptx is a short executive pack. Quant Dossier .pptx is the full institutional file with telemetry and analog charts.",
    view: "results",
  },
  {
    id: "tour-journal-jump",
    title: "Jump to the journal",
    body: "Scrolls to the Trader Decision Record. Precedent does not execute. This is where you write invalidation, size, and what would change your mind.",
    view: "results",
  },
  {
    id: "tour-memo",
    title: "The research memo",
    body: "Desk note first: setup, historical rhyme, takeaways, clashes, pre-mortem. Open the accordions for source-attributed telemetry and analog overlays.",
    view: "results",
  },
  {
    id: "tour-decision",
    title: "Trader Decision Record",
    body: "Private, local-only notes. Prompts help you write invalidation and risk rules. Nothing here is sent to an exchange.",
    view: "results",
  },
];

const STORAGE_KEY = "precedent-tour-seen-v1";

function visibleSteps(view: TourView) {
  return STEPS.filter((step) => step.view === "any" || step.view === view).filter((step) => {
    if (typeof document === "undefined") return true;
    return Boolean(document.querySelector(`[data-tour="${step.id}"]`));
  });
}

interface ProductTourProps {
  view: TourView;
  requestToken?: number;
}

export function ProductTour({ view, requestToken = 0 }: ProductTourProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const steps = useMemo(() => visibleSteps(view), [view, open, requestToken]);
  const step = steps[index];

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(() => {
    setIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (requestToken > 0) start();
  }, [requestToken, start]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const timer = window.setTimeout(() => start(), 700);
        return () => window.clearTimeout(timer);
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }, [start]);

  useEffect(() => {
    const measure = () => {
      setIsMobile(window.innerWidth < 768);
      if (!open || !step) {
        setRect(null);
        return;
      }
      const el = document.querySelector(`[data-tour="${step.id}"]`) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      window.setTimeout(() => {
        setRect(el.getBoundingClientRect());
      }, 220);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, view]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, Math.max(steps.length - 1, 0)));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, steps.length]);

  if (!open || !step) return null;

  const pad = 8;
  const highlight = rect
    ? {
        top: Math.max(rect.top - pad, 8),
        left: Math.max(rect.left - pad, 8),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const tooltipStyle: CSSProperties = isMobile
    ? { left: 12, right: 12, bottom: 16, top: "auto" }
    : highlight
      ? {
          top:
            highlight.top + highlight.height + 12 > window.innerHeight - 220
              ? Math.max(highlight.top - 200, 16)
              : highlight.top + highlight.height + 12,
          left: Math.min(Math.max(highlight.left, 16), window.innerWidth - 380),
          width: 360,
        }
      : { bottom: 24, left: 24, width: 360 };

  const next = () => {
    if (index >= steps.length - 1) {
      close();
      return;
    }
    setIndex((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="absolute inset-0 bg-black/70" onClick={close} />
      {highlight && (
        <div
          className="pointer-events-none absolute rounded-sm ring-2 ring-[#d4ff3f] shadow-[0_0_0_9999px_rgba(0,0,0,0.72)]"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}
      <div
        className="absolute z-[81] rounded-sm border border-[#d4ff3f]/40 bg-[#0c1016] p-4 text-[#e7ebef] shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <p id="tour-title" className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d4ff3f]">
            Quick tour · {index + 1} / {steps.length}
          </p>
          <button type="button" onClick={close} className="font-mono text-[10px] uppercase text-[#8ea0b0] hover:text-white">
            Skip
          </button>
        </div>
        <h3 className="mt-2 text-base font-semibold tracking-tight text-white">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#b7c4cf]">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
            className="min-h-[40px] rounded border border-white/15 px-3 font-mono text-[11px] uppercase tracking-wider text-[#c8d4df] disabled:opacity-30"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            className="min-h-[40px] rounded bg-[#d4ff3f] px-4 font-mono text-[11px] font-bold uppercase tracking-wider text-[#080a0d]"
          >
            {index >= steps.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
