import OpenAI from "openai";
import { computeFlags } from "./flags";
import { fmtPct } from "./http";
import { guardBriefing } from "./language-guard";
import { STYLES } from "./style-profiles";
import type { Briefing, PillarBundle, Regime, TradingStyle } from "./types";
import type { NameCard } from "./universe";

function provider() {
  if (process.env.XAI_API_KEY) {
    return {
      label: "grok-4.5",
      model: "grok-4.5",
      client: new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" }),
    };
  }
  if (process.env.BITGET_QWEN_API_KEY) {
    return {
      label: "qwen3.8-max",
      model: "qwen3.8-max",
      client: new OpenAI({
        apiKey: process.env.BITGET_QWEN_API_KEY,
        baseURL: "https://hackathon.bitgetops.com/v1",
      }),
    };
  }
  return null;
}

const SCHEMA = `{
  "title": string,
  "styleNote": string,
  "regime": "trending-up"|"range-bound"|"trending-down"|"high-systemic"|"normal"|"low-systemic",
  "flags": {
    "catalystDensity": "high"|"moderate"|"low",
    "balanceSheet": string[],
    "regimeAlignment": "aligned"|"misaligned",
    "communityStability": "stable"|"unstable",
    "cleanedCorrRankPct": number | null,
    "analogQuality": { "n": number, "clustered": boolean }
  },
  "evidence": [{ "claim": string, "source": string, "pillar": "fundamentals"|"technicals"|"news"|"analogs"|"marketStructure" }],
  "tension": [{ "left": string, "right": string, "whyItMatters": string }],
  "historicalAnalog": {
    "setup": string,
    "analogs": [{ "ticker": string, "date": string, "similarity": string, "followed": string }],
    "baseRates": [{ "horizon": string, "range": string, "n": number, "note": string }],
    "caveat": string
  },
  "considerations": {
    "forStyle": string[],
    "invalidation": string[],
    "questions": string[]
  }
}`;

export async function synthesize(opts: {
  style: TradingStyle;
  question: string;
  name: NameCard;
  regime: Regime;
  pillars: PillarBundle;
}): Promise<Briefing> {
  const llm = provider();
  const flags = await computeFlags(opts.pillars, opts.regime, opts.name.native);
  const fallback = deterministicBriefing({ ...opts, flags });
  if (!llm) return guardBriefing(fallback);

  const profile = STYLES[opts.style];
  const system = `You are Precedent, a research workbench for tokenized US stocks (rToken). You synthesize the five pillars into one briefing. The human makes the trade. You never do.

HARD RULES
- Never use the words BUY, SELL, LONG, SHORT.
- Avoid soft directional language such as upside/downside bias, favors higher/lower prices, constructive/cautious setup, leaning a side, or history being supportive/unsupportive.
- Never output a confidence percentage as a conclusion or headline.
- Never issue a verdict, a side, or an order. End with questions the trader should weigh.
- Historical analogs are base rates (what happened after similar charts), not predictions.
- If a pillar is missing or degraded, say so. Do not invent filings, quotes, analog dates, social posts, or RMT communities.
- Native cash tape and rToken 7×24 tape are related but not identical. If no rToken print was provided, do not fabricate one.
- Structure & Fundamentals flags are separate labeled facts. Never blend them into one score, rank, or verdict.
- Frame depth, horizon, and language to the trader's style.

CONTEXT
- Detected regime for this run: ${opts.regime}. Use it to frame the memo and to condition the analog read. It is a structural description, not a call.
- Computed flags are provided; report each flag as its own evidence line. Do not merge them.

STYLE
${profile.label}. Horizon: ${profile.horizon}
${profile.framing}

OUTPUT
Return JSON only, matching: ${SCHEMA}
Evidence must cite the actual source names (SEC, Yahoo, Chart Library, Bitget, Google News, X discourse, YouTube discourse, RMT precompute snapshot).
Tension must name real disagreements between pillars, including at least: news lean vs X lean (when both exist), raw technical signal vs cleaned RMT community structure, and any regime mismatch with recent history.
Historical analog must use the closest analogs and the p10/p50/p90 bands provided, and note the regime/community conditioning.
Considerations.questions must be actual questions, not disguised instructions.`;

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

  try {
    const text = await complete(llm.client, llm.model, system, user);
    const parsed = JSON.parse(extractJson(text)) as Omit<Briefing, "model" | "sources">;
    const briefing: Briefing = {
      ...parsed,
      regime: parsed.regime ?? opts.regime,
      flags: parsed.flags ?? flags,
      model: llm.label,
      sources: collectSources(opts.pillars),
    };
    return guardBriefing(normalizeBriefing(briefing, fallback));
  } catch {
    return guardBriefing({ ...fallback, model: `${llm.label} (fell back to deterministic synthesizer)` });
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
      left: "The analog median excess is close to zero.",
      right: `The ${analogHorizon} band is wide (p10 ${fmtPct(band.p10)} to p90 ${fmtPct(band.p90)}).`,
      whyItMatters:
        "History is speaking more to the size of the next move than to its direction — a stress-test input, not a side.",
    });
  }
  if (rsi !== undefined && rsi >= 60 && pillars.news.headlines.some((h) => h.lean === "cautious")) {
    tension.push({
      left: `Tape momentum is not washed out (RSI14 ${rsi.toFixed(1)}).`,
      right: "Recent headlines include cautious language.",
      whyItMatters: "Price action and the news tape are not telling the same story; the trader has to pick which clock they are on.",
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
      left: `X volume is elevated (${pillars.news.social.x.length} posts) with mixed lean.`,
      right: "High attention with no consensus direction.",
      whyItMatters: "Crowded attention without agreement is a disagreement input, not confirmation of anything.",
    });
  }
  const cleaned = pillars.marketStructure.cleanedCorrelations?.[0];
  if (cleaned && Math.abs(cleaned.raw - cleaned.cleaned) > 0.2) {
    tension.push({
      left: `Raw correlation to ${cleaned.peer} reads ${cleaned.raw.toFixed(2)}.`,
      right: `After noise-filtering it reads ${cleaned.cleaned.toFixed(2)}.`,
      whyItMatters: "The raw tape overstates (or understates) the relationship; the cleaned community structure is the one to weigh.",
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
        "A 7×24 window can reprice while cash is closed. Without the rToken mark, overnight premium/discount is an open question rather than a measured input.",
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
        `Style on this session is ${profile.label}. ${profile.horizon}`,
        analogHorizon === "1d"
          ? "Weight the 1-session analog band and any cash/rToken gap into the next open."
          : analogHorizon === "10d"
            ? "Weight filings and the 10-session analog band over a single RSI print."
            : "Weight the 5-session analog band and the places the pillars disagree over a single headline.",
        pillars.technicals.rTokenGap ?? "rToken venue print was not on the tape this run.",
        pillars.marketStructure.ok
          ? `Community ${pillars.marketStructure.communityId} membership means peer moves inside that group deserve more weight than index-level moves.`
          : "No community membership this run; peer comparison stays manual.",
      ],
      invalidation: [
        band
          ? `A realized move beyond the analog ${analogHorizon} p10/p90 band (${fmtPct(band.p10)} / ${fmtPct(band.p90)} excess) would mean this setup is no longer inside the retrieved sample.`
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
