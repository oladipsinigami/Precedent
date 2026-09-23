import OpenAI from "openai";
import { deterministicBriefing, collectSources } from "./deterministic-briefing";
import { computeFlags } from "./flags";
import { guardBriefing, cleanHistoricalSummary, didLastGuardRewrite } from "./language-guard";
import { STYLES } from "./style-profiles";
import type { Briefing, PillarBundle, Regime, TradingStyle } from "./types";
import type { NameCard } from "./universe";

export { deterministicBriefing, collectSources } from "./deterministic-briefing";

function providers() {
  const available: { label: string; model: string; client: OpenAI }[] = [];

  // 1. OpenRouter models (when OPENROUTER_API_KEY is configured)
  const rawOpenRouterKey =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPENROUTER_KEY?.trim() ||
    (process.env.OPENAI_API_KEY?.startsWith("sk-or-") ? process.env.OPENAI_API_KEY.trim() : undefined);
  const openRouterKey =
    rawOpenRouterKey && rawOpenRouterKey !== "[SENSITIVE]" ? rawOpenRouterKey : undefined;

  if (openRouterKey) {
    const client = new OpenAI({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": "https://precedent-liard-eight.vercel.app",
        "X-Title": "Precedent Research Desk",
      },
    });

    const candidateModels = [
      process.env.OPENROUTER_MODEL,
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
      "liquid/lfm-2.5-2.6b:free",
    ].filter(Boolean) as string[];

    for (const model of [...new Set(candidateModels)]) {
      available.push({
        label: model.startsWith("openrouter/") ? model : `openrouter/${model}`,
        model,
        client,
      });
    }
  }

  // 3. TokenHarbor / OpenAI models
  const rawOpenAIKey = process.env.OPENAI_API_KEY?.trim();
  const openAIKey =
    rawOpenAIKey && rawOpenAIKey !== "[SENSITIVE]" && !rawOpenAIKey.startsWith("sk-or-")
      ? rawOpenAIKey
      : undefined;

  if (openAIKey) {
    const isTokenHarbor = openAIKey.startsWith("thk_");
    const baseURL = isTokenHarbor ? "https://tokenharbor.ai/v1" : undefined;
    const client = new OpenAI({ apiKey: openAIKey, baseURL, maxRetries: 0 });

    if (isTokenHarbor) {
      const candidateModels = [
        process.env.OPENAI_MODEL,
        "deepseek-v4-flash:free",
        "mimo-v2.5:free",
      ].filter(Boolean) as string[];

      for (const model of [...new Set(candidateModels)]) {
        available.push({
          label: `tokenharbor/${model}`,
          model,
          client,
        });
      }
    } else {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      available.push({
        label: model,
        model,
        client,
      });
    }
  }

  // 4. XAI (Grok)
  if (process.env.XAI_API_KEY?.trim() && process.env.XAI_API_KEY.trim() !== "[SENSITIVE]") {
    available.push({
      label: "xai/grok-4.5",
      model: "grok-4.5",
      client: new OpenAI({ apiKey: process.env.XAI_API_KEY.trim(), baseURL: "https://api.x.ai/v1", maxRetries: 0 }),
    });
  }

  // 5. Bitget Qwen
  if (process.env.BITGET_QWEN_API_KEY?.trim() && process.env.BITGET_QWEN_API_KEY.trim() !== "[SENSITIVE]") {
    available.push({
      label: "bitget/qwen3.8-max",
      model: "qwen3.8-max",
      client: new OpenAI({
        apiKey: process.env.BITGET_QWEN_API_KEY.trim(),
        baseURL: "https://hackathon.bitgetops.com/v1",
      }),
    });
  }

  return available;
}

