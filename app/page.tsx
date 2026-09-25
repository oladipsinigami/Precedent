"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { deterministicBriefing } from "@/lib/deterministic-briefing";
import { DEMO_TASK, STYLES } from "@/lib/style-profiles";
import { reweightBriefing } from "@/lib/reweight";
import { findNameBySymbol, findNameOrDefault, UNIVERSE } from "@/lib/universe";
import { BlackholeBackground } from "./components/BlackholeBackground";
import { Header } from "./components/Header";
import { IntakeView } from "./components/IntakeView";
import { ResultsView } from "./components/ResultsView";
import type {
  Briefing,
  PillarBundle,
  PillarId,
  Regime,
  ResearchEvent,
  TradingStyle,
} from "@/lib/types";

type Instrument = { native: string; rToken: string; name: string; sector: string };
type UniverseMeta = { source: "live" | "fallback"; count: number; asOf: string | null };
type UniverseResponse =
  | Instrument[]
  | { universe?: Instrument[]; source?: "live" | "fallback"; asOf?: string };
import type { PillarStatus, PillarState } from "./components/PipelineSidebar";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function adaptQuestionToInstrument(question: string, previous: Instrument | undefined, next: Instrument) {
  if (!previous || previous.native === next.native) return question;

  const aliases = [previous.rToken, previous.native, previous.name]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const pattern = aliases.map(escapeRegExp).join("|");
  const updated = pattern
    ? question.replace(new RegExp(`\\b(?:${pattern})\\b`, "gi"), (match) => {
        if (match.toLowerCase() === previous.rToken.toLowerCase()) return next.rToken;
        if (match.toLowerCase() === previous.native.toLowerCase()) return next.native;
        return next.name;
      })
    : question;

  if (updated !== question) return updated;
  return `${question.trim()} Focus instrument: ${next.rToken} (${next.native}, ${next.name}).`;
}

