"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEMO_TASK, STYLES } from "@/lib/style-profiles";
import { reweightBriefing } from "@/lib/reweight";
import { UNIVERSE } from "@/lib/universe";
import { BlackholeBackground } from "./components/BlackholeBackground";
import { Header } from "./components/Header";
import { IntakeView } from "./components/IntakeView";
import { ResultsView } from "./components/ResultsView";
import type {
  Briefing,
  PillarBundle,
  PillarId,
  ResearchEvent,
  TradingStyle,
} from "@/lib/types";

type Instrument = { native: string; rToken: string; name: string; sector: string };
type PillarStatus = "idle" | "running" | "ready" | "degraded";
type PillarState = Record<PillarId, PillarStatus>;

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

const EMPTY_PILLARS: PillarState = {
  fundamentals: "idle",
  technicals: "idle",
  news: "idle",
  analogs: "idle",
  marketStructure: "idle",
};

export default function Home() {
  const [view, setView] = useState<"intake" | "results">("intake");
  const [style, setStyle] = useState<TradingStyle>("swing");
  const [symbol, setSymbol] = useState(DEMO_TASK.symbol);
  const [question, setQuestion] = useState(DEMO_TASK.question);
  const [instruments, setInstruments] = useState<Instrument[]>(
    UNIVERSE.map(({ native, rToken, name, sector }) => ({ native, rToken, name, sector })),
  );
  const [statuses, setStatuses] = useState<PillarState>(EMPTY_PILLARS);
  const [pillarData, setPillarData] = useState<PillarBundle | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [meta, setMeta] = useState<{ native: string; name: string; regime: string } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => instruments.find((item) => item.native === symbol) ?? instruments[0],
    [instruments, symbol],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/universe")
      .then(async (response) => {
        if (!response.ok) throw new Error("Universe unavailable");
        return (await response.json()) as Instrument[];
      })
      .then((items) => {
        if (active && items.length) setInstruments(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function runResearch(event?: FormEvent) {
    event?.preventDefault();
    if (busy || question.trim().length < 8) return;
    setBusy(true);
    setError("");
    setBriefing(null);
    setPillarData(null);
    setMeta(null);
    setDecisionNote("");
    setStatuses({
      fundamentals: "running",
      technicals: "running",
      news: "running",
      analogs: "running",
      marketStructure: "running",
    });

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, symbol, question: question.trim() }),
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
          if (line) handleEvent(JSON.parse(line.slice(6)) as ResearchEvent);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
      setStatuses((current) =>
        Object.fromEntries(
          Object.entries(current).map(([key, value]) => [key, value === "ready" ? value : "degraded"]),
        ) as PillarState,
      );
    } finally {
      setBusy(false);
    }
  }

  function handleEvent(event: ResearchEvent) {
    if (event.type === "meta") {
      setMeta({ native: event.symbol, name: event.name, regime: event.regime });
    } else if (event.type === "pillar") {
      setStatuses((current) => ({ ...current, [event.id]: event.status }));
      if (event.data) {
        setPillarData((current) => ({ ...((current ?? {}) as PillarBundle), [event.id]: event.data }));
      }
    } else if (event.type === "briefing") {
      setBriefing(event.briefing);
      // Seamlessly transition from Intake Page to Results Page upon synthesis completion
      setView("results");
    } else if (event.type === "error") {
      setError(event.message);
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
    setStyle(nextStyle);
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
    setView("intake");
  }

  return (
    <div className="relative min-h-screen text-[#e7ebef]">
      {/* Contextual Moving Blackhole Background (Prominent on Intake, Subdued on Results) */}
      <BlackholeBackground variant={view} />

      {/* Institutional Top Navigation Bar */}
      <Header onLoadDemo={loadDemo} />

      {/* Main Container Rendering Either Page 1 (Intake) or Page 2 (Results) */}
      <main className="px-5 sm:px-8">
        {view === "intake" ? (
          <IntakeView
            style={style}
            onStyleChange={handleStyleChange}
            symbol={symbol}
            onInstrumentChange={handleInstrumentChange}
            instruments={instruments}
            selectedInstrument={selected}
            question={question}
            onQuestionChange={setQuestion}
            busy={busy}
            onSubmit={runResearch}
            error={error}
            statuses={statuses}
            hasPreviousBriefing={Boolean(briefing)}
            onViewPreviousResults={() => setView("results")}
          />
        ) : briefing ? (
          <ResultsView
            briefing={briefing}
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
            selectedInstrument={selected}
            question={question}
            onQuestionChange={setQuestion}
            busy={busy}
            onSubmit={runResearch}
            error={error}
            statuses={statuses}
            hasPreviousBriefing={false}
            onViewPreviousResults={() => {}}
          />
        )}
      </main>
    </div>
  );
}