const SCHEMA = `{
  "title": "Clear memo title here",
  "whatWeDid": "One sentence explaining the data checked",
  "historicalStressTest": {
    "summary": "Objective past data description",
    "sampleSize": 12,
    "results": [
      { "period": "Next 1 trading day", "wentUp": "Went up 7 times out of 12", "typicalMove": "Typical move: usually between -1.5% and +2.1%", "median": "+0.4%" },
      { "period": "Next 5 trading days", "wentUp": "Went up 8 times out of 12", "typicalMove": "Typical move: usually between -2.2% and +3.5%", "median": "+1.1%" },
      { "period": "Next 10 trading days", "wentUp": "Went up 7 times out of 12", "typicalMove": "Typical move: usually between -3.1% and +4.0%", "median": "+1.5%" }
    ],
    "examples": [{ "when": "AAPL (2023-04-12)", "whatHappened": "rose about 2.1% over the next 5 days" }],
    "importantNote": "Historical results are past occurrences only, not predictions."
  },
  "otherThingsWeChecked": ["First observation", "Second observation"],
  "whereThingsDoNotAgree": [{ "conflict": "Fact A vs Fact B", "whyItMatters": "Why it matters" }],
  "simpleTakeAways": ["First takeaway", "Second takeaway"],
  "questionsOnlyYouCanAnswer": ["First question", "Second question"]
}`;

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
  if (!llms.length) return guardBriefing({ ...fallback, isFallback: true, model: "Precedent Quantitative Desk" });

  const profile = STYLES[opts.style];
  const system = `You are Precedent, an objective quantitative research desk providing structured research memos for tokenized US stocks on Bitget.
CRITICAL FORMAT: Return a RAW JSON object ONLY matching the SCHEMA below. Be concise: keep string values under 25 words. Do not output markdown code blocks or conversational commentary. Start immediately with "{" and end with "}".
Tone & Guidance: Analytical and objective for a ${profile.label} (${profile.horizon} horizon). Describe historical ranges and current levels ONLY as facts (e.g. "Went up X times out of Y", "Typical move: usually between A% and B%", "Middle result: C%"). Strictly prohibit soft directional or interpretive language: NEVER use "slight edge", "favoring patience", "overnight speculation", "bullish/bearish news sentiment", "remain constructive", "tempts traders to expect the same direction", or any directional lean. Forward-looking language is strictly permitted ONLY within "questionsOnlyYouCanAnswer".
Technical Glossing: Explain any technical term once in plain language on first mention (e.g. "RSI (a short-term strength score from 0 to 100)"), then use only the short name ("RSI") for later mentions. Avoid repeating the same parenthetical explanation multiple times. Prefer shorter sentences overall.
Past Examples Guidance: Provide 2 to 3 past examples in "historicalStressTest.examples" based on the retrieved examples. Prefer same-ticker historical occurrences when available. State each outcome clearly in plain language (e.g. "rose about 2.8% over the next 5 days"). Never output "n/a", undefined, or empty outcomes.

SCHEMA:
${SCHEMA}`;

  const stress = fallback.historicalStressTest;
  const tech = opts.pillars.technicals?.ok ? opts.pillars.technicals : undefined;
  const fund = opts.pillars.fundamentals?.ok ? opts.pillars.fundamentals : undefined;
  const news = opts.pillars.news?.ok ? opts.pillars.news : undefined;

  const stressResultsSummary = stress.sampleSize > 0 && stress.results.length > 0
    ? stress.results
        .map((r) => `  * ${r.period}: ${r.wentUp}, ${r.typicalMove}, median ${r.median}`)
        .join("\n")
    : "  * Historical comparison was not available in this run (0 past occurrences found).";
  const stressExamplesSummary = stress.examples
    .slice(0, 3)
    .map((e) => `${e.when}: ${e.whatHappened}`)
    .join("; ");

  const user = `Stock: ${opts.name.name} (${opts.name.native} / ${opts.name.rToken})
Trader Style: ${profile.label} (${profile.horizon} horizon)
Question: ${opts.question}
Market Regime: ${opts.regime}

Retrieved Key Data:
- Historical Stress Test: ${stress.sampleSize > 0 ? `${stress.sampleSize} past occurrences found.` : "Historical comparison was not available in this run."}
${stressResultsSummary}
  * Past Examples: ${stressExamplesSummary || (stress.sampleSize > 0 ? "AAPL past occurrences" : "None (historical data unavailable)")}
- Technicals: Cash price $${tech?.native?.last ?? "N/A"}, rToken $${tech?.rToken?.last ?? "N/A"} (basis: ${tech?.rTokenGap ?? "tight"}). Trend ${tech?.trend ?? "steady"}, RSI ${tech?.indicators?.rsi14 ?? 50}. Support: ${(tech?.levels?.support ?? []).slice(0, 2).join(", ") || "support zone"}, Resistance: ${(tech?.levels?.resistance ?? []).slice(0, 2).join(", ") || "resistance zone"}.
- Fundamentals: ${fund?.company ? String(fund.company).slice(0, 100) : "Stable financials"}. Catalysts: ${(fund?.catalysts ?? []).slice(0, 2).join("; ") || "regular operations"}.
- News & Macro: ${(news?.headlines ?? []).slice(0, 2).map((h) => h.title).join("; ") || "Neutral macro flow"}.

CRITICAL: Return the raw JSON memo now matching the schema.`;

  try {
    const { parsed, effectiveModelLabel } = await runSequentialSynthesis(llms, system, user, 42_000);
    const adapted = adaptRetailBriefing(parsed, fallback, opts, flags);
    const cleanLabel = effectiveModelLabel.replace(" (retry)", "");
    const briefing: Briefing = {
      ...adapted,
      model: cleanLabel,
      sources: collectSources(opts.pillars),
      isFallback: false,
    };
    console.log(`[Synthesis] Successfully generated full LLM memo using ${cleanLabel}.`);
    const guarded = guardBriefing(normalizeBriefing(briefing, fallback));
    if (didLastGuardRewrite()) {
      console.log(`[Synthesis] Language guard actively sanitized prohibited directional language in LLM memo.`);
    }
    return guarded;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Synthesis] All sequential synthesis candidates failed: ${errMsg}. Falling back to deterministic briefing.`);
    const guardedFallback = guardBriefing({
      ...fallback,
      isFallback: true,
      model: "Precedent Quantitative Desk",
    });
    if (didLastGuardRewrite()) {
      console.log(`[Synthesis] Language guard sanitized deterministic fallback memo.`);
    }
    return guardedFallback;
  }

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
      const parsedItem = stress?.results?.find(
        (r) => r.period === fallbackItem.period || (fallbackItem.period === "Next 1 trading day" && r.period === "Next day"),
      );
      if (!parsedItem) return fallbackItem;
      const hasWentUp = /went\s+up\s+\d+\s+times\s+out\s+of\s+\d+/i.test(parsedItem.wentUp);
      const hasTypical = /usually\s+between/i.test(parsedItem.typicalMove);
      const cleanWentUp = hasWentUp ? parsedItem.wentUp.replace(/^went up/i, "Went up") : fallbackItem.wentUp;
      const cleanTypicalMove = hasTypical
        ? (parsedItem.typicalMove.startsWith("Typical move: ") ? parsedItem.typicalMove : `Typical move: ${parsedItem.typicalMove.replace(/^typical move:\s*/i, "")}`)
        : fallbackItem.typicalMove;
      return {
        period: fallbackItem.period,
        wentUp: cleanWentUp,
        typicalMove: cleanTypicalMove,
        median: parsedItem.median || fallbackItem.median,
      };
    });

    const isDegradedSample = fallback.historicalStressTest.sampleSize === 0;

    const historicalStressTest = {
      summary: isDegradedSample ? fallback.historicalStressTest.summary : cleanSummary,
      sampleSize: isDegradedSample
        ? 0
        : typeof stress?.sampleSize === "number" && Number.isFinite(stress.sampleSize)
        ? stress.sampleSize
        : fallback.historicalStressTest.sampleSize,
      results: isDegradedSample ? [] : normalizedResults,
      examples: (() => {
        if (isDegradedSample) return [];
        const validParsed = (stress?.examples ?? [])
          .filter(
            (item) =>
              item?.when &&
              item?.whatHappened &&
              !/\b(n\/?a|null|undefined|moved\s+n\/?a)\b/i.test(item.whatHappened) &&
              !/\b(n\/?a|null|undefined)\b/i.test(item.when) &&
              /\d/.test(item.whatHappened) &&
              /\b(rose|fell|stayed|gained|dropped|moved)\b/i.test(item.whatHappened),
          )
          .sort((a, b) => {
            const aSame = a.when.startsWith(opts.name.native) ? 0 : 1;
            const bSame = b.when.startsWith(opts.name.native) ? 0 : 1;
            return aSame - bSame;
          })
          .map((item) => {
            const isSame = item.when.startsWith(opts.name.native);
            if (!isSame && !/cross[- ]ticker/i.test(item.when)) {
              return {
                ...item,
                when: item.when.replace(/\)$/, ", cross-ticker)"),
              };
            }
            return item;
          })
          .slice(0, 3);
        const hasSameTicker = (list: { when: string }[]) => list.some((e) => e.when.startsWith(opts.name.native));
        if (hasSameTicker(fallback.historicalStressTest.examples) && !hasSameTicker(validParsed)) {
          return fallback.historicalStressTest.examples.slice(0, 3);
        }
        return validParsed.length >= 2 ? validParsed : fallback.historicalStressTest.examples.slice(0, 3);
      })(),
      importantNote: isDegradedSample
        ? fallback.historicalStressTest.importantNote
        : (stress?.importantNote || fallback.historicalStressTest.importantNote),
    };

    const evidence = otherThingsWeChecked.slice(0, 3).map((claim, index) => ({
      claim,
      source: ["Fundamentals", "Price and Bitget", "Recent news"][index] ?? "Research data",
      pillar: (["fundamentals", "technicals", "news"][index] ?? "news") as Briefing["evidence"][number]["pillar"],
    }));

    const profile = STYLES[opts.style];
    let resolvedTitle = parsed.title || fallback.title;
    if (resolvedTitle && !resolvedTitle.toLowerCase().includes(profile.label.toLowerCase())) {
      resolvedTitle = resolvedTitle.replace(
        /(Day trader|Swing trader|Event-driven \/ macro|Event-driven|Position trader|Position|Day|Swing)\s*(?:trader\s*)?stress test/i,
        `${profile.label} stress test`
      );
      if (!resolvedTitle.toLowerCase().includes(profile.label.toLowerCase())) {
        const tokenMatch = resolvedTitle.match(/^([rR]?[A-Za-z0-9]+)\s*[—\-:]\s*/);
        resolvedTitle = tokenMatch
          ? `${tokenMatch[1]} — ${profile.label} stress test`
          : fallback.title;
      }
    }

    return {
      ...fallback,
      title: resolvedTitle,
      whatWeDid: parsed.whatWeDid || fallback.whatWeDid,
      historicalStressTest,
      otherThingsWeChecked,
      whereThingsDoNotAgree,
      simpleTakeAways,
      questionsOnlyYouCanAnswer,
      unverified: fallback.unverified,
      styleNote: fallback.styleNote,
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

function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  const status = anyErr.status ?? anyErr.statusCode ?? anyErr.response?.status;
  // Non-recoverable errors: failover immediately to next model without wasting retry time
  if (status === 401 || status === 403 || status === 404) return false;
  const msg = (anyErr.message || String(err)).toLowerCase();
  if (msg.includes("401") || msg.includes("403") || msg.includes("404") || msg.includes("not available")) return false;

  if (typeof status === "number" && (status === 429 || status >= 500)) return true;
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("overloaded") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("endpoint is unavailable") ||
    msg.includes("upstream request failed") ||
    msg.includes("server_error") ||
    msg.includes("empty model output") ||
    msg.includes("no json") ||
    msg.includes("unexpected token") ||
    msg.includes("json at position") ||
    msg.includes("syntaxerror") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    anyErr?.name === "AbortError"
  );
}

async function complete(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  timeoutMs = 16_000,
): Promise<{ text: string; actualModel?: string }> {
  let lastError: unknown;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const chat = await client.chat.completions.create(
        {
          model,
          temperature: 0.2,
          max_tokens: model.includes("nemotron") ? 1300 : 2500,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        {
          signal: controller.signal,
          headers: {
            "x-session-id": `ses_prec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          },
        },
      );

      const anyChat = chat as any;
      if (anyChat?.error) {
        const errDetail = anyChat.error.message || anyChat.error.type || JSON.stringify(anyChat.error);
        throw new Error(`Provider error: ${errDetail}`);
      }
      const choices = anyChat?.choices;
      if (!Array.isArray(choices) || !choices.length) {
        throw new Error(`Provider returned no choices: ${JSON.stringify(chat).slice(0, 150)}`);
      }
      const msg = choices[0]?.message;
      let content = typeof msg?.content === "string" ? msg.content.trim() : "";
      const reasoning = typeof msg?.reasoning === "string" ? msg.reasoning.trim() : "";
      if (!content && reasoning) {
        const jsonBlock = reasoning.match(/\{[\s\S]*\}/);
        if (jsonBlock) content = jsonBlock[0];
      }
      const text = content || reasoning;
      if (text) {
        console.log(
          `[Synthesis] Model ${model} responded (length ${text.length}, finish_reason: ${choices[0]?.finish_reason}, actualModel: ${chat.model})`,
        );
        return { text, actualModel: chat.model };
      }
      throw new Error("empty model output");
    } catch (err: any) {
      lastError = err;
      const isTimeout = err?.name === "AbortError" || controller.signal.aborted;
      const errorDescription = isTimeout ? `timeout after ${timeoutMs / 1000}s` : err?.message || String(err);

      if (attempt === 1 && isTransientError(err) && Date.now() - startedAt < timeoutMs / 2) {
        console.warn(`[Synthesis] Model ${model} transient failure on attempt 1 (${errorDescription}). Retrying in 500ms...`);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw new Error(`${model} failed on attempt ${attempt}: ${errorDescription}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error(`${model} failed after retry`);
}

async function runSequentialSynthesis(
  llms: { label: string; model: string; client: OpenAI }[],
  system: string,
  user: string,
  totalTimeoutMs = 42_000,
): Promise<{ parsed: RetailBriefing; effectiveModelLabel: string }> {
  const errors: string[] = [];
  const startTime = Date.now();

  for (let i = 0; i < llms.length; i++) {
    const llm = llms[i];
    const elapsed = Date.now() - startTime;
    const remainingTime = totalTimeoutMs - elapsed;
    if (remainingTime < 6_000) {
      console.warn(`[Synthesis] Insufficient time remaining (${remainingTime}ms) to attempt ${llm.label}.`);
      break;
    }

    // Fail-fast per candidate: 14s forces hanging free models to yield quickly so
    // the waterfall reaches a responsive provider (or the deterministic fallback)
    // well within the overall 42s synthesis / 48s pipeline budget
    const candidateTimeout = Math.min(
      14_000,
      remainingTime - 1_500,
    );

    console.log(`[Synthesis] Attempting candidate [${i + 1}/${llms.length}]: ${llm.label} (timeout ${candidateTimeout / 1000}s)...`);

    try {
      const { text, actualModel } = await complete(
        llm.client,
        llm.model,
        system,
        user,
        candidateTimeout,
      );
      const parsed = parseModelJson(text) as RetailBriefing;
      const effectiveModelLabel =
        actualModel &&
        actualModel !== llm.model &&
        actualModel !== llm.model.replace(":free", "")
          ? `${llm.label} (${actualModel})`
          : llm.label;
      console.log(`[Synthesis] Model ${llm.label} succeeded in ${((Date.now() - startTime) / 1000).toFixed(1)}s!`);
      return { parsed, effectiveModelLabel };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Synthesis] Candidate ${llm.label} failed: ${msg}`);
      errors.push(`${llm.label}: ${msg}`);
    }
  }

  throw new Error(`All candidate free models failed: ${errors.join(" | ")}`);
}

