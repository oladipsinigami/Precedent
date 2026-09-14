import OpenAI from "openai";
import { deterministicBriefing, collectSources } from "./deterministic-briefing";
import { computeFlags } from "./flags";
import { guardBriefing, cleanHistoricalSummary } from "./language-guard";
import { STYLES } from "./style-profiles";
import type { Briefing, PillarBundle, Regime, TradingStyle } from "./types";
import type { NameCard } from "./universe";

export { deterministicBriefing, collectSources } from "./deterministic-briefing";

function providers() {
  const available: { label: string; model: string; client: OpenAI }[] = [];

  const openRouterKey =
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith("sk-or-") ? process.env.OPENAI_API_KEY : undefined);

  // 1. Always prioritize free OpenRouter models whenever an OpenRouter API key is available
  if (openRouterKey) {
    const client = new OpenAI({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      maxRetries: 0, // Fail fast on rate-limited or overloaded free endpoints to immediately try the next model
      defaultHeaders: {
        "HTTP-Referer": "https://precedent-liard-eight.vercel.app",
        "X-Title": "Precedent Research Desk",
      },
    });

    // Curated list of reliable, currently active free model slugs on OpenRouter in priority order
    // Fast lightweight models (e.g. 2.6B) are prioritized first to minimize queue delay and prevent timeouts
    const freeCandidateSlugs = [
      process.env.OPENROUTER_MODEL,
      "liquid/lfm-2.5-2.6b:free",
      "nvidia/nemotron-3.5-lightning:free",
      "nex-agi/nex-n2.5-mini:free",
      "openrouter/free",
      "inclusionai/ling-3.0-flash-fin:free",
      "google/gemma-4-31b-it:free",
      "thinkingmachines/inkling-small:free",
      "google/gemma-4-26b-a4b-it:free",
    ].filter(Boolean) as string[];

    const uniqueSlugs = Array.from(new Set(freeCandidateSlugs));
    for (const slug of uniqueSlugs) {
      const cleanLabel = slug.startsWith("openrouter/") ? slug : `openrouter/${slug}`;
      available.push({
        label: cleanLabel,
        model: slug,
        client,
      });
    }

    // Do not default to paid models when an OpenRouter key is present
    return available;
  }

  // 2. Secondary providers (only when OpenRouter key is not set, never hard-preferred)
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith("sk-or-")) {
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    available.push({
      label: model,
      model,
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    });
  }

  if (process.env.XAI_API_KEY) {
    available.push({
      label: "grok-4.5",
      model: "grok-4.5",
      client: new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" }),
    });
  }

  if (process.env.BITGET_QWEN_API_KEY) {
    available.push({
      label: "qwen3.8-max",
      model: "qwen3.8-max",
      client: new OpenAI({
        apiKey: process.env.BITGET_QWEN_API_KEY,
        baseURL: "https://hackathon.bitgetops.com/v1",
      }),
    });
  }

  return available;
}

const SCHEMA = `{
  "title": string,
  "whatWeDid": string,
  "historicalStressTest": {
    "summary": string,
    "sampleSize": number,
    "results": [{ "period": "Next day"|"Next 5 trading days"|"Next 10 trading days", "wentUp": string, "typicalMove": string, "median": string }],
    "examples": [{ "when": string, "whatHappened": string }],
    "importantNote": string
  },
  "otherThingsWeChecked": string[],
  "whereThingsDoNotAgree": [{ "conflict": string, "whyItMatters": string }],
  "simpleTakeAways": string[],
  "questionsOnlyYouCanAnswer": string[]
}`;

