export type TradingStyle = "day" | "swing" | "event" | "position";

export type PillarId = "fundamentals" | "technicals" | "news" | "analogs" | "marketStructure";

// Neutral structural labels only: they describe the shape of the tape
// (trend direction, systemic-risk intensity), never a call on what happens next.
export type Regime =
  | "trending-up"
  | "range-bound"
  | "trending-down"
  | "high-systemic"
  | "normal"
  | "low-systemic";

export type SourceRef = {
  label: string;
  url?: string;
};

export type Citation = {
  claim: string;
  source: string;
  pillar: PillarId;
};

export type AnalogFollowThrough = {
  ticker: string;
  date: string;
  distance: number;
  sameName: boolean;
  ret1d: number | null;
  ret5d: number | null;
  ret10d: number | null;
  note?: string;
};

export type AnalogRange = {
  horizon: string;
  n: number;
  p10: number;
  p50: number;
  p90: number;
  pUp: number;
};

export type OverlayPoint = {
  t: number;
  value: number | null;
};

export type OverlaySeries = {
  id: string;
  label: string;
  kind: "current" | "analog";
  points: OverlayPoint[];
};

export type FundamentalsPillar = {
  ok: boolean;
  error?: string;
  company: string;
  ticker: string;
  fiscalYearEnd?: string;
  sector?: string;
  latestFilings: {
    form: string;
    filed: string;
    reportDate?: string;
    title?: string;
    url: string;
  }[];
  eps?: {
    value: number;
    periodEnd: string;
    form: string;
    filed: string;
    frame?: string;
    prior?: number;
    surpriseNote?: string;
  };
  revenue?: {
    value: number;
    periodEnd: string;
    form: string;
    filed: string;
    frame?: string;
  };
  simfin?: {
    revenue?: number;
    netIncome?: number;
    operatingIncome?: number;
    grossProfit?: number;
    eps?: number;
    grossMargin?: number;
    operatingMargin?: number;
    netMargin?: number;
    freeCashFlow?: number;
    period?: string;
    fiscalYear?: number;
    reportDate?: string;
  };
  catalysts: string[];
  notes: string[];
  sources: SourceRef[];
};

export type TechnicalsPillar = {
  ok: boolean;
  error?: string;
  native: {
    last: number;
    changePct: number;
    high52: number;
    low52: number;
    volume: number;
    asOf: string;
  };
  rToken?: {
    last: number;
    changePct: number;
    symbol: string;
    venue: string;
    asOf: string;
    premiumPct?: number | null;
  };
  rTokenGap?: string;
  trend: string;
  momentum: string;
  volatility: string;
  levels: { support: number[]; resistance: number[] };
  indicators: {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    rsi14?: number;
    macd?: number;
    macdSignal?: number;
    atr14?: number;
    realizedVol20?: number;
    dist52wHighPct?: number;
  };
  spark: number[];
  notes: string[];
  sources: SourceRef[];
};

export type NewsPillar = {
  ok: boolean;
  error?: string;
  headlines: {
    title: string;
    publisher: string;
    url: string;
    published?: string;
    tag: "earnings" | "guidance" | "macro" | "product" | "legal" | "other";
    lean: "constructive" | "cautious" | "mixed";
  }[];
  macro: string[];
  social: {
    x: SocialPost[];
    reddit?: SocialPost[];
    polymarket?: SocialPost[];
  };
  adanos?: {
    buzzScore?: number;
    sentimentScore?: number;
    redditMentions?: number;
    xMentions?: number;
    bullishPct?: number;
    bearishPct?: number;
    topSubreddits?: string[];
    explanation?: string;
  };
  aggregateLean: Lean | "insufficient";
  volumeNote?: string;
  caveats: string[];
  notes: string[];
  sources: SourceRef[];
};

export type Lean = "constructive" | "cautious" | "mixed" | "neutral";

export type SocialPost = {
  id: string;
  platform: "x" | "reddit" | "polymarket";
  text: string;
  author: string;
  url: string;
  createdAt: string;
  metrics: {
    likes?: number;
    reposts?: number;
    replies?: number;
    views?: number;
  };
  lean: Lean;
  engagementScore: number;
};

export type AnalogsPillar = {
  ok: boolean;
  error?: string;
  session?: string;
  state?: string;
  prevState?: string;
  tape?: Record<string, unknown>;
  closest: AnalogFollowThrough[];
  ranges: AnalogRange[];
  informative?: {
    verdict?: string;
    ratioToBase?: number;
    note?: string;
  };
  overlay: OverlaySeries[];
  sample: { n: number; symbols: number; sessions: number };
  caveats: string[];
  sources: SourceRef[];
};

