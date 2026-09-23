import { runAnalogs } from "./pillars/analogs";
import { runFundamentals } from "./pillars/fundamentals";
import { runMarketStructure } from "./pillars/market-structure";
import { runNews } from "./pillars/sentiment";
import { runTechnicals } from "./pillars/technicals";
import { bitgetRTokenMarkets, bitgetRwaContracts, type BitgetRTokenMarket, type BitgetRwaContract } from "./providers/bitget";
import { detectRegime } from "./regime";
import { DEMO_TASK } from "./style-profiles";
import { deterministicBriefing, synthesize } from "./synthesis";
import type { Briefing, PillarBundle, PillarId, ResearchEvent, StructureFlags, TradingStyle } from "./types";
import { findName, nameFromBitgetContract, nameFromBitgetRTokenMarket, type NameCard } from "./universe";

// Time budget defaults. Callers (the API route) normally pass an explicit deadline
// derived from the serverless maxDuration; these apply when none is provided.
const DEFAULT_BUDGET_MS = 55_000;
const SYNTHESIS_MAX_MS = 48_000;
// Below this, an LLM call is unlikely to finish, so go straight to the deterministic memo.
const SYNTHESIS_MIN_MS = 8_000;
// Reserved for building the fallback memo and streaming it back.
const RESPONSE_MARGIN_MS = 3_000;

// Fixed date for the illustrative demo bundle. Sample values must never be
// stamped with the current date, or they read as live market data.
const SAMPLE_AS_OF = "2024-08-30";
const SAMPLE_LABEL = "Illustrative sample (not live)";

function queryMentions(query: string, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(query);
}

// In-memory cache with short TTL (10 minutes) for Bitget markets, contracts, and demo data
const cache = new Map<string, { data: unknown; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  return null;
}

function setCache<T>(key: string, data: T, ttlMs = 10 * 60 * 1000) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

async function getCachedBitgetRTokenMarkets(): Promise<BitgetRTokenMarket[]> {
  const cached = getCached<BitgetRTokenMarket[]>("bitgetRTokenMarkets");
  if (cached) return cached;
  const markets = await bitgetRTokenMarkets();
  if (markets && markets.length > 0) {
    setCache("bitgetRTokenMarkets", markets, 10 * 60 * 1000);
  }
  return markets;
}

async function getCachedBitgetRwaContracts(): Promise<BitgetRwaContract[]> {
  const cached = getCached<BitgetRwaContract[]>("bitgetRwaContracts");
  if (cached) return cached;
  const contracts = await bitgetRwaContracts();
  if (contracts && contracts.length > 0) {
    setCache("bitgetRwaContracts", contracts, 10 * 60 * 1000);
  }
  return contracts;
}

// The sample bundle is only served on an explicit demo request for the exact
// recommended demo task. Ordinary questions (even about AAPL) always run live.
function isDemoRequest(input: {
  style: TradingStyle;
  question: string;
  demo?: boolean;
  useCachedMemo?: boolean;
}): boolean {
  if (!input.demo && !input.useCachedMemo) return false;
  return input.style === DEMO_TASK.style && input.question.trim() === DEMO_TASK.question.trim();
}

