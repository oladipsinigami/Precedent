import { deterministicBriefing } from "@/lib/deterministic-briefing";
import { runResearch } from "@/lib/pipeline";
import type { TradingStyle } from "@/lib/types";
import { findName } from "@/lib/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STYLES: TradingStyle[] = ["day", "swing", "event", "position"];

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const input = body as { style?: unknown; question?: unknown; symbol?: unknown };
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(pingInterval);
        }
      }, 3000);

      let hasSentBriefing = false;
      try {
        for await (const event of runResearch({ style, question, symbol })) {
          if (event.type === "briefing") {
            hasSentBriefing = true;
          }
          send(event);
        }
      } catch (err) {
        if (!hasSentBriefing) {
          try {
            const fallbackName = findName(`${symbol ?? ""} ${question}`);
            const emptyPillars = {
              fundamentals: { ok: false, company: fallbackName.name, ticker: fallbackName.native, latestFilings: [], catalysts: [], notes: [], sources: [] },
              technicals: { ok: false, native: { last: 0, changePct: 0, high52: 0, low52: 0, volume: 0, asOf: "" }, trend: "unavailable", momentum: "unavailable", volatility: "unavailable", levels: { support: [], resistance: [] }, indicators: {}, spark: [], notes: [], sources: [] },
              news: { ok: false, headlines: [], macro: [], social: { x: [], youtube: [] }, aggregateLean: "insufficient" as const, caveats: [], notes: [], sources: [] },
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
        controller.close();
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