export async function synthesize(opts: {
  style: TradingStyle;
  question: string;
  name: NameCard;
  regime: Regime;
  pillars: PillarBundle;
}): Promise<Briefing> {
  let flags: Briefing["flags"];
  try {
    flags = await computeFlags(opts.pillars, opts.regime, opts.name.native);
  } catch {
    flags = undefined;
  }
  const fallback = deterministicBriefing({ ...opts, flags });
  const llms = providers();
  if (!llms.length) return guardBriefing({ ...fallback, isFallback: true });

  const profile = STYLES[opts.style];
  const system = `You are Precedent, a friendly research helper for tokenized US stocks on Bitget. You explain the retrieved facts to a complete beginner. The human makes the decision. You never do.

HARD RULES
- Never use the words BUY, SELL, LONG, SHORT.
  - Never give a directional verdict or a confidence percentage.
  - Never use soft directional language such as upside/downside bias, favors higher/lower prices, constructive/cautious setup, leaning a side, or history being supportive/unsupportive.
  - Never say “upside possible”, “expect a pullback before further upside”, “moderate upside”, “bullish case”, “upside case”, “further upside”, “leaning”, “favors”, “constructive”, or “cautious outlook”.
  - Describe price levels and historical ranges only as facts about the retrieved data, never as suggestions about what will happen next.
  - The only forward-looking language allowed is inside the “questionsOnlyYouCanAnswer” section.
  - Never output a confidence percentage as a conclusion or headline.
  - Historical results are only what happened in the past. They are not predictions.
  - If data is missing or weak, say so in plain words. Do not invent filings, quotes, dates, social posts, or numbers.
- Native cash tape and rToken 7×24 tape are related but not identical. If no rToken print was provided, do not fabricate one.
- If the question mentions overnight trading, 7×24 trading, Bitget versus cash, or a basis difference, make the current Bitget-versus-regular-stock comparison one of the clearest beginner-friendly facts in the memo and explain why the difference matters while cash markets are closed.
  - Frame depth, horizon, and language to the trader's style.
  - Use short sentences and everyday words, as if explaining the chart to a smart friend who has never studied charts.
  - Write the entire memo as if you are a patient friend helping a beginner understand the research.
  - Never use mean reversion, MACD, RSI, overbought, oversold, consolidation, resistance band, support zone, momentum, bullish, bearish, stretched, or overextended without an immediate plain-English explanation in the same sentence.
  - Prefer everyday wording such as “the price has risen a lot recently and may need a pause,” “the short-term strength indicator is high,” and “the price is near a level where it often struggles to go higher.”
  - Do not leave intermediate technical-analysis jargon unexplained. If a technical term is necessary, explain it immediately in simple words.
  - Every section must help a beginner understand what the information means before deciding whether to open a position.

CONTEXT
  - The selected style is ${profile.label}, with a ${profile.horizon} horizon.
  - The detected market label is internal context only. Do not show its internal name to the beginner.

STYLE
${profile.label}. Horizon: ${profile.horizon}
${profile.framing}

OUTPUT
Return JSON only, matching: ${SCHEMA}
  HistoricalStressTest is the most important section. For every available horizon, use this exact simple format: “Next day: went up 7 times out of 11. Usually between –1.8% and +2.4%. Middle result around +0.6%.” Replace the numbers with the retrieved values. Keep the three horizon cards when data exists, and make “went up X times out of Y” and “usually between A% and B%” the most prominent facts. Never lead with “moderate upside possible” or any similar interpretive or directional wording. State the sample size and explain when results are mixed or the sample is small. Do not expose internal percentile labels.
  Keep otherThingsWeChecked and simpleTakeAways short, with no more than 3 items each. When the retrieved data contains disagreement, always include 1–3 real conflicts in whereThingsDoNotAgree. Write each conflict in plain, practical language: name the two facts that do not match, then explain why a beginner should care without predicting what happens next. For example: “The recent price has moved a lot, but the short-term strength indicator is already high.” Or: “The 24-hour Bitget price and the regular stock price are almost the same right now, but past similar cases sometimes showed a larger overnight difference.” Do not invent a conflict when the data does not support one. questionsOnlyYouCanAnswer must contain exactly 2 or 3 personal, practical questions, not instructions.`;

  const compactPillars = {
    fundamentals: opts.pillars.fundamentals?.ok ? {
      company: opts.pillars.fundamentals.company,
      eps: opts.pillars.fundamentals.eps,
      latestFilings: opts.pillars.fundamentals.latestFilings?.slice(0, 2),
      catalysts: opts.pillars.fundamentals.catalysts?.slice(0, 3),
      notes: opts.pillars.fundamentals.notes?.slice(0, 3),
    } : { ok: false },
    technicals: opts.pillars.technicals?.ok ? {
      native: opts.pillars.technicals.native,
      rToken: opts.pillars.technicals.rToken,
      rTokenGap: opts.pillars.technicals.rTokenGap,
      trend: opts.pillars.technicals.trend,
      momentum: opts.pillars.technicals.momentum,
      volatility: opts.pillars.technicals.volatility,
      levels: opts.pillars.technicals.levels,
      indicators: opts.pillars.technicals.indicators,
      notes: opts.pillars.technicals.notes?.slice(0, 3),
    } : { ok: false },
    news: opts.pillars.news?.ok ? {
      headlines: opts.pillars.news.headlines?.slice(0, 4).map((h) => ({ title: h.title, publisher: h.publisher, tag: h.tag })),
      macro: opts.pillars.news.macro?.slice(0, 2),
      aggregateLean: opts.pillars.news.aggregateLean,
    } : { ok: false },
    analogs: opts.pillars.analogs?.ok ? {
      ranges: opts.pillars.analogs.ranges,
      sample: opts.pillars.analogs.sample,
      closest: opts.pillars.analogs.closest?.slice(0, 3).map((c) => ({ ticker: c.ticker, date: c.date, ret1d: c.ret1d, ret5d: c.ret5d })),
    } : { ok: false },
    marketStructure: opts.pillars.marketStructure?.ok ? {
      communityId: opts.pillars.marketStructure.communityId,
      stability: opts.pillars.marketStructure.stability,
    } : { ok: false },
  };

  const user = JSON.stringify(
    {
      question: opts.question,
      name: { native: opts.name.native, rToken: opts.name.rToken, company: opts.name.name },
      regime: opts.regime,
      flags,
      pillars: compactPillars,
    },
    null,
    2,
  );

  const attempted: { label: string; error: string }[] = [];
  const PER_MODEL_TIMEOUT_MS = 10_000;

  for (const llm of llms) {
    try {
      console.log(`[Synthesis] Attempting synthesis with ${llm.label} (${llm.model})...`);
      const { text, actualModel } = await complete(
        llm.client,
        llm.model,
        system,
        user,
        PER_MODEL_TIMEOUT_MS,
      );
      const parsed = parseModelJson(text) as RetailBriefing;
      const adapted = adaptRetailBriefing(parsed, fallback, opts, flags);
      const effectiveModelLabel = actualModel && actualModel !== llm.model
        ? `${llm.label} (${actualModel})`
        : llm.label;
      const briefing: Briefing = {
        ...adapted,
        model: effectiveModelLabel,
        sources: collectSources(opts.pillars),
        isFallback: false,
      };
      console.log(`[Synthesis] Successfully generated memo using ${effectiveModelLabel}.`);
      return guardBriefing(normalizeBriefing(briefing, fallback));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Synthesis] Model provider ${llm.label} failed: ${errMsg}`);
      attempted.push({ label: llm.label, error: errMsg });
      continue;
    }
  }

  // All providers failed or timed out. Gracefully fall back to deterministic briefing.
  const primaryAttempted = attempted[0]?.label ?? "model";
  const fallbackModelLabel = attempted.length > 0
    ? `${primaryAttempted} (fell back to deterministic synthesizer)`
    : "deterministic-synthesizer";

  console.info(`[Synthesis] Model calls failed or unavailable. Using deterministic briefing: ${fallbackModelLabel}`);

  return guardBriefing({
    ...fallback,
    isFallback: true,
    model: fallbackModelLabel,
  });

  type RetailBriefing = {
    title?: string;
    whatWeDid?: string;
    historicalStressTest?: {
      summary?: string;
      sampleSize?: number;
      results?: { period: string; wentUp: string; typicalMove: string; median: string }[];
      examples?: { when: string; whatHappened: string }[];
      importantNote?: string;
    };
    otherThingsWeChecked?: string[];
    whereThingsDoNotAgree?: { conflict: string; whyItMatters: string }[];
    simpleTakeAways?: string[];
    questionsOnlyYouCanAnswer?: string[];
  };

  function adaptRetailBriefing(
    parsed: RetailBriefing,
    fallback: Briefing,
    opts: { style: TradingStyle; question: string; name: NameCard; regime: Regime; pillars: PillarBundle },
    flags: Briefing["flags"],
  ): Briefing {
    const asksAboutOvernight = /\b(overnight|7\s*[×x]\s*24|cash|basis|bitget|after[- ]hours|pre[- ]market|session)\b/i.test(opts.question);
    const stress = parsed.historicalStressTest;
    let otherThingsWeChecked = parsed.otherThingsWeChecked?.filter(Boolean).slice(0, 3) ?? fallback.otherThingsWeChecked;
    let whereThingsDoNotAgree = parsed.whereThingsDoNotAgree?.filter((item) => item.conflict && item.whyItMatters).slice(0, 3) ?? [];
    if (!whereThingsDoNotAgree.length) {
      whereThingsDoNotAgree = fallback.whereThingsDoNotAgree;
    }
    let simpleTakeAways = parsed.simpleTakeAways?.filter(Boolean).slice(0, 3) ?? fallback.simpleTakeAways;
    const questionsOnlyYouCanAnswer = (parsed.questionsOnlyYouCanAnswer?.filter(Boolean).slice(0, 3) ?? []).length >= 2
      ? (parsed.questionsOnlyYouCanAnswer?.filter(Boolean).slice(0, 3) ?? [])
      : fallback.questionsOnlyYouCanAnswer;

    if (asksAboutOvernight) {
      const mentionsOvernight = (s: string) => /\b(overnight|7\s*[×x]\s*24|bitget|cash|basis)\b/i.test(s);
      if (!otherThingsWeChecked.some(mentionsOvernight)) {
        otherThingsWeChecked = [fallback.otherThingsWeChecked[0], ...otherThingsWeChecked].slice(0, 3);
      }
      if (!whereThingsDoNotAgree.some((item) => mentionsOvernight(item.conflict) || mentionsOvernight(item.whyItMatters))) {
        whereThingsDoNotAgree = [fallback.whereThingsDoNotAgree[0], ...whereThingsDoNotAgree].slice(0, 3);
      }
      if (!simpleTakeAways.some(mentionsOvernight)) {
        simpleTakeAways = [fallback.simpleTakeAways[0], ...simpleTakeAways].slice(0, 3);
      }
    }

    const cleanSummary = cleanHistoricalSummary(stress?.summary) || fallback.historicalStressTest.summary;
    const normalizedResults = fallback.historicalStressTest.results.map((fallbackItem) => {
      const parsedItem = stress?.results?.find((r) => r.period === fallbackItem.period);
      if (!parsedItem) return fallbackItem;
      const hasWentUp = /went\s+up\s+\d+\s+times\s+out\s+of\s+\d+/i.test(parsedItem.wentUp);
      const hasTypical = /usually\s+between/i.test(parsedItem.typicalMove);
      return {
        period: fallbackItem.period,
        wentUp: hasWentUp ? parsedItem.wentUp : fallbackItem.wentUp,
        typicalMove: hasTypical ? parsedItem.typicalMove : fallbackItem.typicalMove,
        median: parsedItem.median || fallbackItem.median,
      };
    });

    const historicalStressTest = {
      summary: cleanSummary,
      sampleSize: typeof stress?.sampleSize === "number" && Number.isFinite(stress.sampleSize)
        ? stress.sampleSize
        : fallback.historicalStressTest.sampleSize,
      results: normalizedResults,
      examples: (stress?.examples ?? []).filter((item) => item.when && item.whatHappened).slice(0, 5).length
        ? (stress?.examples ?? []).filter((item) => item.when && item.whatHappened).slice(0, 5)
        : fallback.historicalStressTest.examples,
      importantNote: stress?.importantNote || fallback.historicalStressTest.importantNote,
    };

    const evidence = otherThingsWeChecked.slice(0, 3).map((claim, index) => ({
      claim,
      source: ["Fundamentals", "Price and Bitget", "Recent news"][index] ?? "Research data",
      pillar: (["fundamentals", "technicals", "news"][index] ?? "news") as Briefing["evidence"][number]["pillar"],
    }));

    return {
      ...fallback,
      title: parsed.title || fallback.title,
      whatWeDid: parsed.whatWeDid || fallback.whatWeDid,
      historicalStressTest,
      otherThingsWeChecked,
      whereThingsDoNotAgree,
      simpleTakeAways,
      questionsOnlyYouCanAnswer,
      styleNote: parsed.whatWeDid || fallback.styleNote,
      regime: opts.regime,
      flags,
      evidence: evidence?.length ? evidence : fallback.evidence,
      tension: whereThingsDoNotAgree.map((item) => ({ left: item.conflict, right: "", whyItMatters: item.whyItMatters })),
      historicalAnalog: {
        setup: cleanSummary,
        analogs: (historicalStressTest.examples ?? []).map((item) => ({
          ticker: item.when,
          date: "",
          similarity: "Past chart with a similar shape",
          followed: item.whatHappened,
        })),
        baseRates: historicalStressTest.results.map((item) => ({
          horizon: item.period,
          range: `${item.wentUp}; ${item.typicalMove}; median ${item.median}`,
          n: historicalStressTest.sampleSize,
          note: "This is only what happened in the past. It is not a prediction.",
        })),
        caveat: historicalStressTest.importantNote,
      },
      considerations: {
        forStyle: simpleTakeAways,
        invalidation: fallback.considerations.invalidation,
        questions: questionsOnlyYouCanAnswer,
      },
    };
  }
}

async function complete(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  timeoutMs: number = 10_000,
): Promise<{ text: string; actualModel?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const chat = await client.chat.completions.create(
      {
        model,
        temperature: 0.2,
        max_tokens: 1500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { signal: controller.signal },
    );
    const msg = chat.choices[0]?.message;
    const text = msg?.content || (msg as any)?.reasoning_content || (msg as any)?.reasoning;
    if (text) return { text, actualModel: chat.model };
  } catch (err: any) {
    if (err?.name === "AbortError" || controller.signal.aborted) {
      throw new Error(`synthesis timeout (${timeoutMs / 1000}s)`);
    }
    // Only attempt legacy responses API if explicitly available on this client instance
    if ("responses" in client && typeof (client as unknown as { responses?: { create?: Function } }).responses?.create === "function") {
      try {
        const res = await (client as unknown as { responses: { create: Function } }).responses.create({
          model,
          temperature: 0.2,
          input: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        });
        const text = (res as { output_text?: string }).output_text;
        if (text) return { text };
      } catch {
        // preserve original error
      }
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  throw new Error("empty model output");
}

function parseModelJson(text: string): any {
  const jsonStr = extractJson(text);
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    // Clean trailing commas and control characters commonly returned by free models
    const sanitized = jsonStr
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u0000-\u0009\u000B-\u001F]+/g, "");
    try {
      return JSON.parse(sanitized);
    } catch {
      throw err;
    }
  }
}

function extractJson(text: string): string {
  // Strip reasoning blocks from models that emit <think>...</think> before JSON
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) return stripped.slice(start, end + 1);
  throw new Error("no json");
}

function validFlags(f: unknown): f is NonNullable<Briefing["flags"]> {
  if (!f || typeof f !== "object") return false;
  const v = f as Record<string, unknown>;
  return (
    (v.catalystDensity === "high" || v.catalystDensity === "moderate" || v.catalystDensity === "low") &&
    Array.isArray(v.balanceSheet) &&
    (v.regimeAlignment === "aligned" || v.regimeAlignment === "misaligned") &&
    (v.communityStability === "stable" || v.communityStability === "unstable") &&
    typeof v.analogQuality === "object" &&
    v.analogQuality !== null &&
    typeof (v.analogQuality as Record<string, unknown>).n === "number" &&
    typeof (v.analogQuality as Record<string, unknown>).clustered === "boolean"
  );
}

const REGIMES: Regime[] = ["trending-up", "range-bound", "trending-down", "high-systemic", "normal", "low-systemic"];

function normalizeBriefing(parsed: Briefing, fallback: Briefing): Briefing {
  return {
    title: parsed.title || fallback.title,
    whatWeDid: parsed.whatWeDid || fallback.whatWeDid,
    historicalStressTest: parsed.historicalStressTest ?? fallback.historicalStressTest,
    otherThingsWeChecked: parsed.otherThingsWeChecked?.length ? parsed.otherThingsWeChecked : fallback.otherThingsWeChecked,
    whereThingsDoNotAgree: parsed.whereThingsDoNotAgree?.length ? parsed.whereThingsDoNotAgree : fallback.whereThingsDoNotAgree,
    simpleTakeAways: parsed.simpleTakeAways?.length ? parsed.simpleTakeAways : fallback.simpleTakeAways,
    questionsOnlyYouCanAnswer: parsed.questionsOnlyYouCanAnswer?.length ? parsed.questionsOnlyYouCanAnswer : fallback.questionsOnlyYouCanAnswer,
    styleNote: parsed.styleNote || fallback.styleNote,
    model: parsed.model,
    isFallback: parsed.isFallback ?? false,
    regime: REGIMES.includes(parsed.regime as Regime) ? parsed.regime : fallback.regime,
    flags: validFlags(parsed.flags) ? parsed.flags : fallback.flags,
    evidence: parsed.evidence?.length ? parsed.evidence : fallback.evidence,
    tension: parsed.tension?.length ? parsed.tension : fallback.tension,
    historicalAnalog: parsed.historicalAnalog?.analogs?.length
      ? parsed.historicalAnalog
      : fallback.historicalAnalog,
    considerations: parsed.considerations?.questions?.length
      ? parsed.considerations
      : fallback.considerations,
    sources: parsed.sources?.length ? parsed.sources : fallback.sources,
  };
}
