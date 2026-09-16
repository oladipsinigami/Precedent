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

  const rawOpenCodeKey =
    process.env.OPENCODE_API_KEY ||
    "[REDACTED_API_KEY]";
  const openCodeKey =
    rawOpenCodeKey && rawOpenCodeKey !== "[SENSITIVE]" ? rawOpenCodeKey : undefined;

  // 1. Prioritize OpenCode Zen models
  if (openCodeKey) {
    const client = new OpenAI({
      apiKey: openCodeKey,
      baseURL: process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/v1",
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": "https://precedent-liard-eight.vercel.app",
        "X-Title": "Precedent Research Desk",
        "x-session-id": `ses_prec_${Math.random().toString(36).slice(2)}`,
      },
    });

    const candidateModels = [
      process.env.OPENCODE_MODEL,
      "ling-3.0-flash-fin-free",
      "nemotron-3-ultra-free",
      "nemotron-3.5-lightning-free",
    ].filter(Boolean) as string[];

    const uniqueModels = Array.from(new Set(candidateModels)).slice(0, 3);
    for (const model of uniqueModels) {
      available.push({
        label: `opencode/${model}`,
        model,
        client,
      });
    }

    return available;
  }

  // 2. Secondary providers (only when OpenCode is not set)
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
  "title": "Clear memo title here",
  "whatWeDid": "One sentence explaining the data checked",
  "historicalStressTest": {
    "summary": "Objective past data description",
    "sampleSize": 12,
    "results": [
      { "period": "Next day", "wentUp": "went up 7 times out of 12", "typicalMove": "usually between -1.5% and +2.1%", "median": "+0.4%" },
      { "period": "Next 5 trading days", "wentUp": "went up 8 times out of 12", "typicalMove": "usually between -2.2% and +3.5%", "median": "+1.1%" },
      { "period": "Next 10 trading days", "wentUp": "went up 7 times out of 12", "typicalMove": "usually between -3.1% and +4.0%", "median": "+1.5%" }
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
  const system = `You are Precedent, an API engine providing friendly research notes for tokenized US stocks on Bitget.
CRITICAL FORMAT RULE: Output RAW JSON ONLY matching this schema. Be concise: keep every string property under 20 words. Never output markdown code blocks, reasoning tags, or conversational preamble. Start response immediately with "{" and end with "}".

HARD RULES:
- Never use BUY, SELL, LONG, SHORT.
- Never give a directional prediction, target price, or confidence percentage.
- Forward-looking language is strictly forbidden in title, whatWeDid, historicalStressTest, otherThingsWeChecked, whereThingsDoNotAgree, and simpleTakeAways.
- Describe past data objectively: "went up X times out of Y" and "usually between -A% and +B%".
- Keep otherThingsWeChecked (max 3 items), whereThingsDoNotAgree (1-3 real conflicts), simpleTakeAways (max 3 items), questionsOnlyYouCanAnswer (2-3 reflective questions for the human trader).
- Style: ${profile.label} with a ${profile.horizon} horizon. Frame tone for a smart friend learning trading.

SCHEMA:
${SCHEMA}`;

  const stress = fallback.historicalStressTest;
  const tech = opts.pillars.technicals?.ok ? opts.pillars.technicals : undefined;
  const fund = opts.pillars.fundamentals?.ok ? opts.pillars.fundamentals : undefined;
  const news = opts.pillars.news?.ok ? opts.pillars.news : undefined;

  const stressResultsSummary = stress.results
    .map((r) => `  * ${r.period}: ${r.wentUp}, ${r.typicalMove}, median ${r.median}`)
    .join("\n");
  const stressExamplesSummary = stress.examples
    .slice(0, 2)
    .map((e) => `${e.when}: ${e.whatHappened}`)
    .join("; ");

  const user = `Stock: ${opts.name.name} (${opts.name.native} / ${opts.name.rToken})
Trader Style: ${profile.label} (${profile.horizon} horizon)
Question: ${opts.question}
Market Regime: ${opts.regime}

Retrieved Key Data:
- Historical Stress Test: ${stress.sampleSize} past occurrences found.
${stressResultsSummary}
  * Past Examples: ${stressExamplesSummary || "AAPL past occurrences"}
- Technicals: Cash price $${tech?.native?.last ?? "N/A"}, rToken $${tech?.rToken?.last ?? "N/A"} (basis: ${tech?.rTokenGap ?? "tight"}). Trend ${tech?.trend ?? "steady"}, RSI ${tech?.indicators?.rsi14 ?? 50}. Support: ${(tech?.levels?.support ?? []).slice(0, 2).join(", ") || "support zone"}, Resistance: ${(tech?.levels?.resistance ?? []).slice(0, 2).join(", ") || "resistance zone"}.
- Fundamentals: ${fund?.company ? String(fund.company).slice(0, 100) : "Stable financials"}. Catalysts: ${(fund?.catalysts ?? []).slice(0, 2).join("; ") || "regular operations"}.
- News & Macro: ${(news?.headlines ?? []).slice(0, 2).map((h) => h.title).join("; ") || "Neutral macro flow"}.

CRITICAL: Return the raw JSON memo now matching the schema.`;

  try {
    const { parsed, effectiveModelLabel } = await hedgeSynthesis(llms, system, user, 52_000);
    const adapted = adaptRetailBriefing(parsed, fallback, opts, flags);
    const briefing: Briefing = {
      ...adapted,
      model: effectiveModelLabel,
      sources: collectSources(opts.pillars),
      isFallback: false,
    };
    console.log(`[Synthesis] Successfully generated full LLM memo using ${effectiveModelLabel}.`);
    return guardBriefing(normalizeBriefing(briefing, fallback));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Synthesis] All hedged synthesis candidates failed: ${errMsg}`);
    return guardBriefing({
      ...fallback,
      isFallback: true,
      model: "Precedent Quantitative Desk",
    });
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
      examples: (() => {
        const validParsed = (stress?.examples ?? []).filter(
          (item) =>
            item?.when &&
            item?.whatHappened &&
            !/\b(n\/?a|null|undefined|moved\s+n\/?a)\b/i.test(item.whatHappened) &&
            !/\b(n\/?a|null|undefined)\b/i.test(item.when) &&
            /\d/.test(item.whatHappened) &&
            /\b(rose|fell|stayed|gained|dropped|moved)\b/i.test(item.whatHappened),
        ).slice(0, 3);
        return validParsed.length ? validParsed : fallback.historicalStressTest.examples;
      })(),
      importantNote: stress?.importantNote || fallback.historicalStressTest.importantNote,
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
  // If 429 rate limit occurs, do not sleep and retry the same model.
  // Fail over immediately to the next candidate model to avoid burning execution budget!
  if (status === 429) return false;
  if (typeof status === "number" && status >= 500) return true;
  const msg = (anyErr.message || String(err)).toLowerCase();
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")) return false;
  // Do not retry hard timeouts on the same candidate model to avoid hanging; fail fast to the next candidate model
  if (msg.includes("timeout") || msg.includes("timed out") || anyErr?.name === "AbortError") return false;
  return (
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("overloaded") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("empty model output") ||
    msg.includes("no json") ||
    msg.includes("unexpected token") ||
    msg.includes("json at position") ||
    msg.includes("syntaxerror")
  );
}

async function hedgeSynthesis(
  llms: { label: string; model: string; client: OpenAI }[],
  system: string,
  user: string,
  totalTimeoutMs: number = 52_000,
): Promise<{ parsed: RetailBriefing; effectiveModelLabel: string }> {
  const controllers = llms.map(() => new AbortController());
  const timers: NodeJS.Timeout[] = [];
  const started = new Set<number>();

  return new Promise<{ parsed: RetailBriefing; effectiveModelLabel: string }>((resolve, reject) => {
    let resolved = false;
    let pendingCount = llms.length;
    const errors: { label: string; error: string }[] = [];

    const cleanup = () => {
      clearTimeout(masterTimer);
      timers.forEach(clearTimeout);
    };

    const masterTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        controllers.forEach((c) => c.abort());
        cleanup();
        reject(new Error(`All synthesis candidates timed out after ${totalTimeoutMs / 1000}s`));
      }
    }, totalTimeoutMs);

    const tryCandidate = async (index: number) => {
      if (resolved || index >= llms.length || started.has(index)) return;
      started.add(index);
      const llm = llms[index];
      const controller = controllers[index];
      const candidateTimeoutMs = llm.model.includes("flash") ? 10_000 : 40_000;

      console.log(`[Synthesis] Hedged runner launching [${index + 1}/${llms.length}] ${llm.label}...`);

      try {
        const { text, actualModel } = await complete(
          llm.client,
          llm.model,
          system,
          user,
          candidateTimeoutMs,
          controller.signal,
        );
        const parsed = parseModelJson(text) as RetailBriefing;
        if (!resolved) {
          resolved = true;
          cleanup();
          // Abort all other running candidates immediately
          controllers.forEach((c, i) => {
            if (i !== index) c.abort();
          });
          const effectiveModelLabel =
            actualModel &&
            actualModel !== llm.model &&
            actualModel !== llm.model.replace(":free", "")
              ? `${llm.label} (${actualModel})`
              : llm.label;
          console.log(`[Synthesis] Candidate [${index + 1}] ${llm.label} won the race (${effectiveModelLabel})!`);
          resolve({ parsed, effectiveModelLabel });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[Synthesis] Candidate [${index + 1}] ${llm.label} failed: ${errMsg}`);
        errors.push({ label: llm.label, error: errMsg });
        pendingCount--;
        if (!resolved) {
          // If this candidate failed fast and next hasn't started, launch next immediately!
          if (index + 1 < llms.length && !started.has(index + 1)) {
            tryCandidate(index + 1);
          } else if (pendingCount <= 0) {
            cleanup();
            reject(new Error(errors.map((e) => `${e.label}: ${e.error}`).join(", ")));
          }
        }
      }
    };

    // Start primary candidate; failover immediately triggers on error or timeout
    tryCandidate(0);
  });
}

async function complete(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  timeoutMs: number = 42_000,
  externalSignal?: AbortSignal,
): Promise<{ text: string; actualModel?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error("aborted");
    }
    externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

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
      throw new Error(`OpenCode error: ${errDetail}`);
    }
    const choices = anyChat?.choices;
    if (!Array.isArray(choices) || !choices.length) {
      throw new Error(`OpenCode returned no choices: ${JSON.stringify(chat).slice(0, 150)}`);
    }
    const msg = choices[0]?.message;
    const content = typeof msg?.content === "string" ? msg.content.trim() : "";
    const reasoning = typeof msg?.reasoning === "string" ? msg.reasoning.trim() : "";
    // Prioritize clean content; fallback to reasoning only if content is empty
    const text = content || reasoning;
    if (text) {
      console.log(`[Synthesis] Model ${model} responded: content length ${content.length}, reasoning length ${reasoning.length}, finish_reason: ${choices[0]?.finish_reason}, actualModel: ${chat.model}`);
      return { text, actualModel: chat.model };
    }
    throw new Error("empty model output");
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
