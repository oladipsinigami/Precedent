import { runAnalogs } from "./pillars/analogs";
import { runFundamentals } from "./pillars/fundamentals";
import { runMarketStructure } from "./pillars/market-structure";
import { runNews } from "./pillars/sentiment";
import { runTechnicals } from "./pillars/technicals";
import { bitgetRTokenMarkets, bitgetRwaContracts } from "./providers/bitget";
import { detectRegime } from "./regime";
import { deterministicBriefing, synthesize } from "./synthesis";
import type { PillarBundle, PillarId, ResearchEvent, TradingStyle } from "./types";
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
    // Keep the built-in universe available when Bitget discovery is temporarily unavailable.
  }

  // Regime runs ONCE per research run, before the pillars, and frames the memo.
  const { regime } = await detectRegime(name);
  yield { type: "meta", style: input.style, symbol: name.native, name: name.name, question: input.question, regime };

  const order: PillarId[] = ["analogs", "technicals", "fundamentals", "news", "marketStructure"];
  for (const id of order) yield { type: "pillar", id, status: "running" };

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

  let briefing;
  try {
    briefing = await synthesize({
      style: input.style,
      question: input.question,
      name,
      regime,
      pillars,
    });
  } catch {
    briefing = deterministicBriefing({
      style: input.style,
      question: input.question,
      name,
      regime,
      pillars,
      flags: undefined,
    });
    yield {
      type: "error",
      message: "Synthesis step had a problem. Showing a simplified research note instead.",
    };
  }
  if (briefing.model.includes("fell back to deterministic synthesizer")) {
    yield {
      type: "error",
      message: "Synthesis step had a problem. Showing a simplified research note instead.",
    };
  }
  yield { type: "briefing", briefing };
  yield { type: "done" };
}
