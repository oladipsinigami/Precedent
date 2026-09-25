import { deterministicBriefing } from "@/lib/deterministic-briefing";
import { runResearch } from "@/lib/pipeline";
import { DEMO_TASK } from "@/lib/style-profiles";
import type { ResearchEvent, TradingStyle } from "@/lib/types";
import { findName, findNameOrDefault } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Total work budget per request. Kept below maxDuration so the deterministic
// fallback memo always has time to stream before the platform kills the function.
const REQUEST_BUDGET_MS = 55_000;
const MAX_BODY_BYTES = 16_384;

const STYLES: TradingStyle[] = ["day", "swing", "event", "position"];

class BodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds 16 KiB.");
  }
}

async function readBoundedBody(req: Request): Promise<string> {
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new BodyTooLargeError();
  if (!req.body) {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new BodyTooLargeError();
    return text;
  }

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

// Minimal abuse controls: optional shared-secret header plus a fixed-window
// per-IP request cap. The secret is only enforced when RESEARCH_API_KEY is
// configured; the rate cap is always on. Both are best-effort on serverless
// (per-instance state) but stop casual quota-draining of upstream free tiers.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (hits.size > 5_000) {
    for (const [key, value] of hits) {
      if (value.resetAt <= now) hits.delete(key);
    }
  }
  return entry.count > RATE_LIMIT;
}

// Demo fast path: the recommended judge walkthrough (DEMO_TASK) replays the
// built-in illustrative sample memo, so it finishes almost instantly and stays
// reliable under concurrent judges. Only the exact demo question with an
// explicit demo flag uses this path; all other research runs live. The memo is
// flagged isSample so the UI labels it as sample data.
const DEMO_CACHE_TTL_MS = 10 * 60_000;
const demoEventCache = new Map<string, { events: ResearchEvent[]; expires: number }>();
const demoInFlight = new Map<string, Promise<ResearchEvent[] | null>>();

function demoCacheKey(): string {
  return `${DEMO_TASK.style}::${DEMO_TASK.question}`;
}

async function runDemoOnce(key: string, deadline: number): Promise<ResearchEvent[] | null> {
  const existing = demoInFlight.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const events: ResearchEvent[] = [];
    let gotBriefing = false;
    try {
      for await (const event of runResearch({
        style: DEMO_TASK.style,
        question: DEMO_TASK.question,
        symbol: DEMO_TASK.symbol,
        demo: true,
        deadline,
      })) {
        if (event.type === "briefing") gotBriefing = true;
        events.push(event);
      }
    } catch {
      return null;
    }
    // Only cache runs that produced a memo.
    if (!gotBriefing) return null;
    demoEventCache.set(key, { events, expires: Date.now() + DEMO_CACHE_TTL_MS });
    return events;
  })().finally(() => {
    demoInFlight.delete(key);
  });
  demoInFlight.set(key, promise);
  return promise;
}

export async function POST(req: Request) {
  const deadline = Date.now() + REQUEST_BUDGET_MS;
  const requiredKey = process.env.RESEARCH_API_KEY?.trim();
  if (requiredKey && req.headers.get("x-research-key") !== requiredKey) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return Response.json(
      { error: "Too many research requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(await readBoundedBody(req));
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return Response.json({ error: "Request body exceeds 16 KiB." }, { status: 413 });
    }
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const input = body as { style?: unknown; question?: unknown; symbol?: unknown; demo?: unknown };
  const style = typeof input.style === "string" && STYLES.includes(input.style as TradingStyle)
    ? (input.style as TradingStyle)
    : "swing";
  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (question.length < 8) {
    return Response.json({ error: "Ask a concrete research question about a specific rToken." }, { status: 400 });
  }
  if (question.length > 2_000) {
    return Response.json({ error: "Research questions must be 2,000 characters or fewer." }, { status: 400 });
  }

  const symbol = typeof input.symbol === "string" ? input.symbol.trim().slice(0, 20) : undefined;

  // Demo fast path only activates on an explicit flag plus an exact
  // DEMO_TASK match, so ordinary research questions never replay sample data.
  const demoParam = new URL(req.url).searchParams.get("demo");
  const isDemo =
    (input.demo === true || demoParam === "true" || demoParam === "1") &&
    style === DEMO_TASK.style &&
    question === DEMO_TASK.question &&
    (!symbol || symbol.toUpperCase() === DEMO_TASK.symbol.toUpperCase());

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      const send = (event: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          isClosed = true;
        }
      };
      const pingInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(pingInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          isClosed = true;
          clearInterval(pingInterval);
        }
      }, 3000);

      let hasSentBriefing = false;
      try {
        if (isDemo) {
          const key = demoCacheKey();
          const cached = demoEventCache.get(key);
          const events =
            cached && cached.expires > Date.now() ? cached.events : await runDemoOnce(key, deadline);
          if (events) {
            for (const event of events) send(event);
            return;
          }
          // Cold-cache failure: fall through to the normal live pipeline.
        }
        for await (const event of runResearch({ style, question, symbol, deadline })) {
          if (event.type === "briefing") {
            hasSentBriefing = true;
          }
          send(event);
        }
      } catch (err) {
        if (!hasSentBriefing && !isClosed) {
          try {
            const fallbackName = findNameOrDefault(`${symbol ?? ""} ${question}`);
            const emptyPillars = {
              fundamentals: { ok: false, company: fallbackName.name, ticker: fallbackName.native, latestFilings: [], catalysts: [], notes: [], sources: [] },
              technicals: { ok: false, native: { last: 0, changePct: 0, high52: 0, low52: 0, volume: 0, asOf: "" }, trend: "unavailable", momentum: "unavailable", volatility: "unavailable", levels: { support: [], resistance: [] }, indicators: {}, spark: [], notes: [], sources: [] },
              news: { ok: false, headlines: [], macro: [], social: { x: [] }, aggregateLean: "insufficient" as const, caveats: [], notes: [], sources: [] },
              analogs: { ok: false, closest: [], ranges: [], overlay: [], sample: { n: 0, symbols: 0, sessions: 0 }, caveats: [], sources: [] },
              marketStructure: { ok: false, universeSize: 0, caveats: [], sources: [] },
            };
            const fallbackBriefing = deterministicBriefing({
              style,
              question,
              name: fallbackName,
              regime: "normal",
              pillars: emptyPillars,
              flags: undefined,
            });
            fallbackBriefing.isFallback = true;
            send({ type: "briefing", briefing: fallbackBriefing });
          } catch {
            // Guard against any unexpected failure
          }
        }
        send({ type: "done" });
      } finally {
        clearInterval(pingInterval);
        if (!isClosed) {
          try {
            controller.close();
          } catch {
            // Controller already closed or errored
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