function buildDemoBundle(style: TradingStyle, question: string) {
  const demoName: NameCard = findName("AAPL") ?? {
    native: "AAPL",
    rToken: "rAAPL",
    name: "Apple Inc.",
    sector: "Technology",
    cik: "0000320193",
    bitgetSymbols: ["RAAPLUSDT", "rAAPLUSDT"],
    aliases: ["apple", "aapl rtoken", "aaplr"],
  };

  const demoPillars: PillarBundle = {
    fundamentals: {
      ok: true,
      company: "Apple Inc.",
      ticker: "AAPL",
      sector: "Technology",
      fiscalYearEnd: "September",
      latestFilings: [
        {
          form: "10-Q",
          filed: "2024-08-02",
          title: "Quarterly Report for the Period Ending June 29, 2024",
          url: "https://www.sec.gov/edgar/browse/?CIK=0000320193",
        },
        {
          form: "10-K",
          filed: "2024-11-01",
          title: "Annual Report for Fiscal Year Ended September 28, 2024",
          url: "https://www.sec.gov/edgar/browse/?CIK=0000320193",
        },
      ],
      eps: { form: "10-Q", filed: "2024-08-02", periodEnd: "2024-06-29", value: 1.64 },
      catalysts: [
        "Apple Intelligence phased feature rollout cycle across iOS 18 devices",
        "Services segment revenue growth",
        "Large active installed device base",
      ],
      notes: [
        "Sample snapshot: cash, equivalents, and marketable securities figures are illustrative.",
        "Capital return framework active with share repurchases and quarterly dividends.",
      ],
      sources: [
        { label: `SEC EDGAR filings index (CIK 0000320193) · ${SAMPLE_LABEL}` },
      ],
    },
    technicals: {
      ok: true,
      native: {
        last: 234.85,
        changePct: 1.24,
        high52: 237.49,
        low52: 164.08,
        volume: 48210000,
        asOf: SAMPLE_AS_OF,
      },
      rToken: {
        last: 235.1,
        changePct: 1.35,
        venue: "Bitget spot",
        symbol: "rAAPLUSDT",
        asOf: `${SAMPLE_AS_OF}T20:00:00.000Z`,
      },
      rTokenGap:
        "Sample: rToken at a +$0.25 (+0.11%) premium over the 4:00 PM New York cash close ($234.85 vs $235.10).",
      trend: "Consolidation near 52-week highs with ordered moving averages (SMA20 > SMA50 > SMA200).",
      momentum: "RSI14 at 58.4, below the overbought (>70) threshold.",
      volatility: "20-day realized volatility at 18.2%.",
      levels: {
        support: [231.0, 228.5, 224.2],
        resistance: [237.5, 242.0, 248.0],
      },
      indicators: {
        rsi14: 58.4,
        sma20: 230.15,
        sma50: 224.6,
        sma200: 198.4,
        realizedVol20: 18.2,
      },
      spark: [226.5, 227.8, 229.1, 228.4, 230.2, 232.0, 231.5, 233.4, 234.1, 234.85],
      notes: [
        "Sample: overnight rToken basis spread within +0.10% to +0.25%.",
        "Sample: volume concentrated in the $228-$231 consolidation range.",
      ],
      sources: [{ label: `Price and rToken snapshot · ${SAMPLE_LABEL}` }],
    },
    news: {
      ok: true,
      headlines: [
        {
          title: "Apple Intelligence features roll out to developer betas ahead of broader launch",
          publisher: SAMPLE_LABEL,
          url: "#",
          tag: "product",
          lean: "constructive",
        },
        {
          title: "Tech mega-caps steady as Treasury yields consolidate following FOMC remarks",
          publisher: SAMPLE_LABEL,
          url: "#",
          tag: "macro",
          lean: "mixed",
        },
        {
          title: "Supply chain checks point to steady iPhone demand in North America and Europe",
          publisher: SAMPLE_LABEL,
          url: "#",
          tag: "guidance",
          lean: "constructive",
        },
      ],
      macro: [
        "Sample: FOMC policy stance described as gradual easing.",
        "Sample: US 10-year Treasury yield between 4.15% and 4.25%.",
      ],
      social: {
        x: [
          {
            id: "sample-x-1",
            platform: "x",
            text: "AAPL holding the $230 shelf into next week. 7x24 basis spread is tight.",
            author: "sample_user_1",
            url: "#",
            createdAt: `${SAMPLE_AS_OF}T14:00:00.000Z`,
            metrics: { likes: 142, reposts: 28 },
            lean: "constructive",
            engagementScore: 198,
          },
          {
            id: "sample-x-2",
            platform: "x",
            text: "Watching the Apple Intelligence rollout cadence versus consensus expectations.",
            author: "sample_user_2",
            url: "#",
            createdAt: `${SAMPLE_AS_OF}T15:30:00.000Z`,
            metrics: { likes: 89, reposts: 14 },
            lean: "constructive",
            engagementScore: 117,
          },
        ],
      },
      aggregateLean: "constructive",
      caveats: [
        "All headlines and posts in this memo are illustrative samples, not live news.",
        "Social discourse is retail-weighted and reflects attention, not fundamentals.",
      ],
      notes: ["Sample headline tone: constructive on AI features, mixed on macro."],
      sources: [{ label: `Headlines and social posts · ${SAMPLE_LABEL}` }],
    },
    analogs: {
      ok: true,
      session: SAMPLE_AS_OF,
      state: "Consolidation near multi-month highs following earnings drift with compressed volatility.",
      closest: [
        {
          ticker: "AAPL",
          date: "2023-11-14",
          distance: 0.082,
          sameName: true,
          ret1d: 0.9,
          ret5d: 2.45,
          ret10d: 3.8,
          note: "Post-breakout consolidation with low realized volatility",
        },
        {
          ticker: "MSFT",
          date: "2023-04-18",
          distance: 0.094,
          sameName: false,
          ret1d: 0.4,
          ret5d: 1.85,
          ret10d: 4.1,
          note: "Peer mega-cap multi-week range",
        },
        {
          ticker: "AAPL",
          date: "2021-03-24",
          distance: 0.108,
          sameName: true,
          ret1d: -0.35,
          ret5d: 1.15,
          ret10d: 2.9,
          note: "Pre-catalyst range trade above rising 50 DMA",
        },
        {
          ticker: "GOOGL",
          date: "2023-10-06",
          distance: 0.119,
          sameName: false,
          ret1d: 0.65,
          ret5d: -0.8,
          ret10d: 1.4,
          note: "Range retest under macro headline pressure",
        },
        {
          ticker: "AAPL",
          date: "2020-08-12",
          distance: 0.125,
          sameName: true,
          ret1d: 1.1,
          ret5d: 3.9,
          ret10d: 5.6,
          note: "Trend continuation following quarterly filing",
        },
      ],
      ranges: [
        { horizon: "1d", n: 84, p10: -1.2, p50: 0.45, p90: 1.8, pUp: 0.62 },
        { horizon: "5d", n: 84, p10: -2.1, p50: 1.65, p90: 4.2, pUp: 0.65 },
        { horizon: "10d", n: 84, p10: -2.8, p50: 2.9, p90: 6.4, pUp: 0.68 },
      ],
      overlay: [
        {
          id: "current",
          label: "AAPL (sample)",
          kind: "current",
          points: Array.from({ length: 21 }, (_, i) => ({ t: i - 20, value: 95 + i * 0.5 + Math.sin(i / 2) })),
        },
        {
          id: "analog-1",
          label: "AAPL Nov 2023",
          kind: "analog",
          points: Array.from({ length: 31 }, (_, i) => ({
            t: i - 20,
            value: 94 + i * 0.45 + (i > 20 ? (i - 20) * 0.35 : 0),
          })),
        },
        {
          id: "analog-2",
          label: "MSFT Apr 2023",
          kind: "analog",
          points: Array.from({ length: 31 }, (_, i) => ({
            t: i - 20,
            value: 94.5 + i * 0.4 + (i > 20 ? (i - 20) * 0.25 : 0),
          })),
        },
      ],
      sample: { n: 84, symbols: 8, sessions: 840 },
      caveats: [
        "Analog matches and ranges in this memo are illustrative samples.",
        "Historical chart analogs describe past return distributions and do not constitute a forecast.",
      ],
      sources: [{ label: `Historical analog matches · ${SAMPLE_LABEL}` }],
    },
    marketStructure: {
      ok: true,
      communityId: "community-2",
      communityMembers: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META"],
      marketModeStrength: 0.42,
      infoBeyondNoisePct: 68.4,
      stability: "stable",
      universeSize: 45,
      cleanedCorrelations: [
        { peer: "MSFT", raw: 0.68, cleaned: 0.61 },
        { peer: "GOOGL", raw: 0.59, cleaned: 0.52 },
        { peer: "NVDA", raw: 0.54, cleaned: 0.46 },
      ],
      caveats: ["RMT correlation matrix applies Marchenko-Pastur filtering to isolate true sector co-movement."],
      sources: [{ label: `RMT market-structure values · ${SAMPLE_LABEL}` }],
    },
  };

  const demoFlags: StructureFlags = {
    catalystDensity: "moderate",
    balanceSheet: ["Sample balance-sheet snapshot (illustrative)."],
    regimeAlignment: "aligned",
    communityStability: "stable",
    cleanedCorrRankPct: 82,
    analogQuality: { n: 84, clustered: true },
  };

  const demoBriefing = deterministicBriefing({
    style,
    question,
    name: demoName,
    regime: "normal",
    pillars: demoPillars,
    flags: demoFlags,
  });
  demoBriefing.model = "Precedent Quantitative Desk (sample data)";
  demoBriefing.isSample = true;

  return { name: demoName, pillars: demoPillars, briefing: demoBriefing, regime: "normal" as const };
}