export type PillarBundle = {
  fundamentals: FundamentalsPillar;
  technicals: TechnicalsPillar;
  news: NewsPillar;
  analogs: AnalogsPillar;
  marketStructure: MarketStructurePillar;
};

export type MarketStructurePillar = {
  ok: boolean;
  error?: string;
  communityId?: string;
  communityMembers?: string[];
  marketModeStrength?: number;
  cleanedCorrelations?: { peer: string; raw: number; residual: number }[];
  infoBeyondNoisePct?: number;
  stability?: string;
  universeSize: number;
  computedAt?: string;
  stale?: boolean;
  caveats: string[];
  sources: SourceRef[];
};

// Research-only evidence flags. Deliberately NOT a blended score: each flag is
// shown separately and left unresolved so disagreement stays visible.
export type StructureFlags = {
  catalystDensity: "high" | "moderate" | "low";
  balanceSheet: string[];
  regimeAlignment: "aligned" | "misaligned";
  communityStability: "stable" | "unstable";
  cleanedCorrRankPct?: number;
  analogQuality: { n: number; clustered: boolean };
};

export type Briefing = {
  title: string;
  whatWeDid: string;
  historicalStressTest: {
    summary: string;
    sampleSize: number;
    results: {
      period: "Next 1 trading day" | "Next 5 trading days" | "Next 10 trading days" | "Next day";
      wentUp: string;
      typicalMove: string;
      median: string;
    }[];
    examples: { when: string; whatHappened: string }[];
    importantNote: string;
  };
  otherThingsWeChecked: string[];
  whereThingsDoNotAgree: { conflict: string; whyItMatters: string }[];
  simpleTakeAways: string[];
  questionsOnlyYouCanAnswer: string[];
  unverified?: string[];
  // Legacy fields remain as an internal compatibility bridge for existing memo components.
  styleNote: string;
  model: string;
  isFallback?: boolean;
  // True when the memo was built from the built-in illustrative demo bundle, not live data.
  isSample?: boolean;
  regime?: Regime;
  flags?: StructureFlags;
  evidence: Citation[];
  tension: { left: string; right: string; whyItMatters: string }[];
  historicalAnalog: {
    setup: string;
    analogs: {
      ticker: string;
      date: string;
      similarity: string;
      followed: string;
    }[];
    baseRates: {
      horizon: string;
      range: string;
      n: number;
      note: string;
    }[];
    caveat: string;
  };
  considerations: {
    forStyle: string[];
    invalidation: string[];
    questions: string[];
  };
  sources: SourceRef[];
};

export type ResearchRequest = {
  style: TradingStyle;
  question: string;
  symbol?: string;
};

export type StressDirection = "LONG" | "SHORT";

export type StressTest = {
  asset: string;
  rToken?: string;
  direction: StressDirection;
  capital: number;
  timeHorizon: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  riskBasis: string;
  metrics: {
    sampleSize: number;
    historicalWinRate: number | null;
    medianReturnPct: number | null;
    maxDrawdownPct: number | null;
    confidenceScore: number | null;
  };
  shockScenarios: {
    event: string;
    projectedAssetChangePct: number;
    dollarPnL: number;
    basis: string;
  }[];
  portfolioImpact: {
    status: "unavailable";
    note: string;
  };
  safeguards: {
    suggestedEntryStrategy: string;
    recommendedStopLossPct: number | null;
    suggestedStopLossPrice: number | null;
    maxRiskBudgetDollars: number | null;
    invalidationLevel: string;
  };
  executionAction: {
    requiresHumanConfirmation: true;
    targetExchange: "Bitget";
    actionButtonLabel: "Review plan only";
  };
};

export type PillarStatus = "pending" | "running" | "ready" | "degraded" | "failed";
export type PillarState = Record<PillarId, PillarStatus>;

export type ResearchEvent =
  | { type: "meta"; style: TradingStyle; symbol: string; name: string; question: string; regime: Regime }
  | { type: "pillar"; id: PillarId; status: PillarStatus; message?: string; data?: unknown }
  | { type: "status"; stage: "pillars" | "synthesis" | "complete"; message?: string }
  | { type: "briefing"; briefing: Briefing }
  | { type: "error"; message: string }
  | { type: "done" };