function adaptQuestionToStyle(question: string, previousStyle: TradingStyle, nextStyle: TradingStyle) {
  if (previousStyle === nextStyle) return question;

  const stylePhrases: Record<TradingStyle, { intro: string; horizonPhrase: string }> = {
    day: { intro: "I'm a day trader.", horizonPhrase: "into the next cash session open" },
    swing: { intro: "I'm a swing trader.", horizonPhrase: "into next week" },
    event: { intro: "I'm an event-driven trader.", horizonPhrase: "around the upcoming catalyst" },
    position: { intro: "I'm a position trader.", horizonPhrase: "over the coming weeks" },
  };

  const prev = stylePhrases[previousStyle];
  const next = stylePhrases[nextStyle];

  let updated = question;
  const introRegex = /\bI(?:'m| am) an? (?:day|swing|event-driven|position) trader\b/i;
  if (introRegex.test(updated)) {
    updated = updated.replace(introRegex, next.intro);
  }
  if (prev && next) {
    updated = updated.replace(new RegExp(escapeRegExp(prev.horizonPhrase), "gi"), next.horizonPhrase);
  }

  return updated;
}

const EMPTY_PILLARS: PillarState = {
  fundamentals: "pending",
  technicals: "pending",
  news: "pending",
  analogs: "pending",
  marketStructure: "pending",
};

// UX-1: the Trader Decision Record journal persists locally across reloads.
const DECISION_NOTE_STORAGE_KEY = "precedent-decision-note";

export default function Home() {
  const [view, setView] = useState<"intake" | "results">("intake");
  const [style, setStyle] = useState<TradingStyle>("swing");
  const [symbol, setSymbol] = useState(DEMO_TASK.symbol);
  const [question, setQuestion] = useState(DEMO_TASK.question);
  const [instruments, setInstruments] = useState<Instrument[]>(
    UNIVERSE.map(({ native, rToken, name, sector }) => ({ native, rToken, name, sector })),
  );
  const [universeMeta, setUniverseMeta] = useState<UniverseMeta>({
    source: "fallback",
    count: UNIVERSE.length,
    asOf: null,
  });
  const [statuses, setStatuses] = useState<PillarState>(EMPTY_PILLARS);
  const [stage, setStage] = useState<"idle" | "pillars" | "synthesis" | "complete">("idle");
  const [pillarMessages, setPillarMessages] = useState<Record<string, string>>({});
  const [pillarData, setPillarData] = useState<PillarBundle | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [meta, setMeta] = useState<{ native: string; name: string; regime: string } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // UX-1: hydrate the decision note from localStorage once, then persist every
  // edit so the deliberation journal survives page reloads (and repeat demo
  // runs). The save effect skips its first invocation so the mount render
  // never overwrites the stored note before hydration applies.
  const skipInitialDecisionNoteSave = useRef(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DECISION_NOTE_STORAGE_KEY);
      if (saved) setDecisionNote(saved);
    } catch {
      // localStorage unavailable (e.g. private mode) — journal stays session-only.
    }
  }, []);
  useEffect(() => {
    if (skipInitialDecisionNoteSave.current) {
      skipInitialDecisionNoteSave.current = false;
      return;
    }
    try {
      localStorage.setItem(DECISION_NOTE_STORAGE_KEY, decisionNote);
    } catch {
      // Persistence failure is non-fatal; the in-memory note still works.
    }
  }, [decisionNote]);

  const selected = useMemo(
    () => instruments.find((item) => item.native === symbol) ?? instruments[0],
    [instruments, symbol],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/universe")
      .then(async (response) => {
        if (!response.ok) throw new Error("Universe unavailable");
        const payload = (await response.json()) as UniverseResponse;
        const items = Array.isArray(payload) ? payload : payload.universe;
        if (!Array.isArray(items)) throw new Error("Universe response malformed");
        return {
          items,
          meta: {
            source: !Array.isArray(payload) && payload.source === "live" ? "live" as const : "fallback" as const,
            count: items.length,
            asOf: !Array.isArray(payload) && typeof payload.asOf === "string" ? payload.asOf : null,
          },
        };
      })
      .then(({ items, meta }) => {
        if (!active || !items.length) return;
        setInstruments(items);
        setUniverseMeta(meta);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function runResearch(event?: FormEvent, opts?: { demo?: boolean }) {
    event?.preventDefault();
    const demo = opts?.demo === true;
    const activeStyle = demo ? DEMO_TASK.style : style;
    const activeSymbol = demo ? DEMO_TASK.symbol : symbol;
    const activeQuestion = (demo ? DEMO_TASK.question : question).trim();
    if (busy || activeQuestion.length < 8) return;
    setBusy(true);
    setError("");
    setBriefing(null);
    setPillarData(null);
    setMeta(null);
    // Decision note intentionally NOT reset: the journal persists across runs
    // and reloads via localStorage (UX-1); the trader clears it explicitly.
    setStage("pillars");
    setPillarMessages({
      fundamentals: "Pulling SEC filings…",
      technicals: "Comparing rToken vs cash session…",
      news: "Scanning news & macro headlines…",
      analogs: "Matching historical charts…",
      marketStructure: "Resolving RMT peer communities…",
    });
    setStatuses({
      fundamentals: "running",
      technicals: "running",
      news: "running",
      analogs: "running",
      marketStructure: "running",
    });

    let receivedBriefing = false;
    let collectedPillars: Partial<PillarBundle> = {};
    let collectedMeta: { native: string; name: string; regime: string } | null = null;
    let collectedStatuses: PillarState = { ...EMPTY_PILLARS };

    const handleEvent = (ev: ResearchEvent) => {
      if (ev.type === "meta") {
        collectedMeta = { native: ev.symbol, name: ev.name, regime: ev.regime };
        setMeta(collectedMeta);
      } else if (ev.type === "pillar") {
        const mappedStatus: PillarStatus =
          ev.status === "ready"
            ? "ready"
            : ev.status === "degraded"
            ? "degraded"
            : ev.status === "failed"
            ? "failed"
            : ev.status === "running"
            ? "running"
            : "pending";
        collectedStatuses = { ...collectedStatuses, [ev.id]: mappedStatus };
        setStatuses((current) => ({ ...current, [ev.id]: mappedStatus }));
        if (ev.message) {
          setPillarMessages((prev) => ({ ...prev, [ev.id]: ev.message! }));
        }
        if (ev.data) {
          collectedPillars = { ...collectedPillars, [ev.id]: ev.data as PillarBundle[PillarId] };
          setPillarData((current) => ({ ...((current ?? {}) as PillarBundle), [ev.id]: ev.data as PillarBundle[PillarId] }));
        }
      } else if (ev.type === "status") {
        if (ev.stage === "synthesis") {
          setStage("synthesis");
        }
      } else if (ev.type === "briefing") {
        receivedBriefing = true;
        setStage("complete");
        setBriefing(ev.briefing);
        setView("results");
      } else if (ev.type === "error") {
        setError(ev.message);
      }
    };

    const recoverWithFallback = (errorMessage?: string) => {
      if (receivedBriefing) return;
      const hasCompletedPillars = Object.values(collectedStatuses).some(
        (s) => s === "ready" || s === "degraded",
      );
      if (hasCompletedPillars || Object.keys(collectedPillars).length > 0) {
        const fallbackName =
          findNameBySymbol(activeSymbol ?? "") ??
          findNameOrDefault(`${activeSymbol ?? ""} ${activeQuestion}`);
        const defaultEmptyPillars: PillarBundle = {
          fundamentals: { ok: false, company: fallbackName.name, ticker: fallbackName.native, latestFilings: [], catalysts: [], notes: [], sources: [] },
          technicals: { ok: false, native: { last: 0, changePct: 0, high52: 0, low52: 0, volume: 0, asOf: "" }, trend: "unavailable", momentum: "unavailable", volatility: "unavailable", levels: { support: [], resistance: [] }, indicators: {}, spark: [], notes: [], sources: [] },
          news: { ok: false, headlines: [], macro: [], social: { x: [] }, aggregateLean: "insufficient" as const, caveats: [], notes: [], sources: [] },
          analogs: { ok: false, closest: [], ranges: [], overlay: [], sample: { n: 0, symbols: 0, sessions: 0 }, caveats: [], sources: [] },
          marketStructure: { ok: false, universeSize: 0, caveats: [], sources: [] },
        };
        const resolvedBundle: PillarBundle = {
          fundamentals: (collectedPillars.fundamentals as PillarBundle["fundamentals"]) ?? defaultEmptyPillars.fundamentals,
          technicals: (collectedPillars.technicals as PillarBundle["technicals"]) ?? defaultEmptyPillars.technicals,
          news: (collectedPillars.news as PillarBundle["news"]) ?? defaultEmptyPillars.news,
          analogs: (collectedPillars.analogs as PillarBundle["analogs"]) ?? defaultEmptyPillars.analogs,
          marketStructure: (collectedPillars.marketStructure as PillarBundle["marketStructure"]) ?? defaultEmptyPillars.marketStructure,
        };
        const fallbackBriefing = deterministicBriefing({
          style: activeStyle,
          question: activeQuestion,
          name: fallbackName,
          regime: (collectedMeta?.regime as Regime) ?? "normal",
          pillars: resolvedBundle,
          flags: undefined,
        });
        fallbackBriefing.isFallback = true;
        setPillarData(resolvedBundle);
        setBriefing(fallbackBriefing);
        setError("");
        setView("results");
      } else {
        setError(errorMessage || "The research run could not complete. Please try again.");
      }
    };

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: activeStyle, symbol: activeSymbol, question: activeQuestion, demo }),
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The research run could not start.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((item) => item.startsWith("data: "));
          if (line) {
            try {
              handleEvent(JSON.parse(line.slice(6)) as ResearchEvent);
            } catch (frameErr) {
              console.warn("[Stream] Failed to parse SSE frame:", frameErr);
            }
          }
        }
      }
      if (!receivedBriefing) {
        recoverWithFallback();
      }
    } catch (err) {
      setStatuses((current) =>
        Object.fromEntries(
          Object.entries(current).map(([key, value]) => [key, value === "ready" ? value : "degraded"]),
        ) as PillarState,
      );
      recoverWithFallback(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleInstrumentChange(nextSymbol: string) {
    const next = instruments.find((item) => item.native === nextSymbol);
    if (!next) {
      setSymbol(nextSymbol);
      return;
    }
    setQuestion((current) => adaptQuestionToInstrument(current, selected, next));
    setSymbol(nextSymbol);
  }

  function handleStyleChange(nextStyle: TradingStyle) {
    const prevStyle = style;
    setStyle(nextStyle);
    setQuestion((current) => adaptQuestionToStyle(current, prevStyle, nextStyle));
    if (briefing) {
      setBriefing(reweightBriefing(briefing, nextStyle, pillarData));
    }
  }

  function loadDemo() {
    setStyle(DEMO_TASK.style);
    setSymbol(DEMO_TASK.symbol);
    setQuestion(DEMO_TASK.question);
    setError("");
    setBriefing(null);
    setMeta(null);
    setStatuses(EMPTY_PILLARS);
    setStage("idle");
    setPillarMessages({});
    setView("intake");
  }

  // One-click judge walkthrough: loads the recommended demo task and starts
  // it immediately against the server's cached demo fast path (demo: true).
  function runDemo() {
    if (busy) return;
    loadDemo();
    void runResearch(undefined, { demo: true });
  }

  return (
    <div className="relative min-h-screen text-[#e7ebef]">
      {/* Contextual Moving Blackhole Background (Prominent on Intake, Subdued on Results) */}
      <BlackholeBackground variant={view} />

      {/* Institutional Top Navigation Bar */}
      <Header onLoadDemo={runDemo} universeMeta={universeMeta} />

      {/* Main Container Rendering Either Page 1 (Intake) or Page 2 (Results) */}
      <main className="px-3.5 sm:px-6 md:px-8">
        {view === "intake" ? (
          <IntakeView
            style={style}
            onStyleChange={handleStyleChange}
            symbol={symbol}
            onInstrumentChange={handleInstrumentChange}
            instruments={instruments}
            universeMeta={universeMeta}
            selectedInstrument={selected}
            question={question}
            onQuestionChange={setQuestion}
            busy={busy}
            onSubmit={runResearch}
            error={error}
            statuses={statuses}
            hasPreviousBriefing={Boolean(briefing)}
            onViewPreviousResults={() => setView("results")}
            stage={stage}
            pillarMessages={pillarMessages}
          />
        ) : briefing ? (
          <ResultsView
            briefing={briefing}
            error={error}
            style={style}
            onStyleChange={handleStyleChange}
            pillarData={pillarData}
            decisionNote={decisionNote}
            onDecisionNoteChange={setDecisionNote}
            onBackToIntake={() => setView("intake")}
            symbol={symbol}
            meta={meta}
            statuses={statuses}
          />
        ) : (
          // Fallback if results view is entered without a briefing
          <IntakeView
            style={style}
            onStyleChange={handleStyleChange}
            symbol={symbol}
            onInstrumentChange={handleInstrumentChange}
            instruments={instruments}
            universeMeta={universeMeta}
            selectedInstrument={selected}
            question={question}
            onQuestionChange={setQuestion}
            busy={busy}
            onSubmit={runResearch}
            error={error}
            statuses={statuses}
            hasPreviousBriefing={false}
            onViewPreviousResults={() => {}}
            stage={stage}
            pillarMessages={pillarMessages}
          />
        )}
      </main>
    </div>
  );
}