function parseModelJson(text: string): any {
  let jsonStr = extractJson(text);

  // Pre-sanitize unquoted TypeScript type annotations if an LLM wrote `: string`, `: number`, `: boolean`
  jsonStr = jsonStr
    .replace(/:\s*string\b/gi, ': ""')
    .replace(/:\s*number\b/gi, ': 0')
    .replace(/:\s*boolean\b/gi, ': false');

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    // Clean trailing commas, dangling control characters, and truncated endings commonly returned by free models
    const sanitized = jsonStr
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u0000-\u0009\u000B-\u001F]+/g, "");
    try {
      return JSON.parse(sanitized);
    } catch {
      for (const suffix of ["}", "]}", "]}}", "]}}}", "\"}", "\"]}"]) {
        try {
          return JSON.parse(sanitized + suffix);
        } catch {}
      }
      throw err;
    }
  }
}

function extractJson(text: string): string {
  // 1. Check for fenced markdown code block first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) {
      return candidate;
    }
  }

  // 2. Strip closed reasoning blocks (<think>...</think>)
  let stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 3. If unclosed <think> tag exists, test if JSON exists before or within it
  if (stripped.includes("<think>")) {
    const beforeThink = stripped.slice(0, stripped.indexOf("<think>")).trim();
    if (beforeThink.includes("{") && beforeThink.includes("}")) {
      stripped = beforeThink;
    } else {
      stripped = stripped.replace(/<\/?think>/gi, "").trim();
    }
  }

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) return stripped.slice(start, end + 1);

  // 4. Fallback search on original text
  const rawStart = text.indexOf("{");
  const rawEnd = text.lastIndexOf("}");
  if (rawStart >= 0 && rawEnd > rawStart) return text.slice(rawStart, rawEnd + 1);

  throw new Error(`no json (response length: ${text.length}, preview: "${text.slice(0, 100).replace(/\s+/g, " ")}")`);
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
