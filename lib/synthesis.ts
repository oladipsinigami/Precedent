import OpenAI from "openai";
import { computeFlags } from "./flags";
import { fmtPct } from "./http";
import { guardBriefing } from "./language-guard";
import { STYLES } from "./style-profiles";
import type { Briefing, PillarBundle, Regime, TradingStyle } from "./types";
import type { NameCard } from "./universe";

function providers() {
  const available = [];
  if (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY?.startsWith("sk-or-")) {
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "openrouter/free";
    available.push({
      label: `openrouter/${model.replace("openai/", "")}`,
      model,
      client: new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://precedent-liard-eight.vercel.app",
          "X-Title": "Precedent Research Desk",
        },
      }),
    });
  }
  if (process.env.OPENAI_API_KEY) {
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
  if (!llms.length) return guardBriefing(fallback);

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

  const user = JSON.stringify(
    {
      question: opts.question,
      name: { native: opts.name.native, rToken: opts.name.rToken, company: opts.name.name },
      regime: opts.regime,
      flags,
      pillars: opts.pillars,
    },
    null,
    2,
  );

  for (const llm of llms) {
    try {
      const text = await Promise.race([
        complete(llm.client, llm.model, system, user),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("synthesis timeout")), 12_000),
        ),
      ]);
    const parsed = JSON.parse(extractJson(text)) as RetailBriefing;
    const adapted = adaptRetailBriefing(parsed, fallback, opts, flags);
    const briefing: Briefing = {
      ...adapted,
      model: llm.label,
      sources: collectSources(opts.pillars),
    };
    return guardBriefing(normalizeBriefing(briefing, fallback));
    } catch {
      continue;
    }
  }
  return guardBriefing({ ...fallback, model: `${llms[llms.length - 1].label} (fell back to deterministic synthesizer)` });

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
    opts: { style: TradingStyle; name: NameCard; regime: Regime },
    flags: Briefing["flags"],
  ): Briefing {
    const stress = parsed.historicalStressTest;
    const otherThingsWeChecked = parsed.otherThingsWeChecked?.filter(Boolean).slice(0, 3) ?? fallback.otherThingsWeChecked;
    const whereThingsDoNotAgree = parsed.whereThingsDoNotAgree?.filter((item) => item.conflict && item.whyItMatters).slice(0, 3) ?? fallback.whereThingsDoNotAgree;
    const simpleTakeAways = parsed.simpleTakeAways?.filter(Boolean).slice(0, 3) ?? fallback.simpleTakeAways;
    const questionsOnlyYouCanAnswer = (parsed.questionsOnlyYouCanAnswer?.filter(Boolean).slice(0, 3) ?? []).length >= 2
      ? (parsed.questionsOnlyYouCanAnswer?.filter(Boolean).slice(0, 3) ?? [])
      : fallback.questionsOnlyYouCanAnswer;
    const historicalStressTest = stress
      ? {
          summary: stress.summary || fallback.historicalStressTest.summary,
          sampleSize: typeof stress.sampleSize === "number" && Number.isFinite(stress.sampleSize)
            ? stress.sampleSize
            : fallback.historicalStressTest.sampleSize,
          results: (stress.results ?? []).filter((item): item is Briefing["historicalStressTest"]["results"][number] =>
            ["Next day", "Next 5 trading days", "Next 10 trading days"].includes(item.period),
          ).slice(0, 3),
          examples: (stress.examples ?? []).filter((item) => item.when && item.whatHappened).slice(0, 5),
          importantNote: stress.importantNote || fallback.historicalStressTest.importantNote,
        }
      : fallback.historicalStressTest;
    const evidence = parsed.otherThingsWeChecked?.filter(Boolean).slice(0, 3).map((claim, index) => ({
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
      tension: parsed.whereThingsDoNotAgree?.length
        ? parsed.whereThingsDoNotAgree.slice(0, 3).map((item) => ({ left: item.conflict, right: "", whyItMatters: item.whyItMatters }))
        : fallback.tension,
      historicalAnalog: stress
        ? {
            setup: stress.summary || fallback.historicalAnalog.setup,
            analogs: (stress.examples ?? []).map((item) => ({
              ticker: item.when,
              date: "",
              similarity: "Past chart with a similar shape",
              followed: item.whatHappened,
            })),
            baseRates: (stress.results ?? []).map((item) => ({
              horizon: item.period,
              range: `${item.wentUp}; ${item.typicalMove}; median ${item.median}`,
              n: stress.sampleSize ?? 0,
              note: "This is only what happened in the past. It is not a prediction.",
            })),
            caveat: stress.importantNote || fallback.historicalAnalog.caveat,
          }
        : fallback.historicalAnalog,
      considerations: parsed.simpleTakeAways || parsed.questionsOnlyYouCanAnswer
        ? {
            forStyle: parsed.simpleTakeAways?.filter(Boolean).slice(0, 3) ?? fallback.considerations.forStyle,
            invalidation: fallback.considerations.invalidation,
            questions: (parsed.questionsOnlyYouCanAnswer?.filter(Boolean).slice(0, 3) ?? []).length >= 2
              ? (parsed.questionsOnlyYouCanAnswer?.filter(Boolean).slice(0, 3) ?? [])
              : fallback.considerations.questions,
          }
        : fallback.considerations,
    };
  }
}

async function complete(client: OpenAI, model: string, system: string, user: string): Promise<string> {
  try {
    const chat = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const text = chat.choices[0]?.message?.content;
    if (text) return text;
  } catch {
    // try responses API (xAI / some Qwen gateways)
  }
  const res = await client.responses.create({
    model,
    temperature: 0.2,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = (res as { output_text?: string }).output_text;
  if (!text) throw new Error("empty model output");
  return text;
}

function extractJson(text: string): string {
  const fenced = text.match(/```json([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
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

export function deterministicBriefing(opts: {
  style: TradingStyle;
  question: string;
  name: NameCard;
  regime: Regime;
  pillars: PillarBundle;
  flags: Briefing["flags"];
}): Briefing {
  const { pillars, name, style, regime, flags } = opts;
  const profile = STYLES[style];
  const asksAboutOvernight = /\b(overnight|7\s*[×x]\s*24|cash|basis|bitget)\b/i.test(opts.question);
  const analogHorizon = profile.analogHorizon;
  const band = pillars.analogs.ranges.find((r) => r.horizon === analogHorizon) ?? pillars.analogs.ranges[0];
  const evidence = [];

  if (pillars.fundamentals.ok && pillars.fundamentals.eps) {
    evidence.push({
      claim: `${pillars.fundamentals.company} last reported diluted EPS ${pillars.fundamentals.eps.value} for the period ending ${pillars.fundamentals.eps.periodEnd} (${pillars.fundamentals.eps.form} filed ${pillars.fundamentals.eps.filed}).`,
      source: "SEC EDGAR companyconcept",
      pillar: "fundamentals" as const,
    });
  }
  if (pillars.fundamentals.latestFilings[0]) {
    const f = pillars.fundamentals.latestFilings[0];
    evidence.push({
      claim: `Most recent filing on the EDGAR tape: ${f.form} dated ${f.filed}.`,
      source: "SEC EDGAR submissions",
      pillar: "fundamentals" as const,
    });
  }
  if (pillars.technicals.ok) {
    evidence.push({
      claim: `Native ${name.native} last ${pillars.technicals.native.last.toFixed(2)} (${fmtPct(pillars.technicals.native.changePct)}). ${pillars.technicals.trend}`,
      source: "Yahoo Finance chart",
      pillar: "technicals" as const,
    });
    if (pillars.technicals.rTokenGap) {
      evidence.push({
        claim: pillars.technicals.rTokenGap,
        source: pillars.technicals.rToken ? "Bitget public ticker" : "Bitget tape unavailable",
        pillar: "technicals" as const,
      });
    }
  }
  if (pillars.news.headlines[0]) {
    evidence.push({
      claim: `Lead headline: “${pillars.news.headlines[0].title}” (${pillars.news.headlines[0].publisher}).`,
      source: pillars.news.headlines[0].publisher,
      pillar: "news" as const,
    });
  }
  if (pillars.news.social.x[0]) {
    const top = pillars.news.social.x[0];
    evidence.push({
      claim: `Top X post (@${top.author}, ${top.lean}): “${top.text.slice(0, 160)}”. Aggregate X lean across ${pillars.news.social.x.length} posts is engagement-weighted.`,
      source: "X discourse",
      pillar: "news" as const,
    });
  }
  if (pillars.news.social.youtube[0]) {
    const v = pillars.news.social.youtube[0];
    evidence.push({
      claim: `Top YouTube item: “${v.title}” (${v.channelTitle}, ${v.overallLean}).`,
      source: "YouTube discourse",
      pillar: "news" as const,
    });
  }
  if (pillars.news.caveats.length) {
    evidence.push({
      claim: `Social coverage caveats: ${pillars.news.caveats.join(" ")}`,
      source: "Sentiment pillar",
      pillar: "news" as const,
    });
  }
  if (pillars.marketStructure.ok) {
    const ms = pillars.marketStructure;
    evidence.push({
      claim: `Market structure: ${name.native} sits in RMT community ${ms.communityId} alongside ${(ms.communityMembers ?? []).filter((m) => m !== name.native).slice(0, 5).join(", ") || "no listed peers"}; market-mode share ${ms.marketModeStrength !== undefined ? (ms.marketModeStrength * 100).toFixed(1) + "%" : "n/a"}; ≈${ms.infoBeyondNoisePct?.toFixed(1)}% of eigenstructure beyond noise.`,
      source: "RMT precompute snapshot",
      pillar: "marketStructure" as const,
    });
  } else {
    evidence.push({
      claim: `Market-structure lookup degraded: ${pillars.marketStructure.error ?? "no snapshot"}. Community-conditioned analogs fall back to pure chart shape.`,
      source: "RMT precompute snapshot",
      pillar: "marketStructure" as const,
    });
  }
  if (flags) {
    evidence.push({
      claim: `Flags (separate facts, not a score): catalyst density ${flags.catalystDensity}; regime alignment ${flags.regimeAlignment}; community stability ${flags.communityStability}; analog base n=${flags.analogQuality.n} (${flags.analogQuality.clustered ? "clustered" : "scattered"} outcomes)${flags.cleanedCorrRankPct !== undefined ? `; cleaned-correlation rank p${flags.cleanedCorrRankPct} in community` : ""}.`,
      source: "Structure & Fundamentals flags",
      pillar: "marketStructure" as const,
    });
    for (const line of flags.balanceSheet.slice(0, 2)) {
      evidence.push({ claim: line, source: "SEC EDGAR companyconcept", pillar: "fundamentals" as const });
    }
  }
  if (pillars.analogs.ok && band) {
    evidence.push({
      claim: `Chart Library ${analogHorizon} analog excess vs a liquid baseline: p10 ${fmtPct(band.p10)}, median ${fmtPct(band.p50)}, p90 ${fmtPct(band.p90)} (n=${band.n}). State: ${pillars.analogs.state ?? "n/a"} on ${pillars.analogs.session ?? "n/a"}. Regime frame: ${regime}.`,
      source: "Chart Library state-packet",
      pillar: "analogs" as const,
    });
  }

  const tension = [];
  const rsi = pillars.technicals.indicators.rsi14;
  if (band && Math.abs(band.p50) < 0.5 && (band.p90 - band.p10) > 6) {
    tension.push({
      left: "Similar past cases were close to flat in the middle.",
      right: `The usual range was wide, from ${fmtPct(band.p10)} to ${fmtPct(band.p90)} over ${analogHorizon}.`,
      whyItMatters:
        "The past cases show that the size of the move varied a lot, so this history does not give a simple answer.",
    });
  }
  if (rsi !== undefined && rsi >= 60 && pillars.news.headlines.some((h) => h.lean === "cautious")) {
    tension.push({
      left: `The price has moved strongly recently; a short-term strength reading is ${rsi.toFixed(1)}.`,
      right: "Recent headlines include cautious language.",
      whyItMatters: "The price and recent news do not tell the same story, so a beginner should note the disagreement rather than treat either one as a forecast.",
    });
  }
  const newsLean = pillars.news.headlines[0]?.lean;
  const xLean = pillars.news.social.x[0]?.lean;
  if (newsLean && xLean && newsLean !== "mixed" && xLean !== "mixed" && xLean !== "neutral" && newsLean !== xLean) {
    tension.push({
      left: `Headline tape leans ${newsLean}.`,
      right: `X discourse leans ${xLean} (engagement-weighted).`,
      whyItMatters: "The press tape and the crowd tape disagree; the trader must decide which audience moves this name first.",
    });
  }
  if (pillars.news.social.x.length >= 10 && new Set(pillars.news.social.x.map((p) => p.lean)).size >= 3) {
    tension.push({
      left: `There were many public posts about the company (${pillars.news.social.x.length}).`,
      right: "Those posts did not agree with each other.",
      whyItMatters: "A lot of attention does not mean the information is clear, so a beginner should treat this as mixed evidence.",
    });
  }
  const cleaned = pillars.marketStructure.cleanedCorrelations?.[0];
  if (cleaned && Math.abs(cleaned.raw - cleaned.cleaned) > 0.2) {
    tension.push({
      left: `The price relationship with ${cleaned.peer} looks different in the raw data than after a noise check.`,
      right: "The two measurements do not match closely.",
      whyItMatters: "A beginner should treat the peer comparison as uncertain instead of assuming the two prices will keep moving together.",
    });
  }
  if (flags && flags.regimeAlignment === "misaligned") {
    tension.push({
      left: `Detected regime is “${regime}”.`,
      right: "Recent price action does not match that regime label.",
      whyItMatters: "A regime mismatch means recent history may be a poor guide even before analogs are consulted.",
    });
  }
  if (!pillars.technicals.rToken && pillars.analogs.ok) {
    tension.push({
      left: "Analog and cash-session tape are available.",
      right: "The Bitget rToken print was not retrieved this run.",
      whyItMatters:
        "Bitget trades around the clock while the regular stock market closes. Without that Bitget price, the overnight difference cannot be measured.",
    });
  }
  if (!tension.length) {
    tension.push({
      left: "Pillars are not in open conflict on the facts retrieved.",
      right: "Absence of conflict is not confirmation.",
      whyItMatters: "The trader still has to decide whether the analog range is acceptable for this style and holding period.",
    });
  }

  const analogRows = pillars.analogs.closest.slice(0, 5).map((a) => ({
    ticker: a.ticker,
    date: a.date,
    similarity: `distance ${a.distance.toFixed(3)} (lower is closer)`,
    followed: `next session ${fmtPct(a.ret1d)}; 5 sessions ${fmtPct(a.ret5d)}; 10 sessions ${fmtPct(a.ret10d)} (cash close-to-close)`,
  }));

  return {
    title: `${name.rToken} — ${profile.label} stress test`,
    whatWeDid: `We compared the current chart with past charts that looked similar. We also checked company updates, price data, Bitget trading, and recent news.`,
    historicalStressTest: {
      summary: band
        ? `We found ${band.n} past cases with a similar chart. The results show a range of outcomes, so history is useful for context but cannot tell us what happens this time.`
        : "The historical comparison was not available in this run, so there is not enough past data to summarize.",
      sampleSize: band?.n ?? 0,
      results: pillars.analogs.ranges.slice(0, 3).map((r) => ({
        period: r.horizon === "1d" ? "Next day" as const : r.horizon === "5d" ? "Next 5 trading days" as const : "Next 10 trading days" as const,
        wentUp: `went up ${Math.round(r.pUp * r.n)} times out of ${r.n}`,
        typicalMove: `usually between ${fmtPct(r.p10)} and ${fmtPct(r.p90)}`,
        median: fmtPct(r.p50),
      })),
      examples: pillars.analogs.closest.slice(0, 3).map((a) => ({
        when: a.date,
        whatHappened: `${a.ticker} moved ${fmtPct(a.ret5d)} over the next 5 trading days.`,
      })),
      importantNote: "This is only what happened in the past. It does not tell us what will happen this time.",
    },
    otherThingsWeChecked: [
      pillars.fundamentals.eps
        ? `The latest company report included diluted EPS of ${pillars.fundamentals.eps.value} for the period ending ${pillars.fundamentals.eps.periodEnd}.`
        : "Company earnings data was limited in this run.",
      asksAboutOvernight
        ? pillars.technicals.rTokenGap
          ? `The 24-hour Bitget price compared with the regular stock price: ${pillars.technicals.rTokenGap}`
          : "The 24-hour Bitget price could not be compared with the regular stock price in this run."
        : pillars.technicals.rTokenGap ?? "Bitget price comparison was not available in this run.",
      pillars.news.headlines[0]
        ? `Recent news included: “${pillars.news.headlines[0].title}”.`
        : "Recent news coverage was limited in this run.",
    ],
    whereThingsDoNotAgree: tension.slice(0, 3).map((item) => ({
      conflict: `${item.left}${item.right ? ` ${item.right}` : ""}`,
      whyItMatters: item.whyItMatters,
    })),
    simpleTakeAways: [
      band ? "Similar past cases had mixed outcomes." : "There was not enough similar historical data.",
      pillars.technicals.rTokenGap ?? "The Bitget price could not be compared with the regular stock price.",
      pillars.news.caveats[0] ?? "News coverage was included where available.",
    ],
    questionsOnlyYouCanAnswer: [
      "If the price moves outside the historical range, would you still feel comfortable with your plan?",
      "How much does the Bitget price matter for the way you trade?",
    ],
    styleNote: `${profile.framing} Horizon in force: ${profile.horizon} Regime frame: ${regime}.`,
    model: "deterministic-synthesizer",
    regime,
    flags: flags ?? undefined,
    evidence: evidence.slice(0, 12),
    tension,
    historicalAnalog: {
      setup: pillars.analogs.state
        ? `Current Chart Library state “${pillars.analogs.state}” on ${pillars.analogs.session}. Previous: “${pillars.analogs.prevState}”. Regime frame: ${regime}.`
        : "Chart Library state was unavailable; closest-name follow-through still listed where Yahoo history exists.",
      analogs: analogRows,
      baseRates: pillars.analogs.ranges.map((r) => ({
        horizon: r.horizon,
        range: `p10 ${fmtPct(r.p10)} · median ${fmtPct(r.p50)} · p90 ${fmtPct(r.p90)} · share of positive excess ${Math.round(r.pUp * 100)}% of the sample`,
        n: r.n,
        note: "Excess versus a date-matched liquid-stock baseline, not raw return, and not a forecast.",
      })),
      caveat:
        pillars.analogs.caveats.join(" ") ||
        "Analogs are a historical sample. They do not assign a side to the current name.",
    },
    considerations: {
      forStyle: [
        `This memo is framed for a ${profile.label} style over ${profile.horizon}.`,
        analogHorizon === "1d"
          ? "Weight the 1-session analog band and any cash/rToken gap into the next open."
          : analogHorizon === "10d"
            ? "For this time frame, company reports matter more than one short-term price reading."
            : "For this time frame, compare the five-session history with the places where the facts disagree.",
        pillars.technicals.rTokenGap ?? "rToken venue print was not on the tape this run.",
        pillars.marketStructure.ok
          ? `Community ${pillars.marketStructure.communityId} membership means peer moves inside that group deserve more weight than index-level moves.`
          : "No community membership this run; peer comparison stays manual.",
      ],
      invalidation: [
        band
          ? `A move outside the usual historical range for ${analogHorizon} (${fmtPct(band.p10)} to ${fmtPct(band.p90)}) would be different from the cases in this sample.`
          : "Without analog bands, invalidation has to be defined by the trader’s own level — the desk will not invent one.",
        pillars.fundamentals.catalysts[0]
          ? `A new 8-K that changes the last-known filing picture (latest on tape: ${pillars.fundamentals.catalysts[0]}) would reopen the fundamental case.`
          : "Watch the next 8-K; the current filing tape is the last known state.",
      ],
      questions: [
        "Is the analog range wide enough that standing aside is the actual decision, not a placeholder?",
        "If cash is closed and rToken is still trading, which tape are you answering to?",
        "Which pillar, if it flipped tomorrow, would make you abandon the rest of this memo?",
      ],
    },
    sources: collectSources(pillars),
  };
}

function collectSources(pillars: PillarBundle) {
  return [
    ...pillars.fundamentals.sources,
    ...pillars.technicals.sources,
    ...pillars.news.sources,
    ...pillars.analogs.sources,
    ...pillars.marketStructure.sources,
  ];
}
