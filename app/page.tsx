"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DEMO_TASK, STYLES } from "@/lib/style-profiles";
import { reweightBriefing } from "@/lib/reweight";
import { buildStressTest } from "@/lib/stress-test";
import { UNIVERSE } from "@/lib/universe";
import type {
  Briefing,
  MarketStructurePillar,
  NewsPillar,
  PillarBundle,
  PillarId,
  ResearchEvent,
  StructureFlags,
  StressDirection,
  StressTest,
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

const PILLARS: { id: PillarId; label: string; short: string }[] = [
  { id: "marketStructure", label: "Structure", short: "RMT / regime" },
  { id: "analogs", label: "Analogs", short: "historical stress test" },
  { id: "technicals", label: "Venue tape", short: "cash vs Bitget" },
  { id: "news", label: "Discourse", short: "news / X / YouTube" },
  { id: "fundamentals", label: "Fundamentals", short: "filings / catalysts" },
];

const EMPTY_PILLARS: PillarState = {
  fundamentals: "idle",
  technicals: "idle",
  news: "idle",
  analogs: "idle",
  marketStructure: "idle",
};

export default function Home() {
  const [style, setStyle] = useState<TradingStyle>("swing");
  const [symbol, setSymbol] = useState(DEMO_TASK.symbol);
  const [question, setQuestion] = useState(DEMO_TASK.question);
  const [direction, setDirection] = useState<StressDirection>("LONG");
  const [capital, setCapital] = useState("15000");
  const [timeHorizon, setTimeHorizon] = useState("5d");
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
  const stressTest = useMemo<StressTest | null>(() => {
    if (!briefing || !selected) return null;
    return buildStressTest({
      asset: selected.native,
      rToken: selected.rToken,
      direction,
      capital: Math.max(0, Number(capital) || 0),
      timeHorizon,
      analogs: pillarData?.analogs,
      technicals: pillarData?.technicals,
    });
  }, [briefing, capital, direction, pillarData, selected, timeHorizon]);

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
    setDirection("LONG");
    setCapital("15000");
    setTimeHorizon("5d");
    setError("");
    setBriefing(null);
    setMeta(null);
    setStatuses(EMPTY_PILLARS);
  }

  return (
    <main className="min-h-screen bg-[#080a0d] text-[#e7ebef]">
      <header className="border-b border-white/[0.08] bg-[#0b0e12]/95">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#d7ff4f] font-mono text-sm font-black text-[#0a0d0b]">P</div>
            <div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.24em]">Precedent</div>
              <div className="mt-0.5 text-[11px] text-[#75808b]">Bitget rToken research desk</div>
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[#75808b]">
            <span className="hidden sm:inline">Research only</span>
            <span className="flex items-center gap-2 text-[#9cabb7]"><i className="h-1.5 w-1.5 rounded-full bg-[#d7ff4f]" /> Live desk</span>
            <button type="button" onClick={loadDemo} className="text-[#d7ff4f] hover:text-white">Demo ↗</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#d7ff4f]">Decision stress testing / session 01</div>
                <h1 className="mt-3 max-w-3xl text-4xl font-medium leading-[1.03] tracking-[-0.055em] sm:text-6xl">
                  Turn a market question<br /><span className="text-[#74808a]">into a research record.</span>
                </h1>
              </div>
              <div className="max-w-xs text-right text-xs leading-5 text-[#75808b]">
                Five evidence streams. One memo. Your decision stays outside the system.
              </div>
            </div>

            <form onSubmit={runResearch} className="border border-white/[0.11] bg-[#101419]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9cabb7]">Research intake</div>
                <div className="font-mono text-[10px] text-[#59646e]">POST /api/research · SSE</div>
              </div>
              <div className="grid gap-6 p-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:p-7">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#74808a]">Operating frame</label>
                  <div className="mt-3 space-y-2">
                    {(Object.keys(STYLES) as TradingStyle[]).map((item) => (
                      <button key={item} type="button" onClick={() => handleStyleChange(item)} className={`w-full border px-3 py-3 text-left transition ${style === item ? "border-[#d7ff4f] bg-[#d7ff4f]/[0.08]" : "border-white/[0.08] bg-[#0b0e12] hover:border-white/20"}`}>
                        <span className="flex items-center justify-between text-xs font-medium"><span>{STYLES[item].label}</span><span className={style === item ? "text-[#d7ff4f]" : "text-[#59646e]"}>{style === item ? "●" : "○"}</span></span>
                        <span className="mt-1 block text-[10px] leading-4 text-[#74808a]">{STYLES[item].horizon}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="instrument" className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#74808a]">Bitget instrument</label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[190px_1fr]">
                    <select id="instrument" value={symbol} onChange={(event) => handleInstrumentChange(event.target.value)} className="h-12 rounded-none border border-white/[0.1] bg-[#0b0e12] px-3 text-sm outline-none focus:border-[#d7ff4f]">
                      {instruments.map((item) => <option key={item.native} value={item.native}>{item.rToken} · {item.name}</option>)}
                    </select>
                    <div className="flex h-12 items-center justify-between border border-white/[0.08] bg-[#0b0e12] px-4">
                      <div><div className="font-mono text-[10px] uppercase text-[#59646e]">Underlying</div><div className="mt-1 text-xs">{selected?.native ?? symbol} · {selected?.name ?? "Selected asset"}</div></div>
                      <div className="text-right"><div className="font-mono text-[10px] uppercase text-[#59646e]">Venue</div><div className="mt-1 text-xs text-[#d7ff4f]">Bitget spot</div></div>
                    </div>
                  </div>
                  <label htmlFor="question" className="mt-6 block font-mono text-[10px] uppercase tracking-[0.18em] text-[#74808a]">Research question</label>
                  <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} className="mt-3 w-full resize-none border border-white/[0.1] bg-[#0b0e12] p-4 text-sm leading-6 outline-none placeholder:text-[#4f5962] focus:border-[#d7ff4f]" placeholder="What should the desk stress-test?" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="border border-white/[0.1] bg-[#0b0e12] px-3 py-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#59646e]">Direction</span>
                      <select value={direction} onChange={(event) => setDirection(event.target.value as StressDirection)} className="mt-1 w-full bg-transparent text-xs outline-none">
                        <option value="LONG">Long</option>
                        <option value="SHORT">Short</option>
                      </select>
                    </label>
                    <label className="border border-white/[0.1] bg-[#0b0e12] px-3 py-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#59646e]">Position size</span>
                      <input type="number" min="0" step="100" value={capital} onChange={(event) => setCapital(event.target.value)} className="mt-1 w-full bg-transparent text-xs outline-none" />
                    </label>
                    <label className="border border-white/[0.1] bg-[#0b0e12] px-3 py-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#59646e]">Holding period</span>
                      <select value={timeHorizon} onChange={(event) => setTimeHorizon(event.target.value)} className="mt-1 w-full bg-transparent text-xs outline-none">
                        <option value="1d">1 day</option>
                        <option value="5d">5 days</option>
                        <option value="10d">10 days</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] text-[#59646e]">Ask about a catalyst, venue gap, regime, or historical precedent.</div>
                    <button disabled={busy || question.trim().length < 8} className="flex items-center gap-5 bg-[#d7ff4f] px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#0a0d0b] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">
                      {busy ? "Running desk" : "Run research"} <span>↗</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </section>

          <aside className="border border-white/[0.09] bg-[#0d1115]">
            <div className="border-b border-white/[0.08] px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9cabb7]">Evidence pipeline</div>
              <div className="mt-2 text-xs text-[#59646e]">{meta ? `${meta.native} · ${meta.name}` : "Waiting for a research question"}</div>
            </div>
            <div className="p-3">
              {PILLARS.map((pillar, index) => <PipelineRow key={pillar.id} index={index} pillar={pillar} status={statuses[pillar.id]} />)}
            </div>
            <div className="mx-4 mb-4 border-t border-white/[0.08] pt-4 text-[11px] leading-5 text-[#59646e]">
              <span className="text-[#d7ff4f]">Method:</span> Bitget venue context is kept separate from the underlying cash tape. Missing sources are shown as caveats, never filled in.
            </div>
          </aside>
        </div>

        {error && <div className="mt-6 border border-[#f07867]/40 bg-[#f07867]/[0.08] px-4 py-3 text-xs text-[#ffb1a6]">{error}</div>}
        {stressTest && <StressTestPanel test={stressTest} />}
        {briefing && <ResearchMemo briefing={briefing} style={style} pillarData={pillarData} decisionNote={decisionNote} onDecisionNoteChange={setDecisionNote} />}
      </div>
    </main>
  );
}

function StressTestPanel({ test }: { test: StressTest }) {
  const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const pct = (value: number | null) => value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  const riskClass = test.riskLevel === "LOW" ? "text-[#55721a] bg-[#dfe9c8]" : test.riskLevel === "MEDIUM" ? "text-[#8a641d] bg-[#f1e7c8]" : "text-[#9b3c2e] bg-[#f4d9d3]";
  return <section className="mt-8 border border-[#141918]/15 bg-[#f5f6f1] text-[#141918]">
    <header className="border-b border-[#141918]/15 px-5 py-5 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#55721a]">Decision stress test report</div><h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">Risk frame for {test.rToken ?? test.asset}</h2><p className="mt-1 text-xs text-[#59645e]">{test.asset} · {test.direction} · ${money.format(test.capital)} · {test.timeHorizon}</p></div>
        <div className={`px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${riskClass}`}>{test.riskLevel} risk</div>
      </div>
      <p className="mt-4 max-w-3xl text-xs leading-5 text-[#59645e]">{test.riskBasis}</p>
    </header>
    <div className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-2">
      <div>
        <StressHeading number="01" title="Historical setup analogs" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StressMetric label="Sample" value={String(test.metrics.sampleSize)} />
          <StressMetric label="Win rate" value={test.metrics.historicalWinRate === null ? "n/a" : `${(test.metrics.historicalWinRate * 100).toFixed(1)}%`} />
          <StressMetric label="Median" value={pct(test.metrics.medianReturnPct)} />
          <StressMetric label="Max drawdown" value={pct(test.metrics.maxDrawdownPct)} />
        </div>
      </div>
      <div>
        <StressHeading number="02" title="Shock scenarios" />
        <div className="space-y-2">{test.shockScenarios.map((scenario) => <div key={scenario.event} className="flex items-center justify-between gap-4 border-b border-[#141918]/10 pb-2 text-xs"><span>{scenario.event}</span><span className={scenario.projectedAssetChangePct < 0 ? "text-[#9b3c2e]" : "text-[#55721a]"}>{pct(scenario.projectedAssetChangePct)} · ${money.format(scenario.dollarPnL)}</span></div>)}</div>
      </div>
      <div>
        <StressHeading number="03" title="Portfolio & exposure warnings" />
        <p className="text-xs leading-5 text-[#59645e]">{test.portfolioImpact.note}</p>
      </div>
      <div>
        <StressHeading number="04" title="Actionable risk defense plan" />
        <div className="space-y-2 text-xs"><div><span className="text-[#778078]">Entry:</span> {test.safeguards.suggestedEntryStrategy}</div><div><span className="text-[#778078]">Stop reference:</span> {test.safeguards.recommendedStopLossPct === null ? "n/a" : `${test.safeguards.recommendedStopLossPct.toFixed(2)}%`} {test.safeguards.suggestedStopLossPrice ? `· Bitget mark ${test.safeguards.suggestedStopLossPrice.toFixed(2)}` : ""}</div><div><span className="text-[#778078]">Max risk budget:</span> {test.safeguards.maxRiskBudgetDollars === null ? "n/a" : `$${money.format(test.safeguards.maxRiskBudgetDollars)}`}</div><div><span className="text-[#778078]">Invalidation:</span> {test.safeguards.invalidationLevel}</div></div>
      </div>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#141918]/15 bg-[#e5eadf] px-5 py-4 sm:px-8"><span className="text-[11px] text-[#59645e]">Bitget target · human confirmation required · no order was staged</span><button type="button" className="border border-[#141918]/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#59645e]">Review plan only</button></footer>
  </section>;
}

function StressHeading({ number, title }: { number: string; title: string }) {
  return <div className="mb-3 flex items-center gap-2"><span className="font-mono text-[10px] text-[#55721a]">{number}</span><h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#55721a]">{title}</h3></div>;
}

function StressMetric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#141918]/12 p-3"><div className="font-mono text-[9px] uppercase text-[#778078]">{label}</div><div className="mt-2 text-sm">{value}</div></div>;
}

function PipelineRow({ index, pillar, status }: { index: number; pillar: (typeof PILLARS)[number]; status: PillarStatus }) {
  const color = status === "ready" ? "bg-[#d7ff4f]" : status === "degraded" ? "bg-[#e8a85c]" : status === "running" ? "bg-[#75b8ff]" : "bg-[#3b444d]";
  return <div className="flex items-center gap-3 border-b border-white/[0.06] px-2 py-4 last:border-0">
    <span className="font-mono text-[10px] text-[#4f5962]">0{index + 1}</span>
    <span className={`h-1.5 w-1.5 rounded-full ${color} ${status === "running" ? "animate-pulse" : ""}`} />
    <div className="min-w-0 flex-1"><div className="text-xs">{pillar.label}</div><div className="mt-0.5 text-[10px] text-[#59646e]">{pillar.short}</div></div>
    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#59646e]">{status === "idle" ? "queued" : status === "running" ? "live" : status}</span>
  </div>;
}

function ResearchMemo({ briefing, style, pillarData, decisionNote, onDecisionNoteChange }: { briefing: Briefing; style: TradingStyle; pillarData: PillarBundle | null; decisionNote: string; onDecisionNoteChange: (value: string) => void }) {
  return <article className="mt-10 border border-white/[0.12] bg-[#eef1ed] text-[#141918]">
    <header className="border-b border-[#141918]/15 px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#55721a]">Research record · {briefing.model}</div><h2 className="mt-3 max-w-4xl text-3xl font-medium leading-tight tracking-[-0.05em] sm:text-5xl">{briefing.title}</h2></div>
        <div className="min-w-[180px] text-right text-xs leading-5 text-[#59645e]"><div className="font-mono text-[10px] uppercase text-[#778078]">Frame</div>{STYLES[style].label}<br />{briefing.regime ?? "regime unavailable"}</div>
      </div>
    </header>
    <MemoSection number="01" title="Evidence"><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4">{briefing.evidence.map((item, index) => <EvidenceLine key={`${item.source}-${index}`} item={item} />)}</div><div className="space-y-4">{briefing.flags && <FlagsCard flags={briefing.flags} />}{pillarData?.marketStructure && <RmtCard market={pillarData.marketStructure} />}{pillarData?.news && <SocialSummary news={pillarData.news} />}</div></div></MemoSection>
    <MemoSection number="02" title="Tension" shaded><div className="grid gap-3 md:grid-cols-2">{briefing.tension.map((item, index) => <div key={index} className="border border-[#141918]/12 bg-[#141918]/[0.035] p-4"><div className="grid gap-3 text-sm sm:grid-cols-2"><p>{item.left}</p><p className="text-[#55721a]">{item.right}</p></div><p className="mt-4 border-t border-[#141918]/10 pt-3 text-xs leading-5 text-[#59645e]">{item.whyItMatters}</p></div>)}</div></MemoSection>
    <MemoSection number="03" title="Historical analog" shaded><p className="max-w-4xl text-sm leading-6">{briefing.historicalAnalog.setup}</p><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="border-b border-[#141918]/15 font-mono text-[10px] uppercase tracking-[0.12em] text-[#55721a]"><tr><th className="pb-3">Ticker</th><th className="pb-3">Date</th><th className="pb-3">Similarity</th><th className="pb-3">Follow-through</th></tr></thead><tbody>{briefing.historicalAnalog.analogs.slice(0, 5).map((item, index) => <tr key={index} className="border-b border-[#141918]/[0.08]"><td className="py-3 font-medium">{item.ticker}</td><td className="py-3 text-[#59645e]">{item.date}</td><td className="py-3 text-[#59645e]">{item.similarity}</td><td className="py-3">{item.followed}</td></tr>)}</tbody></table></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{briefing.historicalAnalog.baseRates.map((item) => <div key={item.horizon} className="border border-[#141918]/12 p-4"><div className="font-mono text-[10px] uppercase text-[#55721a]">{item.horizon} · n={item.n}</div><p className="mt-2 text-xs leading-5">{item.range}</p><p className="mt-2 text-[11px] leading-5 text-[#59645e]">{item.note}</p></div>)}</div><p className="mt-5 max-w-4xl text-xs leading-5 text-[#59645e]">{briefing.historicalAnalog.caveat}</p></MemoSection>
    <MemoSection number="04" title="Considerations for the trader"><div className="grid gap-8 md:grid-cols-3"><ConsiderationList title="For this style" items={briefing.considerations.forStyle} /><ConsiderationList title="Invalidation" items={briefing.considerations.invalidation} /><ConsiderationList title="Questions to weigh" items={briefing.considerations.questions} /></div></MemoSection>
    <section className="border-t border-[#141918]/15 bg-[#dfe6dc] px-5 py-6 sm:px-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#55721a]">Human decision record</div><h3 className="mt-2 text-xl tracking-[-0.03em]">What remains unresolved for you?</h3><p className="mt-2 text-xs text-[#59645e]">Stored in this browser only. This is reflection, not an execution control.</p></div><span className="font-mono text-[10px] uppercase text-[#778078]">No automated action</span></div><textarea value={decisionNote} onChange={(event) => onDecisionNoteChange(event.target.value)} rows={4} className="mt-5 w-full resize-none border border-[#141918]/15 bg-[#eef1ed] p-3 text-sm leading-6 outline-none focus:border-[#55721a]" placeholder="What are you waiting for? Which fact would change your mind?" /></section>
  </article>;
}

function EvidenceLine({ item }: { item: Briefing["evidence"][number] }) {
  return <div className="border-l-2 border-[#789b26] pl-4"><p className="text-sm leading-6">{item.claim}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#778078]">{item.source} · {item.pillar}</p></div>;
}

function FlagsCard({ flags }: { flags: StructureFlags }) {
  return <div className="border border-[#141918]/15 p-4"><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#55721a]">Separate evidence flags</div><div className="mt-3 space-y-2 text-xs">{[["Catalyst density", flags.catalystDensity], ["Regime alignment", flags.regimeAlignment], ["Community stability", flags.communityStability], ["Analog base", `n=${flags.analogQuality.n} · ${flags.analogQuality.clustered ? "clustered" : "scattered"}`]].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><span className="text-[#778078]">{label}</span><span>{value}</span></div>)}</div>{flags.balanceSheet.length > 0 && <p className="mt-3 border-t border-[#141918]/10 pt-3 text-[11px] leading-5 text-[#59645e]">{flags.balanceSheet[0]}</p>}</div>;
}

function RmtCard({ market }: { market: MarketStructurePillar }) {
  return <div className="border border-[#141918]/15 p-4"><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#55721a]">RMT structure · {market.communityId ?? "unavailable"}</div><p className="mt-3 text-xs leading-5">Market-mode share {market.marketModeStrength !== undefined ? `${(market.marketModeStrength * 100).toFixed(1)}%` : "n/a"} · {market.infoBeyondNoisePct?.toFixed(1) ?? "n/a"}% beyond noise · {market.universeSize} assets.</p><p className="mt-2 text-[11px] leading-5 text-[#59645e]">{market.stability ?? market.caveats.join(" ")}</p></div>;
}

function SocialSummary({ news }: { news: NewsPillar }) {
  return <div className="border border-[#141918]/15 p-4"><div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#55721a]">Discourse coverage</div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><span className="text-[#778078]">Headlines</span><br />{news.headlines.length}</div><div><span className="text-[#778078]">X posts</span><br />{news.social.x.length}</div><div><span className="text-[#778078]">YouTube</span><br />{news.social.youtube.length}</div><div><span className="text-[#778078]">Aggregate</span><br />{news.aggregateLean}</div></div>{news.caveats.length > 0 && <p className="mt-3 text-[11px] leading-5 text-[#59645e]">{news.caveats[0]}</p>}</div>;
}

function MemoSection({ number, title, children, shaded = false }: { number: string; title: string; children: React.ReactNode; shaded?: boolean }) {
  return <section className={`border-t border-[#141918]/15 px-5 py-7 sm:px-8 ${shaded ? "bg-[#e6ebe3]" : "bg-[#eef1ed]"}`}><div className="mb-6 flex items-center gap-3"><span className="font-mono text-[10px] text-[#55721a]">{number}</span><h3 className="text-xl tracking-[-0.035em]">{title}</h3></div>{children}</section>;
}

function ConsiderationList({ title, items }: { title: string; items: string[] }) {
  return <div><h4 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#55721a]">{title}</h4><ul className="mt-3 space-y-3">{items.map((item, index) => <li key={index} className="flex gap-2 text-xs leading-5"><span className="text-[#789b26]">/</span><span>{item}</span></li>)}</ul></div>;
}