export async function* runResearch(input: {
  style: TradingStyle;
  question: string;
  symbol?: string;
  demo?: boolean;
  useCachedMemo?: boolean;
  // Epoch ms by which the whole run (including the memo) must be produced.
  deadline?: number;
}): AsyncGenerator<ResearchEvent> {
  const deadline = input.deadline ?? Date.now() + DEFAULT_BUDGET_MS;

  // Explicit demo request for the exact demo task: serve the labeled sample memo.
  if (isDemoRequest(input)) {
    const cachedDemo = getCached<ReturnType<typeof buildDemoBundle>>(`demoBundle:${input.style}`);
    const bundle = cachedDemo ?? buildDemoBundle(input.style, input.question);
    if (!cachedDemo) {
      setCache(`demoBundle:${input.style}`, bundle, 15 * 60 * 1000);
    }

    yield {
      type: "meta",
      style: input.style,
      symbol: bundle.name.native,
      name: bundle.name.name,
      question: input.question,
      regime: bundle.regime,
    };

    const initialMessages: Partial<Record<PillarId, string>> = {
      fundamentals: "Loading sample filings…",
      technicals: "Loading sample price snapshot…",
      news: "Loading sample headlines…",
      analogs: "Loading sample analogs…",
      marketStructure: "Loading sample market structure…",
    };
    const order: PillarId[] = ["fundamentals", "technicals", "news", "analogs", "marketStructure"];
    for (const id of order) {
      yield { type: "pillar", id, status: "running", message: initialMessages[id] };
    }

    for (const id of order) {
      yield {
        type: "pillar",
        id,
        status: "ready",
        data: bundle.pillars[id],
      };
    }

    yield { type: "status", stage: "synthesis", message: "Building sample research memo…" };
    yield { type: "briefing", briefing: bundle.briefing };
    yield { type: "done" };
    return;
  }

  const requested = `${input.symbol ?? ""} ${input.question}`;
  // Live Bitget discovery enriches or resolves the instrument. It runs whether
  // or not the built-in universe matched, so newly listed rTokens work too.
  let name = findName(requested);
  try {
    const rToken = (await getCachedBitgetRTokenMarkets()).find((item) => {
      return (
        queryMentions(requested, item.baseCoin) ||
        queryMentions(requested, item.symbol) ||
        queryMentions(requested, item.baseCoin.slice(1))
      );
    });
    if (rToken) name = nameFromBitgetRTokenMarket(rToken);
    else {
      const contract = (await getCachedBitgetRwaContracts()).find((item) => {
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

  // Synthesis gets whatever time remains before the deadline (capped), minus a
  // margin reserved for the deterministic fallback and streaming.
  const synthesisBudgetMs = Math.min(SYNTHESIS_MAX_MS, deadline - Date.now() - RESPONSE_MARGIN_MS);
  let briefing: Briefing;
  let synthesisFailed = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    if (synthesisBudgetMs < SYNTHESIS_MIN_MS) {
      throw new Error(`Insufficient time for LLM synthesis (${synthesisBudgetMs}ms remaining)`);
    }
    briefing = await Promise.race([
      synthesize({
        style: input.style,
        question: input.question,
        name,
        regime,
        pillars,
        timeoutMs: synthesisBudgetMs - 1_000,
      }),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error("Synthesis call timed out")), synthesisBudgetMs);
      }),
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
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
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
