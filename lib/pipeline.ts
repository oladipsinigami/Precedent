import { runAnalogs } from "./pillars/analogs";
import { runFundamentals } from "./pillars/fundamentals";
import { runMarketStructure } from "./pillars/market-structure";
import { runNews } from "./pillars/sentiment";
import { runTechnicals } from "./pillars/technicals";
import { bitgetRTokenMarkets, bitgetRwaContracts } from "./providers/bitget";
import { detectRegime } from "./regime";
import { deterministicBriefing, synthesize } from "./synthesis";
import type { Briefing, PillarBundle, PillarId, ResearchEvent, TradingStyle } from "./types";
import { findName, nameFromBitgetContract, nameFromBitgetRTokenMarket } from "./universe";

function queryMentions(query: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(query);
}

export async function* runResearch(input: {
  style: TradingStyle;
  question: string;
  symbol?: string;
}): AsyncGenerator<ResearchEvent> {
  const requested = `${input.symbol ?? ""} ${input.question}`;
  // Live Bitget discovery enriches or resolves the instrument. It runs whether
  // or not the built-in universe matched, so newly listed rTokens work too.
  let name = findName(requested);
  try {
    const rToken = (await bitgetRTokenMarkets()).find((item) => {
      return (
        queryMentions(requested, item.baseCoin) ||
        queryMentions(requested, item.symbol) ||
        queryMentions(requested, item.baseCoin.slice(1))
      );
    });
    if (rToken) name = nameFromBitgetRTokenMarket(rToken);
    else {
      const contract = (await bitgetRwaContracts()).find((item) => {
        return queryMentions(requested, item.baseCoin) || queryMentions(requested, item.symbol);
      });
      if (contract) name = nameFromBitgetContract(contract);
    }
  } catch {
    // Discovery unavailable; the built-in universe match (if any) still applies.
  }
  if (!name) {
    // Refuse rather than silently research the wrong company.
    yield {
      type: "error",
      message:
        "Could not identify a supported rToken or underlying symbol in your question. Name a listed instrument (e.g. AAPL, NVDA, TSLA) or pick one from the instrument list.",
    };
    yield { type: "done" };
    return;
  }

  // Regime runs ONCE per research run, before the pillars, and frames the memo.
  const { regime } = await detectRegime(name);
  yield { type: "meta", style: input.style, symbol: name.native, name: name.name, question: input.question, regime };

  const initialMessages: Partial<Record<PillarId, string>> = {
    fundamentals: "Pulling SEC filings…",
    technicals: "Comparing rToken vs cash session…",
    news: "Scanning news & macro headlines…",
    analogs: "Matching historical charts…",
    marketStructure: "Resolving market structure…",
  };
  const order: PillarId[] = ["fundamentals", "technicals", "news", "analogs", "marketStructure"];
  for (const id of order) {
    yield { type: "pillar", id, status: "running", message: initialMessages[id] };
  }

  // Market structure resolves first so its community can condition analogs;
  // the remaining four pillars still run in parallel with each other.
  const marketStructure = await runMarketStructure(name);
  const [analogs, technicals, fundamentals, news] = await Promise.all([
    runAnalogs(name, {
      regime,
      communityId: marketStructure.communityId,
      communityMembers: marketStructure.communityMembers,
    }),
    runTechnicals(name),
    runFundamentals(name),
    runNews(name),
  ]);

  const pillars: PillarBundle = { analogs, technicals, fundamentals, news, marketStructure };
  const pack: Record<PillarId, PillarBundle[PillarId]> = pillars;

  for (const id of order) {
    const data = pack[id];
    yield {
      type: "pillar",
      id,
      status: data.ok ? "ready" : "degraded",
      data,
    };
  }

  yield { type: "status", stage: "synthesis", message: "Synthesizing research memo…" };

  const SYNTHESIS_TIMEOUT_MS = 48_000;
  let briefing: Briefing;
  let synthesisFailed = false;

  try {
    briefing = await Promise.race([
      synthesize({
        style: input.style,
        question: input.question,
        name,
        regime,
        pillars,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Synthesis call timed out")), SYNTHESIS_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    synthesisFailed = true;
    console.warn("[Pipeline] Synthesis step encountered an error or timeout:", err);
    briefing = deterministicBriefing({
      style: input.style,
      question: input.question,
      name,
      regime,
      pillars,
      flags: undefined,
    });
    briefing.model = "Precedent Quantitative Desk";
  }

  const isFallback =
    synthesisFailed ||
    briefing.isFallback ||
    !briefing.model ||
    briefing.model.includes("deterministic") ||
    briefing.model.includes("fell back");

  if (isFallback) {
    briefing.isFallback = true;
    if (!briefing.model || briefing.model.includes("deterministic") || briefing.model.includes("fell back")) {
      briefing.model = "Precedent Quantitative Desk";
    }
  }

  yield { type: "briefing", briefing };
  yield { type: "done" };
}
